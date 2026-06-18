"use strict";

(function (global) {
  var ELO_START = 1500;
  var ELO_K = 32;
  var SKIRM_FORMATS = ["1v1", "2v2", "3v3", "4v4"];

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
    var snapshot = match.snapshot || {};
    if (!match.isMultiplayer) return false;
    if (snapshot.winnerTeam == null || snapshot.winnerTeam < 0) return false;
    var format = match.format || "";
    return skirmFormats.indexOf(format) !== -1;
  }

  function getRating(ratings, key) {
    return ratings.has(key) ? ratings.get(key) : ELO_START;
  }

  function averageRating(ratings, keys) {
    if (!keys.length) return ELO_START;
    var sum = 0;
    keys.forEach(function (key) {
      sum += getRating(ratings, key);
    });
    return sum / keys.length;
  }

  function getTeamsFromMatch(match) {
    var teams = new Map();
    (match.snapshot.players || []).forEach(function (player) {
      if (!isHumanPlayer(player)) return;
      var key = normalizePlayerName(player.playerName);
      if (!key) return;
      var team = player.team != null ? player.team : 0;
      if (!teams.has(team)) teams.set(team, []);
      teams.get(team).push({ key: key, name: player.playerName.trim(), team: team });
    });
    return teams;
  }

  function createRatingPools(formats) {
    var pools = { overall: new Map() };
    formats.forEach(function (format) {
      pools[format] = new Map();
    });
    return pools;
  }

  function applyMatchToPool(ratings, match, winnerTeam) {
    var teams = getTeamsFromMatch(match);
    var teamIds = Array.from(teams.keys()).sort(function (a, b) {
      return a - b;
    });
    if (teamIds.length !== 2) return null;

    var teamA = teamIds[0];
    var teamB = teamIds[1];
    var keysA = teams.get(teamA).map(function (member) {
      return member.key;
    });
    var keysB = teams.get(teamB).map(function (member) {
      return member.key;
    });
    var avgA = averageRating(ratings, keysA);
    var avgB = averageRating(ratings, keysB);
    var expectedA = expectedScore(avgA, avgB);
    var actualA = winnerTeam === teamA ? 1 : 0;
    var deltaA = ELO_K * (actualA - expectedA);
    var deltaB = -deltaA;

    var breakdown = {
      format: match.format,
      teams: [],
      players: [],
    };

    teamIds.forEach(function (teamId) {
      var delta = teamId === teamA ? deltaA : deltaB;
      var members = teams.get(teamId);
      var avgBefore = teamId === teamA ? avgA : avgB;
      breakdown.teams.push({
        team: teamId,
        avgBefore: Math.round(avgBefore),
        delta: Math.round(delta * 10) / 10,
        won: winnerTeam === teamId,
      });
      members.forEach(function (member) {
        var before = getRating(ratings, member.key);
        var after = Math.round(before + delta);
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
    var formats = options.formats || SKIRM_FORMATS;
    var pools = createRatingPools(formats);
    var matchResults = new Map();
    var chronological = matches.slice().sort(function (a, b) {
      return Date.parse(a.receivedAt) - Date.parse(b.receivedAt);
    });

    chronological.forEach(function (match) {
      if (!isRatedMatch(match, formats)) return;
      var winnerTeam = match.snapshot.winnerTeam;
      var formatBreakdown = applyMatchToPool(pools[match.format], match, winnerTeam);
      var overallBreakdown = applyMatchToPool(pools.overall, match, winnerTeam);
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
    var pool = formatFilter === "overall"
      ? ratingsByFormat.overall
      : ratingsByFormat[formatFilter];
    if (!pool || !pool.has(playerKey)) return null;
    return pool.get(playerKey);
  }

  global.MalrosElo = {
    compute: computeElo,
    getPlayerElo: getPlayerElo,
    normalizePlayerName: normalizePlayerName,
    isRatedMatch: isRatedMatch,
    SKIRM_FORMATS: SKIRM_FORMATS,
    ELO_START: ELO_START,
    ELO_K: ELO_K,
  };
})(typeof window !== "undefined" ? window : global);
