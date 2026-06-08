"use strict";

const crypto = require("crypto");
const express = require("express");

const PORT = Number(process.env.PORT) || 3847;
const PUBLIC_BASE_URL = (
  process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`
).replace(/\/+$/, "");
const BODY_LIMIT = 256 * 1024;
const TTL_MS = Number(process.env.SNAPSHOT_TTL_DAYS || 30) * 24 * 60 * 60 * 1000;

/** @type {Map<string, { id: string, snapshot: object, receivedAt: string }>} */
const snapshots = new Map();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: BODY_LIMIT }));

function generateId() {
  return crypto.randomBytes(8).toString("hex");
}

function pruneExpired() {
  if (!TTL_MS || TTL_MS <= 0) return;
  const now = Date.now();
  for (const [id, entry] of snapshots) {
    if (now - Date.parse(entry.receivedAt) > TTL_MS) {
      snapshots.delete(id);
    }
  }
}

function validateSnapshotBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be a JSON object";
  }
  if (!Array.isArray(body.players) || body.players.length === 0) {
    return "players must be a non-empty array";
  }
  for (let i = 0; i < body.players.length; i++) {
    const p = body.players[i];
    if (!p || typeof p !== "object" || Array.isArray(p)) {
      return `players[${i}] must be an object`;
    }
    if (typeof p.playerName !== "string" || p.playerName.trim() === "") {
      return `players[${i}].playerName must be a non-empty string`;
    }
    if (typeof p.civilization !== "string" || p.civilization.trim() === "") {
      return `players[${i}].civilization must be a non-empty string`;
    }
  }
  return null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMapScript(mapScript) {
  if (!mapScript) return "Unknown";
  const parts = String(mapScript).split(/[\\/]/);
  return parts[parts.length - 1] || mapScript;
}

function playerTypeLabel(player) {
  const kind = player.isHuman ? "Human" : "AI";
  return player.isAlive === false ? `${kind} (defeated)` : kind;
}

function sortPlayers(players) {
  return [...players].sort((a, b) => {
    const teamDiff = (a.team ?? 0) - (b.team ?? 0);
    if (teamDiff !== 0) return teamDiff;
    return (a.slot ?? 0) - (b.slot ?? 0);
  });
}

function groupPlayersByTeam(players) {
  const groups = new Map();
  for (const player of sortPlayers(players)) {
    const team = player.team ?? 0;
    if (!groups.has(team)) groups.set(team, []);
    groups.get(team).push(player);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}

function renderSnapshotPage(entry) {
  const { id, snapshot, receivedAt } = entry;
  const gameName = snapshot.gameName || "Untitled Game";
  const turn = snapshot.turn ?? "?";
  const mapScript = formatMapScript(snapshot.mapScript);
  const mode = snapshot.isMultiplayer ? "Multiplayer" : "Single Player";
  const viewUrl = `${PUBLIC_BASE_URL}/snapshot/${id}`;
  const ogDescription = `${mode} · Turn ${turn} · ${snapshot.players.length} players`;
  const receivedLabel = new Date(receivedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const teamSections = groupPlayersByTeam(snapshot.players)
    .map(([team, players]) => {
      const rows = players
        .map(
          (p) => `
          <tr class="${p.isAlive === false ? "defeated" : ""}">
            <td>${escapeHtml(p.playerName)}</td>
            <td>${escapeHtml(p.civilization)}</td>
            <td>${team + 1}</td>
            <td>${escapeHtml(playerTypeLabel(p))}</td>
          </tr>`
        )
        .join("");

      return `
        <section class="team-block">
          <h2>Team ${team + 1}</h2>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Civilization</th>
                <th>Team</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(gameName)} — Malros Snapshot</title>
  <meta name="description" content="${escapeHtml(ogDescription)}">
  <meta property="og:title" content="${escapeHtml(gameName)} — Malros Snapshot">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(viewUrl)}">
  <style>
    :root {
      --bg: #1a1208;
      --panel: #2a1f12;
      --border: #5c4a2a;
      --gold: #c9a227;
      --gold-dim: #8a7020;
      --text: #e8dcc8;
      --muted: #a89878;
      --defeated: #6b5a48;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Georgia, "Times New Roman", serif;
      background: linear-gradient(180deg, #120c06 0%, var(--bg) 40%, #0f0a05 100%);
      color: var(--text);
      line-height: 1.5;
    }
    .wrap {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem 1.25rem 3rem;
    }
    header {
      border-bottom: 2px solid var(--border);
      padding-bottom: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .eyebrow {
      color: var(--gold);
      font-size: 0.85rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin: 0 0 0.35rem;
    }
    h1 {
      margin: 0;
      font-size: clamp(1.6rem, 4vw, 2.2rem);
      color: var(--gold);
      font-weight: normal;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.75rem 1.5rem;
      margin-top: 1rem;
      color: var(--muted);
      font-size: 0.95rem;
    }
    .meta strong { color: var(--text); font-weight: normal; }
    .team-block {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 4px;
      margin-bottom: 1.25rem;
      overflow: hidden;
    }
    .team-block h2 {
      margin: 0;
      padding: 0.65rem 1rem;
      font-size: 1rem;
      font-weight: normal;
      color: var(--gold-dim);
      background: rgba(0, 0, 0, 0.2);
      border-bottom: 1px solid var(--border);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 0.65rem 1rem;
      text-align: left;
      border-bottom: 1px solid rgba(92, 74, 42, 0.45);
    }
    th {
      color: var(--gold-dim);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: normal;
    }
    tr:last-child td { border-bottom: none; }
    tr.defeated td {
      color: var(--defeated);
      font-style: italic;
    }
    footer {
      margin-top: 2rem;
      color: var(--muted);
      font-size: 0.85rem;
      text-align: center;
    }
    a { color: var(--gold); }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <p class="eyebrow">Malros Skirmish</p>
      <h1>${escapeHtml(gameName)}</h1>
      <div class="meta">
        <div><strong>Turn</strong> ${escapeHtml(turn)}</div>
        <div><strong>Map</strong> ${escapeHtml(mapScript)}</div>
        <div><strong>Mode</strong> ${escapeHtml(mode)}</div>
        <div><strong>Received</strong> ${escapeHtml(receivedLabel)}</div>
      </div>
    </header>
    ${teamSections}
    <footer>Snapshot ID ${escapeHtml(id)}</footer>
  </div>
</body>
</html>`;
}

function renderNotFoundPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Snapshot Not Found — Malros</title>
  <style>
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #1a1208; color: #e8dcc8; font-family: Georgia, serif;
    }
    .box { text-align: center; padding: 2rem; }
    h1 { color: #c9a227; font-weight: normal; }
    p { color: #a89878; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Snapshot Not Found</h1>
    <p>This game snapshot does not exist or has expired.</p>
  </div>
</body>
</html>`;
}

app.post("/api/snapshots", (req, res) => {
  pruneExpired();

  const validationError = validateSnapshotBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const id = generateId();
  const receivedAt = new Date().toISOString();
  snapshots.set(id, { id, snapshot: req.body, receivedAt });

  const viewUrl = `${PUBLIC_BASE_URL}/snapshot/${id}`;
  return res.status(200).json({ success: true, id, viewUrl });
});

app.get("/api/snapshots/:id", (req, res) => {
  pruneExpired();
  const entry = snapshots.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: "Snapshot not found" });
  }
  return res.status(200).json({
    id: entry.id,
    receivedAt: entry.receivedAt,
    snapshot: entry.snapshot,
  });
});

app.get("/snapshot/:id", (req, res) => {
  pruneExpired();
  const entry = snapshots.get(req.params.id);
  if (!entry) {
    return res.status(404).type("html").send(renderNotFoundPage());
  }
  return res.status(200).type("html").send(renderSnapshotPage(entry));
});

app.get("/", (_req, res) => {
  res
    .status(200)
    .type("html")
    .send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Malros Snapshot Server</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #1a1208; color: #e8dcc8; font-family: Georgia, serif; text-align: center; }
    h1 { color: #c9a227; font-weight: normal; }
    p { color: #a89878; }
    code { color: #c9a227; }
  </style>
</head>
<body>
  <div>
    <h1>Malros Snapshot Server</h1>
    <p>Upload via <code>POST /api/snapshots</code></p>
    <p>View snapshots at <code>/snapshot/{id}</code></p>
  </div>
</body>
</html>`);
});

app.use((err, _req, res, next) => {
  if (err && err.type === "entity.too.large") {
    return res.status(400).json({ error: "Request body too large" });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  return next(err);
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`Malros snapshot server listening on ${PUBLIC_BASE_URL}`);
  console.log(`  POST upload: ${PUBLIC_BASE_URL}/api/snapshots`);
  console.log(`  GET viewer:  ${PUBLIC_BASE_URL}/snapshot/{id}`);
});
