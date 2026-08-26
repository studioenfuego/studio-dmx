import dgram from "dgram";
import os from "os";

const ARTNET_PORT = 6454;
const ARTDMX_OPCODE = 0x5000;

export interface ArtNetConfig {
  host: string;
  port?: number;
  net?: number;
  subnet?: number;
  universe?: number;
}

/**
 * Find the local interface IP whose subnet contains targetHost.
 * Falls back to "0.0.0.0" if no match (lets OS decide, works for unicast).
 */
function resolveLocalAddress(targetHost: string): string {
  // Broadcast targets — let OS choose
  if (targetHost.endsWith(".255")) return "0.0.0.0";

  const targetParts = targetHost.split(".").map(Number);
  if (targetParts.length !== 4 || targetParts.some(isNaN)) return "0.0.0.0";

  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family !== "IPv4" || addr.internal) continue;
      const localParts = addr.address.split(".").map(Number);
      const maskParts = addr.netmask.split(".").map(Number);
      const inSubnet = maskParts.every(
        (mask, i) => (localParts[i] & mask) === (targetParts[i] & mask)
      );
      if (inSubnet) return addr.address;
    }
  }
  return "0.0.0.0";
}

export class ArtNetOutput {
  private socket: dgram.Socket;
  private config: Required<ArtNetConfig>;
  private sequence = 0;
  private connected = false;
  private _packetsSent = 0;
  private _localAddress = "0.0.0.0";

  constructor(config: ArtNetConfig) {
    this.config = {
      host: config.host,
      port: config.port ?? ARTNET_PORT,
      net: config.net ?? 0,
      subnet: config.subnet ?? 0,
      universe: config.universe ?? 0,
    };
    this.socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    this.socket.on("error", (err) => {
      console.error("[ArtNet] Socket error:", err.message);
    });

    // Art-Net spec: source port must be 6454. Bind to the specific local
    // interface that can reach the target so routing is unambiguous.
    const localAddr = resolveLocalAddress(this.config.host);
    this._localAddress = localAddr;
    this.socket.bind({ port: ARTNET_PORT, address: localAddr }, () => {
        try {
          this.socket.setBroadcast(true);
          this.connected = true;
          console.log(`[ArtNet] Bound to ${localAddr}:${ARTNET_PORT} → ${this.config.host}`);
        } catch (e) {
          console.error("[ArtNet] setBroadcast failed:", e);
          this.connected = true; // still try to send unicast
        }
      });
  }

  send(channels: number[]): void {
    if (!this.connected) return;
    const packet = this.buildArtDmxPacket(channels);
    this.socket.send(packet, 0, packet.length, this.config.port, this.config.host, (err) => {
      if (err) console.error("[ArtNet] Send error:", err.message);
      else this._packetsSent++;
    });
  }

  get packetsSent(): number { return this._packetsSent; }
  get localAddress(): string { return this._localAddress; }
  get targetHost(): string { return this.config.host; }

  private buildArtDmxPacket(channels: number[]): Buffer {
    const dmxData = Buffer.from(channels.slice(0, 512));
    const length = dmxData.length;
    const packet = Buffer.alloc(18 + length);

    packet.write("Art-Net\0", 0, "ascii");
    packet.writeUInt16LE(ARTDMX_OPCODE, 8);
    packet.writeUInt8(0x00, 10);
    packet.writeUInt8(14, 11);

    this.sequence = (this.sequence + 1) % 256;
    if (this.sequence === 0) this.sequence = 1;
    packet.writeUInt8(this.sequence, 12);
    packet.writeUInt8(0, 13);

    const universe =
      (this.config.net << 8) |
      (this.config.subnet << 4) |
      this.config.universe;
    packet.writeUInt16LE(universe, 14);
    packet.writeUInt16BE(length, 16);
    dmxData.copy(packet, 18);

    return packet;
  }

  isConnected(): boolean {
    return this.connected;
  }

  destroy(): void {
    try { this.socket.close(); } catch { /* already closed */ }
    this.connected = false;
  }
}

export default ArtNetOutput;
