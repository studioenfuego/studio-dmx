import { createServer } from "http";
import next from "next";
import { initWebSocketServer, handleWsUpgrade } from "./lib/wsServer";
import { dmxEngine } from "./lib/dmx/engine";
import { universe } from "./lib/dmx/universe";
import { initUniversePersistence } from "./lib/dmx/persist";
import { prisma } from "./lib/db";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const settings = await prisma.settings
    .findUnique({ where: { id: "singleton" } })
    .catch(() => null);

  // Restore persisted universe state before the engine starts sending
  if (settings) {
    try {
      const saved = JSON.parse(settings.universeChannels ?? "[]") as number[];
      if (Array.isArray(saved) && saved.length > 0) {
        universe.setChannelArray(saved);
        console.log("[DMX] Restored universe state from database");
      }
    } catch { /* ignore corrupt data */ }
    universe.setGrandMaster(settings.grandMaster ?? 255);
  }

  const upgradeHandler = app.getUpgradeHandler();

  const server = createServer((req, res) => {
    handle(req, res);
  });

  server.on("upgrade", (req, socket, head) => {
    if (req.url === "/ws") {
      handleWsUpgrade(req, socket, head);
    } else {
      upgradeHandler(req, socket, head);
    }
  });

  initWebSocketServer();
  initUniversePersistence();

  dmxEngine.start({
    outputMode: (settings?.dmxInterface ?? "artnet") as "artnet" | "enttec",
    host: settings?.artnetHost ?? "192.168.1.255",
    port: settings?.artnetPort ?? 6454,
    net: settings?.artnetNet ?? 0,
    subnet: settings?.artnetSubnet ?? 0,
    universe: settings?.artnetUniverse ?? 0,
    enttecPort: settings?.enttecPort ?? undefined,
  });

  server.listen(port, () => {
    console.log(`> Studio DMX ready on http://localhost:${port}`);
    console.log(`> WebSocket available on ws://localhost:${port}/ws`);
  });
});
