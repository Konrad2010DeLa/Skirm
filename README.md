# Malros Game Snapshot Server

API and public viewer for Civilization V Malros Skirmish minimap snapshot uploads.

## Quick start (local dev)

```bash
cd Web/GameSnapshotServer
npm install
npm start
```

Server runs at `http://127.0.0.1:3847` by default.

The mod's default upload URL (`UI/MiniMap/MiniMapPanel.lua`) already points here:

```
http://127.0.0.1:3847/api/snapshots
```

## Test upload

```bash
curl -X POST http://127.0.0.1:3847/api/snapshots \
  -H "Content-Type: application/json" \
  -d '{
    "mod":"Malros",
    "turn":10,
    "gameName":"Test Lobby",
    "mapScript":"TestMap.lua",
    "optionsChecksum":12345,
    "isMultiplayer":true,
    "players":[
      {"slot":0,"team":0,"playerName":"Alice","civilization":"Rome","leader":"Augustus","isHuman":true,"isAlive":true},
      {"slot":1,"team":1,"playerName":"Bob","civilization":"Greece","leader":"Alexander","isHuman":true,"isAlive":true}
    ]
  }'
```

Open the `viewUrl` from the response in a browser.

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/snapshots` | Upload snapshot JSON; returns `{ success, id, viewUrl }` |
| `GET` | `/snapshot/:id` | HTML viewer page |
| `GET` | `/api/snapshots/:id` | JSON mirror of stored snapshot |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3847` | Listen port |
| `PUBLIC_BASE_URL` | `http://127.0.0.1:{PORT}` | Base URL embedded in `viewUrl` (must match what players can open) |
| `SNAPSHOT_TTL_DAYS` | `0` | Days before snapshots expire (`0` = no expiry / keep all) |

## Production deployment

1. Deploy this Node app to any host (VPS, Railway, Render, Fly.io, etc.).
2. Put HTTPS in front (reverse proxy or platform TLS).
3. Set `PUBLIC_BASE_URL` to your public origin, e.g. `https://snapshots.example.com`.
4. Update the mod upload URL in `UI/MiniMap/MiniMapPanel.lua`:

```lua
local SKIRM_GAME_SNAPSHOT_UPLOAD_URL = "https://snapshots.example.com/api/snapshots";
```

5. Rebuild the DLL with `SKIRM_GAME_SNAPSHOT_UPLOAD` defined.

**Note:** In-memory storage resets on restart. For production persistence, swap the `Map` in `server.js` for Redis, SQLite, or a hosted KV store.

### Example: Railway / Render

- Build command: `npm install`
- Start command: `npm start`
- Set `PUBLIC_BASE_URL=https://your-app.example.com`

### Example: systemd on a VPS

```ini
[Service]
Environment=PORT=3847
Environment=PUBLIC_BASE_URL=https://snapshots.example.com
ExecStart=/usr/bin/node /opt/malros-snapshot/server.js
WorkingDirectory=/opt/malros-snapshot
```

Put nginx or Caddy in front for TLS and proxy to port 3847.
