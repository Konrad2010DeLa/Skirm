"use strict";

const crypto = require("crypto");
const { applyPlayerAliasesToSnapshot } = require("./player-names");

const BODY_LIMIT = 256 * 1024;

function getPublicBaseUrl() {
  const raw =
    process.env["PUBLIC_BASE_URL"] ||
    process.env["URL"] ||
    process.env["DEPLOY_PRIME_URL"] ||
    "http://127.0.0.1:3847";
  return raw.replace(/\/+$/, "");
}

function generateId() {
  return crypto.randomBytes(8).toString("hex");
}

function resolveSnapshotId(body) {
  if (typeof body.gameId === "string" && /^[a-f0-9]{16}$/i.test(body.gameId)) {
    return body.gameId.toLowerCase();
  }
  return generateId();
}

function validateSnapshotBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be a JSON object";
  }
  if (typeof body.gameId !== "string" || !/^[a-f0-9]{16}$/i.test(body.gameId)) {
    return "gameId must be a 16-character hex string";
  }
  if (!Array.isArray(body.players) || body.players.length === 0) {
    return "players must be a non-empty array";
  }
  for (let i = 0; i < body.players.length; i++) {
    const p = body.players[i];
    if (!p || typeof p !== "object" || Array.isArray(p)) {
      return "players[" + i + "] must be an object";
    }
    if (typeof p.playerName !== "string" || p.playerName.trim() === "") {
      return "players[" + i + "].playerName must be a non-empty string";
    }
    if (typeof p.civilization !== "string" || p.civilization.trim() === "") {
      return "players[" + i + "].civilization must be a non-empty string";
    }
  }
  return null;
}

function parseJsonBody(rawBody) {
  if (rawBody == null || rawBody === "") {
    return { error: "Request body must be a JSON object" };
  }
  if (typeof rawBody === "object") {
    return { body: rawBody };
  }
  if (Buffer.byteLength(rawBody, "utf8") > BODY_LIMIT) {
    return { error: "Request body too large" };
  }
  try {
    return { body: JSON.parse(rawBody) };
  } catch (e) {
    return { error: "Invalid JSON body" };
  }
}

function formatMapScript(mapScript) {
  if (!mapScript) return "Unknown";
  const parts = String(mapScript).split(/[\\/]/);
  return parts[parts.length - 1] || mapScript;
}

function getSnapshotGameId(entry) {
  const raw = entry.snapshot && entry.snapshot.gameId ? entry.snapshot.gameId : entry.id;
  return String(raw).toLowerCase();
}

function inferMatchFormat(players) {
  if (!Array.isArray(players) || players.length === 0) return "?";
  const teamCounts = new Map();
  players.forEach(function (player) {
    const team = player.team != null ? player.team : 0;
    teamCounts.set(team, (teamCounts.get(team) || 0) + 1);
  });
  return Array.from(teamCounts.values())
    .sort(function (a, b) {
      return b - a;
    })
    .join("v");
}

function formatWinnerLabel(snapshot) {
  if (!snapshot || snapshot.winnerTeam == null || snapshot.winnerTeam < 0) {
    return "Scrapped";
  }
  return "Team " + (snapshot.winnerTeam + 1);
}

function buildMatchSummary(entry) {
  const snapshot = applyPlayerAliasesToSnapshot(entry.snapshot || {});
  return {
    id: entry.id,
    gameId: getSnapshotGameId(entry),
    receivedAt: entry.receivedAt,
    turn: snapshot.turn != null ? snapshot.turn : null,
    mapScript: formatMapScript(snapshot.mapScript),
    format: inferMatchFormat(snapshot.players),
    winner: formatWinnerLabel(snapshot),
    winnerTeam: snapshot.winnerTeam != null ? snapshot.winnerTeam : null,
    isMultiplayer: !!snapshot.isMultiplayer,
    playerCount: Array.isArray(snapshot.players) ? snapshot.players.length : 0,
    snapshot: snapshot,
  };
}

function dedupeSnapshotsByGameId(entries) {
  const seen = new Set();
  const sorted = entries.slice().sort(function (a, b) {
    return Date.parse(a.receivedAt) - Date.parse(b.receivedAt);
  });
  const deduped = [];
  sorted.forEach(function (entry) {
    const gameId = getSnapshotGameId(entry);
    if (seen.has(gameId)) return;
    seen.add(gameId);
    deduped.push(entry);
  });
  return deduped.reverse();
}

module.exports = {
  BODY_LIMIT: BODY_LIMIT,
  getPublicBaseUrl: getPublicBaseUrl,
  generateId: generateId,
  resolveSnapshotId: resolveSnapshotId,
  validateSnapshotBody: validateSnapshotBody,
  parseJsonBody: parseJsonBody,
  formatMapScript: formatMapScript,
  getSnapshotGameId: getSnapshotGameId,
  inferMatchFormat: inferMatchFormat,
  formatWinnerLabel: formatWinnerLabel,
  buildMatchSummary: buildMatchSummary,
  dedupeSnapshotsByGameId: dedupeSnapshotsByGameId,
};
