"use strict";

(function () {
  var matches = [];
  var expandedMatchId = null;
  var expandedPlayerKey = null;
  var leaderboardFormat = "overall";
  var SKIRM_FORMATS = ["1v1", "2v2", "3v3", "4v4"];
  var EXCLUDED_RECORD_TEAMS = new Set([22, 23, 24, 25]);
  var MILESTONE_RECORDS = [
    { key: "maxProductionAt80", label: "Max production @ turn 80" },
    { key: "maxProductionAt100", label: "Max production @ turn 100" },
    { key: "maxProductionAt120", label: "Max production @ turn 120" },
    { key: "maxCulturePerTurnAtEnd", label: "Max culture / turn" },
  ];
  var TECH_RECORDS = [
    { key: "machineryTurn", label: "Machinery" },
    { key: "metalCastingTurn", label: "Metal Casting" },
    { key: "chivalryTurn", label: "Chivalry" },
  ];

  function $(selector) {
    return document.querySelector(selector);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatNullableNumber(value) {
    return value == null || value < 0 ? "—" : String(value);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  function getSnapshotGameId(match) {
    return String((match.snapshot && match.snapshot.gameId) || match.id || "").toLowerCase();
  }

  function dedupeMatches(items) {
    var seen = new Set();
    var sorted = items.slice().sort(function (a, b) {
      return Date.parse(a.receivedAt) - Date.parse(b.receivedAt);
    });
    var deduped = [];
    sorted.forEach(function (match) {
      var gameId = getSnapshotGameId(match);
      if (!gameId || seen.has(gameId)) return;
      seen.add(gameId);
      deduped.push(match);
    });
    return deduped.reverse();
  }

  function groupPlayersByTeam(players) {
    var groups = new Map();
    (players || []).slice().sort(function (a, b) {
      var teamDiff = (a.team != null ? a.team : 0) - (b.team != null ? b.team : 0);
      if (teamDiff !== 0) return teamDiff;
      return (a.slot != null ? a.slot : 0) - (b.slot != null ? b.slot : 0);
    }).forEach(function (player) {
      var team = player.team != null ? player.team : 0;
      if (!groups.has(team)) groups.set(team, []);
      groups.get(team).push(player);
    });
    return Array.from(groups.entries()).sort(function (a, b) {
      return a[0] - b[0];
    });
  }

  function playerKey(matchId, player) {
    return matchId + ":" + (player.slot != null ? player.slot : player.playerName);
  }

  function renderTechTable(teamTechTurns) {
    var rows = (teamTechTurns || [])
      .map(function (entry) {
        return (
          "<tr>" +
          "<td>Team " + (entry.team + 1) + "</td>" +
          "<td>" + formatNullableNumber(entry.machineryTurn) + "</td>" +
          "<td>" + formatNullableNumber(entry.metalCastingTurn) + "</td>" +
          "<td>" + formatNullableNumber(entry.chivalryTurn) + "</td>" +
          "</tr>"
        );
      })
      .join("");

    if (!rows) {
      return "<p class=\"empty-state\">No tech data recorded.</p>";
    }

    return (
      '<table class="tech-table">' +
      "<thead><tr><th>Team</th><th>Machinery</th><th>Metal Casting</th><th>Chivalry</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table>"
    );
  }

  function renderBeliefs(religion) {
    if (!religion) return "—";
    var beliefs = Array.isArray(religion.beliefs) ? religion.beliefs : [];
    if (!beliefs.length) {
      return escapeHtml(religion.name || "—");
    }
    var items = beliefs.map(function (belief) {
      return "<li>" + escapeHtml(belief) + "</li>";
    }).join("");
    return (
      escapeHtml(religion.name || "Unknown") +
      '<ul class="belief-list">' + items + "</ul>"
    );
  }

  function renderPlayerDetail(matchId, player) {
    var key = playerKey(matchId, player);
    var visible = expandedPlayerKey === key ? " visible" : "";
    return (
      '<div class="player-detail' + visible + '" data-player-detail="' + escapeHtml(key) + '">' +
      "<dl>" +
      "<dt>Civilization</dt><dd>" + escapeHtml(player.civilization || "—") + "</dd>" +
      "<dt>Policies</dt><dd>" + escapeHtml(player.policyUnlocks || "—") + "</dd>" +
      "<dt>Religion</dt><dd>" + renderBeliefs(player.religion) + "</dd>" +
      "</dl></div>"
    );
  }

  function renderMatchDetail(match) {
    var snapshot = match.snapshot || {};
    var milestones = snapshot.milestones || {};
    var matchId = match.id;
    var teamSections = groupPlayersByTeam(snapshot.players)
      .map(function (group) {
        var team = group[0];
        var players = group[1];
        var buttons = players.map(function (player) {
          var key = playerKey(matchId, player);
          var active = expandedPlayerKey === key ? " active" : "";
          return (
            '<button type="button" class="player-btn' + active + '" data-player-key="' + escapeHtml(key) + '" data-match-id="' + escapeHtml(matchId) + '">' +
            escapeHtml(player.playerName) +
            "</button>"
          );
        }).join("");
        var details = players.map(function (player) {
          return renderPlayerDetail(matchId, player);
        }).join("");
        return (
          '<div class="team-group">' +
          '<div class="team-label">Team ' + (team + 1) + "</div>" +
          '<div class="player-list">' + buttons + "</div>" +
          details +
          "</div>"
        );
      })
      .join("");

    return (
      '<div class="match-detail">' +
      '<div class="detail-section">' +
      "<h3>Global Milestones</h3>" +
      '<div class="stats-grid">' +
      "<div><strong>Max prod @80</strong> " + formatNullableNumber(milestones.maxProductionAt80) + "</div>" +
      "<div><strong>Max prod @100</strong> " + formatNullableNumber(milestones.maxProductionAt100) + "</div>" +
      "<div><strong>Max prod @120</strong> " + formatNullableNumber(milestones.maxProductionAt120) + "</div>" +
      "<div><strong>Max culture/turn</strong> " + formatNullableNumber(milestones.maxCulturePerTurnAtEnd) + "</div>" +
      "</div></div>" +
      '<div class="detail-section">' +
      "<h3>Team Tech Turns</h3>" +
      renderTechTable(snapshot.teamTechTurns) +
      "</div>" +
      '<div class="detail-section">' +
      "<h3>Players</h3>" +
      (teamSections || '<p class="empty-state">No player data.</p>') +
      "</div>" +
      '<div class="detail-section" style="font-size:0.8rem;color:var(--muted);">Game ID ' + escapeHtml(match.gameId || match.id) + "</div>" +
      "</div>"
    );
  }

  function renderMatchCard(match) {
    var expanded = expandedMatchId === match.id ? " expanded" : "";
    return (
      '<article class="match-item' + expanded + '" data-match-id="' + escapeHtml(match.id) + '">' +
      '<button type="button" class="match-card" aria-expanded="' + (expandedMatchId === match.id ? "true" : "false") + '">' +
      '<span class="match-format">' + escapeHtml(match.format || "?") + "</span>" +
      '<span class="match-card-main">' +
      '<span class="match-chip winner"><strong>' + escapeHtml(match.winner || "—") + "</strong></span>" +
      '<span class="match-chip">Turn <strong>' + escapeHtml(match.turn != null ? match.turn : "?") + "</strong></span>" +
      '<span class="match-chip">Map <strong>' + escapeHtml(match.mapScript || "Unknown") + "</strong></span>" +
      '<span class="match-chip">' + (match.isMultiplayer ? "MP" : "SP") + "</span>" +
      "</span>" +
      '<span class="match-card-meta">' + escapeHtml(formatDate(match.receivedAt)) + "</span>" +
      "</button>" +
      (expandedMatchId === match.id ? renderMatchDetail(match) : "") +
      "</article>"
    );
  }

  function scrollExpandedContentIntoView() {
    window.requestAnimationFrame(function () {
      if (expandedPlayerKey) {
        var playerDetail = document.querySelector(
          '.player-detail.visible[data-player-detail="' + CSS.escape(expandedPlayerKey) + '"]'
        );
        if (playerDetail) {
          playerDetail.scrollIntoView({ behavior: "smooth", block: "nearest" });
          return;
        }
      }
      if (expandedMatchId) {
        var matchDetail = document.querySelector(
          '.match-item[data-match-id="' + CSS.escape(expandedMatchId) + '"] .match-detail'
        );
        if (matchDetail) {
          matchDetail.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    });
  }

  function renderMatchList() {
    var listEl = $("#match-list");
    var countEl = $("#match-count");
    if (!listEl) return;

    if (!matches.length) {
      listEl.innerHTML = '<div class="empty-state">No matches collected yet.</div>';
      if (countEl) countEl.textContent = "0 matches";
      return;
    }

    listEl.innerHTML = matches.map(renderMatchCard).join("");
    if (countEl) {
      countEl.textContent = matches.length + (matches.length === 1 ? " match" : " matches");
    }
    scrollExpandedContentIntoView();
  }

  function setExpandedMatch(matchId) {
    expandedMatchId = expandedMatchId === matchId ? null : matchId;
    expandedPlayerKey = null;
    renderMatchList();
  }

  function setExpandedPlayer(matchId, playerKeyValue) {
    if (expandedMatchId !== matchId) return;
    expandedPlayerKey = expandedPlayerKey === playerKeyValue ? null : playerKeyValue;
    renderMatchList();
  }

  function normalizePlayerName(name) {
    return String(name || "").trim().toLowerCase();
  }

  function isLeaderboardPlayer(player) {
    if (player.isHuman === false || player.isHuman === 0) return false;
    if (EXCLUDED_RECORD_TEAMS.has(player.team != null ? player.team : -1)) return false;
    return typeof player.playerName === "string" && player.playerName.trim() !== "";
  }

  function isExcludedRecordTeam(team) {
    return EXCLUDED_RECORD_TEAMS.has(team != null ? team : -1);
  }

  function computeWinLossLeaderboard(items, formatFilter) {
    var stats = new Map();
    items.forEach(function (match) {
      var snapshot = match.snapshot || {};
      if (snapshot.winnerTeam == null || snapshot.winnerTeam < 0) return;
      if (isExcludedRecordTeam(snapshot.winnerTeam)) return;
      if (!match.isMultiplayer) return;
      var format = match.format || "";
      if (formatFilter === "overall") {
        if (SKIRM_FORMATS.indexOf(format) === -1) return;
      } else if (format !== formatFilter) {
        return;
      }
      (snapshot.players || []).forEach(function (player) {
        if (!isLeaderboardPlayer(player)) return;
        var key = normalizePlayerName(player.playerName);
        if (!key) return;
        if (!stats.has(key)) {
          stats.set(key, { name: player.playerName.trim(), wins: 0, losses: 0 });
        }
        var entry = stats.get(key);
        if (player.team === snapshot.winnerTeam) {
          entry.wins += 1;
        } else {
          entry.losses += 1;
        }
      });
    });
    return Array.from(stats.values())
      .map(function (entry) {
        var games = entry.wins + entry.losses;
        return {
          name: entry.name,
          wins: entry.wins,
          losses: entry.losses,
          games: games,
          winRate: games > 0 ? (entry.wins / games) * 100 : 0,
        };
      })
      .sort(function (a, b) {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.games - a.games;
      });
  }

  function formatWinRate(value) {
    return value.toFixed(1) + "%";
  }

  function isSkirmMatch(match) {
    if (!match || !match.isMultiplayer) return false;
    return SKIRM_FORMATS.indexOf(match.format || "") !== -1;
  }

  function formatRecordMeta(match, extra) {
    var parts = [match.format || "?", formatDate(match.receivedAt)];
    if (extra) parts.unshift(extra);
    return parts.join(" · ");
  }

  function computeMilestoneRecords(items) {
    var best = {};
    items.forEach(function (match) {
      if (!isSkirmMatch(match)) return;
      var milestones = (match.snapshot || {}).milestones || {};
      MILESTONE_RECORDS.forEach(function (record) {
        var value = milestones[record.key];
        if (value == null || value < 0) return;
        var current = best[record.key];
        if (!current || value > current.value) {
          best[record.key] = { value: value, matchId: match.id, match: match };
        }
      });
    });
    return best;
  }

  function computeTechRecords(items) {
    var best = {};
    items.forEach(function (match) {
      if (!isSkirmMatch(match)) return;
      ((match.snapshot || {}).teamTechTurns || []).forEach(function (teamEntry) {
        if (isExcludedRecordTeam(teamEntry.team)) return;
        TECH_RECORDS.forEach(function (record) {
          var value = teamEntry[record.key];
          if (value == null || value < 0) return;
          var current = best[record.key];
          if (!current || value < current.value) {
            best[record.key] = {
              value: value,
              team: teamEntry.team,
              matchId: match.id,
              match: match,
            };
          }
        });
      });
    });
    return best;
  }

  function renderRecordRow(label, valueLabel, meta, matchId) {
    return (
      '<button type="button" class="record-row" data-record-match="' + escapeHtml(matchId) + '">' +
      '<span class="record-label">' + escapeHtml(label) + "</span>" +
      '<span class="record-value">' + escapeHtml(valueLabel) + "</span>" +
      '<span class="record-meta">' + escapeHtml(meta) + "</span>" +
      "</button>"
    );
  }

  function renderGlobalRecords() {
    var milestoneEl = $("#global-milestone-records");
    var techEl = $("#global-tech-records");
    if (!milestoneEl || !techEl) return;

    var milestoneBest = computeMilestoneRecords(matches);
    var milestoneRows = MILESTONE_RECORDS.map(function (record) {
      var entry = milestoneBest[record.key];
      if (!entry) {
        return (
          '<div class="record-row" style="cursor:default;opacity:0.7">' +
          '<span class="record-label">' + escapeHtml(record.label) + "</span>" +
          '<span class="record-value">—</span>' +
          '<span class="record-meta">No data yet</span>' +
          "</div>"
        );
      }
      return renderRecordRow(
        record.label,
        String(entry.value),
        formatRecordMeta(entry.match),
        entry.matchId
      );
    }).join("");
    milestoneEl.innerHTML = milestoneRows || '<div class="empty-state">No milestone data yet.</div>';

    var techBest = computeTechRecords(matches);
    var techRows = TECH_RECORDS.map(function (record) {
      var entry = techBest[record.key];
      if (!entry) {
        return (
          '<div class="record-row" style="cursor:default;opacity:0.7">' +
          '<span class="record-label">' + escapeHtml(record.label) + "</span>" +
          '<span class="record-value">—</span>' +
          '<span class="record-meta">No data yet</span>' +
          "</div>"
        );
      }
      return renderRecordRow(
        record.label,
        "Turn " + entry.value,
        formatRecordMeta(entry.match, "Team " + (entry.team + 1)),
        entry.matchId
      );
    }).join("");
    techEl.innerHTML = techRows || '<div class="empty-state">No tech data yet.</div>';
  }

  function navigateToMatch(matchId) {
    expandedMatchId = matchId;
    expandedPlayerKey = null;
    var url = new URL(window.location.href);
    url.searchParams.set("match", matchId);
    window.history.replaceState({}, "", url);
    switchTab("matches");
    renderMatchList();
  }

  function renderLeaderboard() {
    var tableEl = $("#leaderboard-table");
    var countEl = $("#leaderboard-count");
    if (!tableEl) return;

    var rows = computeWinLossLeaderboard(matches, leaderboardFormat);
    if (!rows.length) {
      tableEl.innerHTML = '<div class="empty-state">No completed matches for this format yet.</div>';
      if (countEl) countEl.textContent = "0 players";
      return;
    }

    var body = rows.map(function (row, index) {
      return (
        "<tr>" +
        "<td>" + (index + 1) + "</td>" +
        "<td>" + escapeHtml(row.name) + "</td>" +
        "<td>" + row.wins + "</td>" +
        "<td>" + row.losses + "</td>" +
        "<td>" + row.games + "</td>" +
        "<td>" + formatWinRate(row.winRate) + "</td>" +
        "</tr>"
      );
    }).join("");

    tableEl.innerHTML =
      '<table class="leaderboard-table">' +
      "<thead><tr><th>#</th><th>Player</th><th>W</th><th>L</th><th>Games</th><th>Win %</th></tr></thead>" +
      "<tbody>" + body + "</tbody></table>";
    if (countEl) {
      countEl.textContent = rows.length + (rows.length === 1 ? " player" : " players");
    }
    renderGlobalRecords();
  }

  function setLeaderboardFormat(format) {
    leaderboardFormat = format;
    document.querySelectorAll(".lb-format-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-lb-format") === format);
    });
    renderLeaderboard();
  }

  function switchTab(tabId) {
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
    });
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      panel.classList.toggle("active", panel.id === "tab-" + tabId);
    });
    if (tabId === "leaderboard") {
      renderLeaderboard();
    }
  }

  function readDeepLinkMatchId() {
    var params = new URLSearchParams(window.location.search);
    return params.get("match");
  }

  function applyDeepLink() {
    var matchId = readDeepLinkMatchId();
    if (!matchId) return;
    var found = matches.find(function (match) {
      return match.id === matchId || getSnapshotGameId(match) === matchId.toLowerCase();
    });
    if (!found) return;
    navigateToMatch(found.id);
  }

  function bindEvents() {
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchTab(btn.getAttribute("data-tab"));
      });
    });

    document.querySelectorAll(".lb-format-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setLeaderboardFormat(btn.getAttribute("data-lb-format"));
      });
    });

    var leaderboardPanel = $("#tab-leaderboard");
    if (leaderboardPanel) {
      leaderboardPanel.addEventListener("click", function (event) {
        var recordBtn = event.target.closest("[data-record-match]");
        if (recordBtn) {
          navigateToMatch(recordBtn.getAttribute("data-record-match"));
        }
      });
    }

    var listEl = $("#match-list");
    if (listEl) {
      listEl.addEventListener("click", function (event) {
        var playerBtn = event.target.closest(".player-btn");
        if (playerBtn) {
          setExpandedPlayer(playerBtn.getAttribute("data-match-id"), playerBtn.getAttribute("data-player-key"));
          return;
        }
        var matchCard = event.target.closest(".match-card");
        if (matchCard) {
          var item = matchCard.closest(".match-item");
          if (item) setExpandedMatch(item.getAttribute("data-match-id"));
        }
      });
    }
  }

  function loadMatches() {
    var listEl = $("#match-list");
    if (listEl) {
      listEl.innerHTML = '<div class="loading-state">Loading matches…</div>';
    }

    fetch("/api/snapshots")
      .then(function (response) {
        if (!response.ok) throw new Error("Failed to load matches");
        return response.json();
      })
      .then(function (data) {
        matches = dedupeMatches(data.matches || []);
        applyDeepLink();
        renderMatchList();
        renderLeaderboard();
      })
      .catch(function () {
        if (listEl) {
          listEl.innerHTML = '<div class="error-state">Could not load matches. Try again later.</div>';
        }
      });
  }

  bindEvents();
  loadMatches();
})();
