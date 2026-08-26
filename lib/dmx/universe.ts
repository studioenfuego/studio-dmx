const CHANNEL_COUNT = 512;

class UniverseState {
  private channels: number[] = new Array(CHANNEL_COUNT).fill(0);
  private grandMaster = 255;
  private dimmerChannels: Set<number> = new Set(); // 1-indexed addresses that GM should scale
  private listeners: Set<(channels: number[]) => void> = new Set();

  setDimmerChannels(addresses: number[]): void {
    this.dimmerChannels = new Set(addresses);
  }

  getChannels(): number[] {
    return [...this.channels];
  }

  getChannel(address: number): number {
    if (address < 1 || address > CHANNEL_COUNT) return 0;
    return this.channels[address - 1];
  }

  setChannel(address: number, value: number): void {
    if (address < 1 || address > CHANNEL_COUNT) return;
    this.channels[address - 1] = Math.max(0, Math.min(255, Math.round(value)));
    this.notifyListeners();
  }

  setChannels(values: Record<string | number, number>): void {
    for (const [addr, val] of Object.entries(values)) {
      const address = parseInt(addr, 10);
      if (address >= 1 && address <= CHANNEL_COUNT) {
        this.channels[address - 1] = Math.max(0, Math.min(255, Math.round(val)));
      }
    }
    this.notifyListeners();
  }

  setChannelArray(values: number[]): void {
    for (let i = 0; i < Math.min(values.length, CHANNEL_COUNT); i++) {
      this.channels[i] = Math.max(0, Math.min(255, Math.round(values[i])));
    }
    this.notifyListeners();
  }

  getGrandMaster(): number {
    return this.grandMaster;
  }

  setGrandMaster(value: number): void {
    this.grandMaster = Math.max(0, Math.min(255, Math.round(value)));
    this.notifyListeners();
  }

  getOutputChannels(): number[] {
    const gm = this.grandMaster / 255;
    // If no dimmer channels registered yet, scale everything (legacy/safe fallback)
    if (this.dimmerChannels.size === 0) {
      return this.channels.map((v) => Math.round(v * gm));
    }
    return this.channels.map((v, i) =>
      this.dimmerChannels.has(i + 1) ? Math.round(v * gm) : v
    );
  }

  blackout(): void {
    this.channels = new Array(CHANNEL_COUNT).fill(0);
    this.notifyListeners();
  }

  async fadeToScene(
    targetValues: Record<string, number>,
    fadeMs: number
  ): Promise<void> {
    if (fadeMs <= 0) {
      this.setChannels(targetValues);
      return;
    }
    const start = Date.now();
    const startValues = [...this.channels];
    const target = new Array(CHANNEL_COUNT).fill(0);
    for (const [addr, val] of Object.entries(targetValues)) {
      const a = parseInt(addr, 10);
      if (a >= 1 && a <= CHANNEL_COUNT) target[a - 1] = val;
    }

    return new Promise((resolve) => {
      const tick = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / fadeMs, 1);
        for (let i = 0; i < CHANNEL_COUNT; i++) {
          this.channels[i] = Math.round(
            startValues[i] + (target[i] - startValues[i]) * progress
          );
        }
        this.notifyListeners();
        if (progress < 1) {
          setTimeout(tick, 16);
        } else {
          resolve();
        }
      };
      tick();
    });
  }

  onChange(listener: (channels: number[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const channels = this.getChannels();
    this.listeners.forEach((l) => l(channels));
  }
}

const globalForUniverse = globalThis as unknown as {
  dmxUniverse: UniverseState;
};

export const universe =
  globalForUniverse.dmxUniverse || new UniverseState();

if (process.env.NODE_ENV !== "production") {
  globalForUniverse.dmxUniverse = universe;
}

export default universe;
