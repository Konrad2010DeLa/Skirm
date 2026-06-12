"use strict";

const path = require("path");
const express = require("express");
const {
  BODY_LIMIT,
  getPublicBaseUrl,
  resolveSnapshotId,
  validateSnapshotBody,
  buildMatchSummary,
  dedupeSnapshotsByGameId,
  renderNotFoundPage,
} = require("./lib/snapshot-core");
const { applyPlayerAliasesToSnapshot } = require("./lib/player-names");

const PORT = Number(process.env.PORT) || 3847;
const PUBLIC_BASE_URL = getPublicBaseUrl();
const TTL_MS = Number(process.env.SNAPSHOT_TTL_DAYS || 30) * 24 * 60 * 60 * 1000;

/** @type {Map<string, { id: string, snapshot: object, receivedAt: string }>} */
const snapshots = new Map();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.static(path.join(__dirname, "public")));

function pruneExpired() {
  if (!TTL_MS || TTL_MS <= 0) return;
  const now = Date.now();
  for (const [id, entry] of snapshots) {
    if (now - Date.parse(entry.receivedAt) > TTL_MS) {
      snapshots.delete(id);
    }
  }
}

function listLocalSnapshots() {
  pruneExpired();
  return dedupeSnapshotsByGameId(Array.from(snapshots.values()));
}

app.post("/api/snapshots", (req, res) => {
  pruneExpired();

  const validationError = validateSnapshotBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const id = resolveSnapshotId(req.body);
  const viewUrl = `${PUBLIC_BASE_URL}/snapshot/${id}`;
  if (snapshots.has(id)) {
    return res.status(200).json({ success: true, id, viewUrl, duplicate: true });
  }

  const receivedAt = new Date().toISOString();
  snapshots.set(id, { id, snapshot: req.body, receivedAt });
  return res.status(200).json({ success: true, id, viewUrl });
});

app.get("/api/snapshots", (_req, res) => {
  const matches = listLocalSnapshots().map(buildMatchSummary);
  return res.status(200).json({ matches });
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
    snapshot: applyPlayerAliasesToSnapshot(entry.snapshot),
  });
});

app.get("/snapshot/:id", (req, res) => {
  pruneExpired();
  const entry = snapshots.get(req.params.id);
  if (!entry) {
    return res.status(404).type("html").send(renderNotFoundPage());
  }
  return res.redirect(302, `/?match=${encodeURIComponent(req.params.id)}`);
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
  console.log(`  GET matches: ${PUBLIC_BASE_URL}/api/snapshots`);
  console.log(`  GET viewer:  ${PUBLIC_BASE_URL}/snapshot/{id}`);
});
