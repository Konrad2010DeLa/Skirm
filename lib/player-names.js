"use strict";

// Edit config/player-aliases.json to map alternate names to a canonical display name.
// Keys are matched case-insensitively. Stored snapshots are not modified.
const rawAliases = require("../config/player-aliases.json");

const MILESTONE_PLAYER_KEYS = [
  "maxProductionAt80Player",
  "maxProductionAt100Player",
  "maxProductionAt120Player",
];

let normalizedAliasMap = null;

function normalizePlayerName(name) {
  return String(name || "").trim().toLowerCase();
}

function buildNormalizedAliasMap(aliases) {
  const map = new Map();
  Object.keys(aliases || {}).forEach(function (from) {
    if (from.charAt(0) === "_") return;
    const to = aliases[from];
    if (typeof to !== "string" || to.trim() === "") return;
    map.set(normalizePlayerName(from), to.trim());
  });
  return map;
}

function getAliasMap() {
  if (!normalizedAliasMap) {
    normalizedAliasMap = buildNormalizedAliasMap(rawAliases);
  }
  return normalizedAliasMap;
}

function resolvePlayerName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return trimmed;
  const canonical = getAliasMap().get(normalizePlayerName(trimmed));
  return canonical || trimmed;
}

function applyPlayerAliasesToSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return snapshot;
  const out = Object.assign({}, snapshot);
  if (Array.isArray(out.players)) {
    out.players = out.players.map(function (player) {
      if (!player || typeof player !== "object") return player;
      return Object.assign({}, player, {
        playerName: resolvePlayerName(player.playerName),
      });
    });
  }
  if (out.milestones && typeof out.milestones === "object") {
    out.milestones = Object.assign({}, out.milestones);
    MILESTONE_PLAYER_KEYS.forEach(function (key) {
      if (out.milestones[key]) {
        out.milestones[key] = resolvePlayerName(out.milestones[key]);
      }
    });
  }
  return out;
}

module.exports = {
  normalizePlayerName: normalizePlayerName,
  resolvePlayerName: resolvePlayerName,
  applyPlayerAliasesToSnapshot: applyPlayerAliasesToSnapshot,
};
