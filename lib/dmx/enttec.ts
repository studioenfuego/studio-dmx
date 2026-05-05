import { SerialPort } from "serialport";

// Enttec DMX USB PRO protocol constants
const START_BYTE = 0x7e;
const END_BYTE = 0xe7;
const LABEL_DMX_OUTPUT = 6;
const DMX_START_CODE = 0x00;
const DMX_CHANNELS = 512;

export interface EnttecPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

export async function listEnttecPorts(): Promise<EnttecPortInfo[]> {
  const ports = await SerialPort.list();
  // Return all serial ports; highlight likely Enttec devices
  return ports.map((p) => ({
    path: p.path,
    manufacturer: p.manufacturer,
    serialNumber: p.serialNumber,
    vendorId: p.vendorId,
    productId: p.productId,
  }));
}

export class EnttecOutput {
  private port: SerialPort | null = null;
  private portPath: string;
  private _isOpen = false;

  constructor(portPath: string) {
    this.portPath = portPath;
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.port = new SerialPort(
        { path: this.portPath, baudRate: 57600, autoOpen: false },
        (err) => { if (err) reject(err); }
      );

      this.port.open((err) => {
        if (err) {
          reject(new Error(`Cannot open ${this.portPath}: ${err.message}`));
          return;
        }
        this._isOpen = true;
        console.log(`[Enttec] Opened ${this.portPath}`);
        resolve();
      });

      this.port.on("error", (err) => {
        console.error("[Enttec] Serial error:", err.message);
        this._isOpen = false;
      });

      this.port.on("close", () => {
        console.log("[Enttec] Port closed");
        this._isOpen = false;
      });
    });
  }

  send(channels: number[]): void {
    if (!this._isOpen || !this.port) return;

    // Data = start code (0x00) + up to 512 channel values
    const dmxData = channels.slice(0, DMX_CHANNELS);
    const dataLength = dmxData.length + 1; // +1 for start code

    const packet = Buffer.allocUnsafe(4 + dataLength + 1);
    let offset = 0;

    packet[offset++] = START_BYTE;
    packet[offset++] = LABEL_DMX_OUTPUT;
    packet[offset++] = dataLength & 0xff;        // length LSB
    packet[offset++] = (dataLength >> 8) & 0xff; // length MSB
    packet[offset++] = DMX_START_CODE;

    for (let i = 0; i < dmxData.length; i++) {
      packet[offset++] = dmxData[i] & 0xff;
    }
    packet[offset++] = END_BYTE;

    this.port.write(packet, (err) => {
      if (err) console.error("[Enttec] Write error:", err.message);
    });
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.port || !this._isOpen) {
        resolve();
        return;
      }
      this.port.close(() => {
        this._isOpen = false;
        this.port = null;
        resolve();
      });
    });
  }
}
