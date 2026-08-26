import { universe } from "./universe";
import { ArtNetOutput } from "./artnet";
import { EnttecOutput } from "./enttec";

const DMX_REFRESH_HZ = 40;
const DMX_INTERVAL_MS = Math.round(1000 / DMX_REFRESH_HZ);

export type DMXOutputMode = "artnet" | "enttec";

export interface DMXEngineConfig {
  outputMode?: DMXOutputMode;
  // Art-Net
  host?: string;
  port?: number;
  net?: number;
  subnet?: number;
  universe?: number;
  // Enttec
  enttecPort?: string;
}

class DMXEngine {
  private artnet: ArtNetOutput | null = null;
  private enttec: EnttecOutput | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private outputEnabled = true;
  private config: DMXEngineConfig = {
    outputMode: "artnet",
    host: "192.168.1.255",
  };
  private status: "stopped" | "running" | "error" = "stopped";
  private statusMessage = "";

  async start(config?: DMXEngineConfig): Promise<void> {
    if (config) this.config = { ...this.config, ...config };
    await this.stop();

    const mode = this.config.outputMode ?? "artnet";

    if (mode === "enttec") {
      if (!this.config.enttecPort) {
        this.status = "error";
        this.statusMessage = "No Enttec port configured";
        console.error("[DMXEngine] No Enttec port configured");
        return;
      }
      try {
        this.enttec = new EnttecOutput(this.config.enttecPort);
        await this.enttec.open();
        console.log(`[DMXEngine] Enttec output on ${this.config.enttecPort} at ${DMX_REFRESH_HZ}Hz`);
      } catch (err) {
        this.status = "error";
        this.statusMessage = err instanceof Error ? err.message : String(err);
        console.error("[DMXEngine] Failed to open Enttec port:", this.statusMessage);
        this.enttec = null;
        return;
      }
    } else {
      this.artnet = new ArtNetOutput({
        host: this.config.host ?? "192.168.1.255",
        port: this.config.port,
        net: this.config.net,
        subnet: this.config.subnet,
        universe: this.config.universe,
      });
      console.log(`[DMXEngine] Art-Net output to ${this.config.host} at ${DMX_REFRESH_HZ}Hz`);
    }

    this.status = "running";
    this.statusMessage = "";

    this.interval = setInterval(() => {
      if (!this.outputEnabled) return;
      const channels = universe.getOutputChannels();
      if (mode === "enttec" && this.enttec?.isOpen) {
        this.enttec.send(channels);
      } else if (mode === "artnet" && this.artnet) {
        this.artnet.send(channels);
      }
    }, DMX_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.artnet) {
      this.artnet.destroy();
      this.artnet = null;
    }
    if (this.enttec) {
      await this.enttec.close();
      this.enttec = null;
    }
    this.status = "stopped";
  }

  setEnabled(enabled: boolean): void {
    this.outputEnabled = enabled;
  }

  isRunning(): boolean {
    return this.interval !== null;
  }

  getStatus(): {
    running: boolean;
    status: string;
    message: string;
    outputMode: string;
    host?: string;
    enttecPort?: string;
    enabled: boolean;
    packetsSent: number;
    localAddress?: string;
  } {
    return {
      running: this.isRunning(),
      status: this.status,
      message: this.statusMessage,
      outputMode: this.config.outputMode ?? "artnet",
      host: this.config.host,
      enttecPort: this.config.enttecPort,
      enabled: this.outputEnabled,
      packetsSent: this.artnet?.packetsSent ?? 0,
      localAddress: this.artnet?.localAddress,
    };
  }

  async updateConfig(config: Partial<DMXEngineConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    if (this.isRunning()) {
      await this.start(this.config);
    }
  }
}

const globalForEngine = globalThis as unknown as { dmxEngine: DMXEngine };
export const dmxEngine = globalForEngine.dmxEngine || new DMXEngine();
if (process.env.NODE_ENV !== "production") {
  globalForEngine.dmxEngine = dmxEngine;
}

export default dmxEngine;
