import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { universe } from "./dmx/universe";
import { dmxEngine } from "./dmx/engine";
import type {
  WSMessage,
  WSSetChannelsMessage,
  WSSetFixtureMessage,
  WSRecallSceneMessage,
  WSSubscribeMessage,
  WSBlackoutMessage,
  WSGrandMasterMessage,
  WSSetDimmerChannelsMessage,
} from "./types";

interface ExtendedWebSocket extends WebSocket {
  subscribedChannels?: Set<number>;
  subscribedFixtures?: Set<string>;
  isAlive?: boolean;
}

let wss: WebSocketServer | null = null;
const serverBaseDimmers: Map<string, number> = new Map();

export function handleWsUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
  if (!wss) return;
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss!.emit("connection", ws, req);
  });
}

export function initWebSocketServer(): WebSocketServer {
  if (wss) return wss;

  wss = new WebSocketServer({ noServer: true });

  universe.onChange((channels) => {
    broadcast({ type: "state", channels });
  });

  wss.on("connection", (ws: ExtendedWebSocket, _req: IncomingMessage) => {
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });

    ws.send(
      JSON.stringify({
        type: "state",
        channels: universe.getChannels(),
        grandMaster: universe.getGrandMaster(),
        engine: dmxEngine.getStatus(),
        baseDimmers: Object.fromEntries(serverBaseDimmers),
      })
    );

    ws.on("message", async (raw: Buffer) => {
      try {
        const msg: WSMessage = JSON.parse(raw.toString());
        await handleMessage(ws, msg);
      } catch (e) {
        ws.send(JSON.stringify({ type: "error", message: String(e) }));
      }
    });

    ws.on("close", () => {});
  });

  const pingInterval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((client) => {
      const ws = client as ExtendedWebSocket;
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(pingInterval));

  console.log("[WS] WebSocket server initialized on /ws");
  return wss;
}

async function handleMessage(
  ws: ExtendedWebSocket,
  msg: WSMessage
): Promise<void> {
  switch (msg.type) {
    case "set_channels": {
      const m = msg as WSSetChannelsMessage;
      universe.setChannels(m.channels);
      break;
    }

    case "set_fixture": {
      const m = msg as WSSetFixtureMessage;
      await setFixtureParams(m.fixtureId, m.params);
      break;
    }

    case "recall_scene": {
      const m = msg as WSRecallSceneMessage;
      await recallScene(m.sceneId, m.fadeTime ?? 0);
      broadcast({ type: "scene_recalled", sceneId: m.sceneId });
      break;
    }

    case "blackout": {
      (_msg: WSBlackoutMessage) => {};
      universe.blackout();
      break;
    }

    case "grand_master": {
      const m = msg as WSGrandMasterMessage;
      universe.setGrandMaster(m.value);
      broadcast({ type: "grand_master", value: m.value });
      break;
    }

    case "subscribe": {
      const m = msg as WSSubscribeMessage;
      if (m.channels) ws.subscribedChannels = new Set(m.channels);
      if (m.fixtures) ws.subscribedFixtures = new Set(m.fixtures);
      break;
    }

    case "set_base_dimmer": {
      const { fixtureId, value } = msg as unknown as { fixtureId: string; value: number };
      serverBaseDimmers.set(fixtureId, value);
      broadcast({ type: "base_dimmer", fixtureId, value });
      break;
    }

    case "get_state": {
      ws.send(
        JSON.stringify({
          type: "state",
          channels: universe.getChannels(),
          grandMaster: universe.getGrandMaster(),
          engine: dmxEngine.getStatus(),
          baseDimmers: Object.fromEntries(serverBaseDimmers),
        })
      );
      break;
    }

    case "engine_start": {
      const cfg = msg.config as {
        host?: string;
        port?: number;
        net?: number;
        subnet?: number;
        universe?: number;
        outputMode?: string;
        enttecPort?: string;
      } | undefined;
      await dmxEngine.start(cfg ? {
        host: cfg.host,
        port: cfg.port,
        net: cfg.net,
        subnet: cfg.subnet,
        universe: cfg.universe,
        outputMode: cfg.outputMode as "artnet" | "enttec" | undefined,
        enttecPort: cfg.enttecPort,
      } : undefined);
      broadcast({ type: "engine_status", status: dmxEngine.getStatus() });
      break;
    }

    case "set_dimmer_channels": {
      const m = msg as WSSetDimmerChannelsMessage;
      universe.setDimmerChannels(m.addresses);
      break;
    }

    case "engine_stop": {
      dmxEngine.stop();
      broadcast({ type: "engine_status", status: dmxEngine.getStatus() });
      break;
    }

    default:
      ws.send(JSON.stringify({ type: "error", message: `Unknown message type: ${msg.type}` }));
  }
}

async function setFixtureParams(
  fixtureId: string,
  params: Record<string, number>
): Promise<void> {
  const { prisma } = await import("./db");
  const fixture = await prisma.fixtureInstance.findUnique({
    where: { id: fixtureId },
    include: { profile: true },
  });
  if (!fixture) return;

  const channels: Record<string, number> = {};
  const profileChannels = JSON.parse(fixture.profile.channels) as Array<{
    name: string;
    capability: string;
  }>;
  const modeChannels = (() => {
    try {
      const modes = JSON.parse(fixture.profile.modes);
      const mode = modes[fixture.modeIndex];
      return mode ? mode.channels : profileChannels.map((c: { name: string }) => c.name);
    } catch {
      return profileChannels.map((c: { name: string }) => c.name);
    }
  })();

  for (let i = 0; i < modeChannels.length; i++) {
    const channelName = modeChannels[i];
    const channelDef = profileChannels.find((c) => c.name === channelName);
    if (!channelDef) continue;
    if (params[channelDef.capability] !== undefined) {
      const address = fixture.startAddress + i;
      channels[address] = params[channelDef.capability];
    }
  }
  universe.setChannels(channels);
}

async function recallScene(sceneId: string, fadeMs: number): Promise<void> {
  const { prisma } = await import("./db");
  const scene = await prisma.scene.findUnique({ where: { id: sceneId } });
  if (!scene) return;
  const values = JSON.parse(scene.values) as Record<string, number>;
  await universe.fadeToScene(values, fadeMs > 0 ? fadeMs : scene.fadeIn);
}

export function broadcast(msg: object): void {
  if (!wss) return;
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

export function getWss(): WebSocketServer | null {
  return wss;
}
