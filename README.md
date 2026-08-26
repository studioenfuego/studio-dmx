# Studio DMX

A browser-based DMX lighting controller built for real studio use. Control fixtures over Art-Net (network) or directly via a USB Enttec DMX interface, from any device on your local network — phone, tablet, or desktop.

## Features

- **Fader board** — per-fixture dimmer faders with drag-to-reorder, group DCA faders, grand master, and blackout
- **Channel breakout** — expand any fixture to individual per-channel faders
- **Inspector panel** — full fixture control (dimmer, CCT/Kelvin, RGB, green offset, crossfade, fan) with on-screen numpad
- **Scenes & presets** — capture and recall full universe snapshots with fade times
- **Stage view** — visual overhead layout of your rig with draggable fixture icons
- **Routing/patching** — add fixtures from the Open Fixture Library, assign DMX addresses
- **Art-Net output** — unicast or broadcast to any Art-Net node on your network
- **Enttec USB DMX** — direct USB output via Enttec DMX USB PRO Mk2/Mk3
- **WebSocket API** — real-time control from external tools (Bitfocus Companion, custom scripts)
- **Mobile-friendly** — responsive layout tested on iPad and iPhone

## Requirements

- Node.js 20+
- npm
- A DMX interface: any Art-Net node (e.g. Entec ODE, Luminex), or an Enttec DMX USB PRO plugged in via USB

## Getting Started

```bash
# 1. Clone and install dependencies
git clone https://github.com/your-username/studio-dmx.git
cd studio-dmx
npm install

# 2. Set up the database
cp .env.example .env
npx prisma migrate dev

# 3. Start the server
npm run dev
```

Open **http://localhost:3000** in your browser.

> **Accessing from another device on your network** (phone, tablet): find your machine's local IP (`ip addr` / `ifconfig`), then open `http://<your-ip>:3000`. Add that IP to `allowedDevOrigins` in `next.config.ts` so Next.js allows the connection.

## Configuration

### DMX Output

Go to **Settings** in the sidebar after the app is running.

| Mode | When to use |
|------|-------------|
| Art-Net (Network) | Sending DMX over Ethernet/Wi-Fi to a node (default, broadcast to `x.x.x.255`) |
| USB DMX (Enttec) | Direct USB connection via Enttec DMX USB PRO Mk2/Mk3 |

For Art-Net, set the **Host / IP** to your node's broadcast address (e.g. `10.0.1.255`) or its specific unicast IP. Universe 0 is the default — check your node's own config panel if lights don't respond after connecting.

### Port

The server runs on port **3000** by default. Override with the `PORT` environment variable:

```bash
PORT=3333 npm run dev
```

### Running as a service (macOS)

To keep the server running in the background and start on login, create a launchd plist at `~/Library/LaunchAgents/com.studiodmx.server.plist`. Example:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.studiodmx.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/studio-dmx/node_modules/.bin/tsx</string>
    <string>/path/to/studio-dmx/server.ts</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>
    <string>3000</string>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
```

Load it with: `launchctl load ~/Library/LaunchAgents/com.studiodmx.server.plist`

## WebSocket API

Connect to `ws://localhost:3000/ws` for real-time control.

**Send a message:**
```json
{ "type": "set_channels", "channels": { "1": 255, "2": 128 } }
{ "type": "grand_master", "value": 200 }
{ "type": "recall_scene", "sceneId": "<id>", "fadeTime": 2000 }
{ "type": "engine_start", "config": { "outputMode": "artnet", "host": "10.0.1.255" } }
{ "type": "engine_stop" }
```

**Receive:**
```json
{ "type": "state", "channels": [...512 values...], "grandMaster": 255 }
{ "type": "engine_status", "status": { "running": true, "packetsSent": 1234 } }
```

## HTTP REST API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/universe` | Read all 512 channel values |
| POST | `/api/v1/universe` | Set channels `{ "channels": { "1": 255 } }` |
| GET | `/api/v1/fixtures` | List patched fixtures |
| GET | `/api/v1/scenes` | List scenes |
| POST | `/api/v1/scenes/:id/recall` | Recall a scene |
| GET | `/api/v1/settings` | Read DMX output settings |
| POST | `/api/v1/settings` | Update DMX output settings |
| GET | `/api/v1/dmx-status` | Engine status + network interfaces |
| GET | `/api/v1/ports` | List available USB serial ports |

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19
- [Prisma 7](https://prisma.io) with SQLite
- Custom WebSocket server (`ws`) + Art-Net UDP output
- [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Zustand](https://zustand-demo.pmnd.rs) for client state
- [@dnd-kit](https://dndkit.com) for drag-and-drop
- [Open Fixture Library](https://open-fixture-library.org) fixture profiles

## Contributing

Issues and PRs welcome. To run locally, follow the Getting Started steps above. The app uses a custom Node.js server (`server.ts`) rather than `next dev` directly — always start it with `npm run dev`.

Database schema changes: use `npx prisma migrate dev --name <description>` (not `prisma db push`) so migrations are tracked.

## License

MIT
