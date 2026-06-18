"use strict";

const ELO_START = 1500;
const ELO_K = 32;
const SKIRM_FORMATS = ["1v1", "2v2", "3v3", "4v4"];

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function normalizePlayerName(name) {
  return String(name || "").trim().toLowerCase();
}

function isHumanPlayer(player) {
  if (player.isHuman === false || player.isHuman === 0) return false;
  return typeof player.playerName === "string" && player.playerName.trim() !== "";
}

function isRatedMatch(match, skirmFormats) {
  const snapshot = match.snapshot || {};
  if (!match.isMultiplayer) return false;
  if (snapshot.winnerTeam == null || snapshot.winnerTeam < 0) return false;
  const format = match.format || "";
  return skirmFormats.indexOf(format) !== -1;
}

function getRating(ratings, key) {
  return ratings.has(key) ? ratings.get(key) : ELO_START;
}

function averageRating(ratings, keys) {
  if (!keys.length) return ELO_START;
  let sum = 0;
  keys.forEach(function (key) {
    sum += getRating(ratings, key);
  });
  return sum / keys.length;
}

function getTeamsFromMatch(match) {
  const teams = new Map();
  (match.snapshot.players || []).forEach(function (player) {
    if (!isHumanPlayer(player)) return;
    const key = normalizePlayerName(player.playerName);
    if (!key) return;
    const team = player.team != null ? player.team : 0;
    if (!teams.has(team)) teams.set(team, []);
    teams.get(team).push({ key: key, name: player.playerName.trim(), team: team });
  });
  return teams;
}

function createRatingPools(formats) {
  const pools = { overall: new Map() };
  formats.forEach(function (format) {
    pools[format] = new Map();
  });
  return pools;
}

function applyMatchToPool(ratings, match, winnerTeam) {
  const teams = getTeamsFromMatch(match);
  const teamIds = Array.from(teams.keys()).sort(function (a, b) {
    return a - b;
  });
  if (teamIds.length !== 2) return null;

  const teamA = teamIds[0];
  const teamB = teamIds[1];
  const keysA = teams.get(teamA).map(function (member) {
    return member.key;
  });
  const keysB = teams.get(teamB).map(function (member) {
    return member.key;
  });
  const avgA = averageRating(ratings, keysA);
  const avgB = averageRating(ratings, keysB);
  const expectedA = expectedScore(avgA, avgB);
  const actualA = winnerTeam === teamA ? 1 : 0;
  const deltaA = ELO_K * (actualA - expectedA);
  const deltaB = -deltaA;

  const breakdown = {
    format: match.format,
    teams: [],
    players: [],
  };

  teamIds.forEach(function (teamId) {
    const delta = teamId === teamA ? deltaA : deltaB;
    const members = teams.get(teamId);
    const avgBefore = teamId === teamA ? avgA : avgB;
    breakdown.teams.push({
      team: teamId,
      avgBefore: Math.round(avgBefore),
      delta: Math.round(delta * 10) / 10,
      won: winnerTeam === teamId,
    });
    members.forEach(function (member) {
      const before = getRating(ratings, member.key);
      const after = Math.round(before + delta);
      ratings.set(member.key, after);
      breakdown.players.push({
        key: member.key,
        name: member.name,
        team: teamId,
        before: before,
        after: after,
        change: Math.round(delta * 10) / 10,
      });
    });
  });

  return breakdown;
}

function computeElo(matches, options) {
  options = options || {};
  const formats = options.formats || SKIRM_FORMATS;
  const pools = createRatingPools(formats);
  const matchResults = new Map();
  const chronological = matches.slice().sort(function (a, b) {
    return Date.parse(a.receivedAt) - Date.parse(b.receivedAt);
  });

  chronological.forEach(function (match) {
    if (!isRatedMatch(match, formats)) return;
    const winnerTeam = match.snapshot.winnerTeam;
    const formatBreakdown = applyMatchToPool(pools[match.format], match, winnerTeam);
    const overallBreakdown = applyMatchToPool(pools.overall, match, winnerTeam);
    if (formatBreakdown) {
      formatBreakdown.overall = overallBreakdown;
      matchResults.set(match.id, formatBreakdown);
    }
  });

  return {
    ratingsByFormat: pools,
    matchResults: matchResults,
    ELO_START: ELO_START,
    ELO_K: ELO_K,
  };
}

function getPlayerElo(ratingsByFormat, formatFilter, playerKey) {
  const pool = formatFilter === "overall"
    ? ratingsByFormat.overall
    : ratingsByFormat[formatFilter];
  if (!pool || !pool.has(playerKey)) return null;
  return pool.get(playerKey);
}

module.exports = {
  computeElo: computeElo,
  getPlayerElo: getPlayerElo,
  normalizePlayerName: normalizePlayerName,
  isRatedMatch: isRatedMatch,
  SKIRM_FORMATS: SKIRM_FORMATS,
  ELO_START: ELO_START,
  ELO_K: ELO_K,
};
