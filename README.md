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
- **[Bitfocus Companion module](https://github.com/studioenfuego/companion-module-studio-dmx)** — first-class Stream Deck integration with actions, feedbacks, and live variables
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

## Bitfocus Companion Integration

Studio DMX has a first-class [Bitfocus Companion](https://bitfocus.io/companion) module at **[studioenfuego/companion-module-studio-dmx](https://github.com/studioenfuego/companion-module-studio-dmx)**. Use it to control your lighting rig from a Stream Deck, Stream Deck+, or any other surface Companion supports.

### Installing in Companion 5.x

1. Download the latest `companion-module-studio-dmx-*.tgz` from the [releases page](https://github.com/studioenfuego/companion-module-studio-dmx/releases)
2. Open Companion in your browser (default: `http://localhost:8000`)
3. Go to **Settings → Manage Modules**
4. Click **Import module package** and select the downloaded `.tgz`
4. Go to **Connections → Add connection**, search for **Studio DMX**, and add it
5. Set **Host** to your Studio DMX server's IP (or `localhost` if Companion runs on the same machine) and **Port** to match your server's port (default `3333`)
6. The connection status should turn green — the module polls `/api/v1/state` every 5 seconds

> **After any module changes**: run `npm run package` again in `companion-module/`, then re-import the `.tgz` via **Import module package**.

### Actions

| Action | Description |
|--------|-------------|
| **Recall Scene** | Recall a scene by name with optional fade time (ms) |
| **Set Fixture Dimmer** | Set a fixture's dimmer to an exact % |
| **Adjust Fixture Dimmer (knob)** | Increment/decrement a fixture dimmer by ±% — assign to encoder rotate |
| **Set Grand Master** | Set grand master to an exact % |
| **Adjust Grand Master (knob)** | Increment/decrement grand master by ±% — assign to encoder rotate |
| **Set Group Level** | Set a group DCA to an exact % |
| **Adjust Group Level (knob)** | Increment/decrement a group level by ±% — assign to encoder rotate |
| **Blackout** | Toggle grand master to 0 |

### Feedbacks

| Feedback | Description |
|----------|-------------|
| **Fixture is On** | Button lights green when a fixture dimmer is at or above a threshold % |
| **Grand Master at level** | Button lights blue when grand master is at or above a threshold % |
| **Group is Active** | Button lights amber when a group level is at or above a threshold % |

### Variables

Variables update every 5 seconds (or immediately after any action). Replace `StudioDMX` with your connection label as set in Companion.

| Variable | Description |
|----------|-------------|
| `$(StudioDMX:grand_master_percent)` | Grand master level 0–100 |
| `$(StudioDMX:grand_master_value)` | Grand master raw value 0–255 |
| `$(StudioDMX:fixture_<name>_dimmer_percent)` | Fixture dimmer %, where `<name>` is the fixture name slugified (lowercase, spaces → `_`) |
| `$(StudioDMX:group_<name>_level_percent)` | Group level %, same slugification |

Example: a fixture named `"Front Wash"` → `$(StudioDMX:fixture_front_wash_dimmer_percent)`

### Stream Deck+ knob setup

1. Add a button and switch it to **Encoder** mode
2. **Rotate clockwise** → Studio DMX → **Adjust Grand Master (knob)** → Step: `5`
3. **Rotate counter-clockwise** → same action → Step: `-5`
4. Set the button label to `GM $(StudioDMX:grand_master_percent)%` for a live readout

Tune the step size to taste — `2` for fine control, `10` for coarse.

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
