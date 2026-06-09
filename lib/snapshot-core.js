"use strict";

const api = require("./snapshot-api");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNullableNumber(value) {
  return value == null || value < 0 ? "-" : String(value);
}

function formatReligionSummary(religion) {
  if (!religion) return "-";
  const beliefs = Array.isArray(religion.beliefs) ? religion.beliefs.join(", ") : "";
  if (beliefs) {
    return religion.name + " (" + beliefs + ")";
  }
  return religion.name || "-";
}

function sortPlayers(players) {
  return players.slice().sort(function (a, b) {
    const teamDiff = (a.team != null ? a.team : 0) - (b.team != null ? b.team : 0);
    if (teamDiff !== 0) return teamDiff;
    return (a.slot != null ? a.slot : 0) - (b.slot != null ? b.slot : 0);
  });
}

function groupPlayersByTeam(players) {
  const groups = new Map();
  sortPlayers(players).forEach(function (player) {
    const team = player.team != null ? player.team : 0;
    if (!groups.has(team)) groups.set(team, []);
    groups.get(team).push(player);
  });
  return Array.from(groups.entries()).sort(function (a, b) {
    return a[0] - b[0];
  });
}

function renderSnapshotPage(entry) {
  const publicBaseUrl = api.getPublicBaseUrl();
  const id = entry.id;
  const snapshot = entry.snapshot;
  const receivedAt = entry.receivedAt;
  const turn = snapshot.turn != null ? snapshot.turn : "?";
  const mapScript = api.formatMapScript(snapshot.mapScript);
  const mode = snapshot.isMultiplayer ? "Multiplayer" : "Single Player";
  const winnerTeam =
    snapshot.winnerTeam != null && snapshot.winnerTeam >= 0
      ? "Team " + (snapshot.winnerTeam + 1)
      : "-";
  const milestones = snapshot.milestones || {};
  const title = "Turn " + turn + " Skirmish";
  const viewUrl = publicBaseUrl + "/snapshot/" + id;
  const ogDescription = mode + " | Turn " + turn + " | " + snapshot.players.length + " players";
  const receivedLabel = new Date(receivedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const teamSections = groupPlayersByTeam(snapshot.players)
    .map(function (group) {
      const team = group[0];
      const players = group[1];
      const rows = players
        .map(function (p) {
          const policyText = p.policyUnlocks || "";
          return (
            "\n          <tr>\n            <td>" +
            escapeHtml(p.playerName) +
            "</td>\n            <td>" +
            escapeHtml(p.civilization) +
            "</td>\n            <td>" +
            escapeHtml(policyText || "-") +
            "</td>\n            <td>" +
            escapeHtml(formatReligionSummary(p.religion)) +
            "</td>\n          </tr>"
          );
        })
        .join("");

      return (
        '\n        <section class="team-block">\n          <h2>Team ' +
        (team + 1) +
        '</h2>\n          <table>\n            <thead>\n              <tr>\n                <th>Player</th>\n                <th>Civilization</th>\n                <th>Policies</th>\n                <th>Religion</th>\n              </tr>\n            </thead>\n            <tbody>' +
        rows +
        "</tbody>\n          </table>\n        </section>"
      );
    })
    .join("");

  const techRows = (snapshot.teamTechTurns || [])
    .map(function (teamEntry) {
      return (
        "\n        <tr>\n          <td>Team " +
        (teamEntry.team + 1) +
        "</td>\n          <td>" +
        formatNullableNumber(teamEntry.machineryTurn) +
        "</td>\n          <td>" +
        formatNullableNumber(teamEntry.metalCastingTurn) +
        "</td>\n          <td>" +
        formatNullableNumber(teamEntry.chivalryTurn) +
        "</td>\n        </tr>"
      );
    })
    .join("");

  return (
    '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>' +
    escapeHtml(title) +
    '</title>\n  <meta name="description" content="' +
    escapeHtml(ogDescription) +
    '">\n  <meta property="og:title" content="' +
    escapeHtml(title) +
    '">\n  <meta property="og:description" content="' +
    escapeHtml(ogDescription) +
    '">\n  <meta property="og:type" content="website">\n  <meta property="og:url" content="' +
    escapeHtml(viewUrl) +
    '">\n  <style>\n    :root {\n      --bg: #1a1208;\n      --panel: #2a1f12;\n      --border: #5c4a2a;\n      --gold: #c9a227;\n      --gold-dim: #8a7020;\n      --text: #e8dcc8;\n      --muted: #a89878;\n      --defeated: #6b5a48;\n    }\n    * { box-sizing: border-box; }\n    body {\n      margin: 0;\n      min-height: 100vh;\n      font-family: Georgia, "Times New Roman", serif;\n      background: linear-gradient(180deg, #120c06 0%, var(--bg) 40%, #0f0a05 100%);\n      color: var(--text);\n      line-height: 1.5;\n    }\n    .wrap {\n      max-width: 900px;\n      margin: 0 auto;\n      padding: 2rem 1.25rem 3rem;\n    }\n    header {\n      border-bottom: 2px solid var(--border);\n      padding-bottom: 1.25rem;\n      margin-bottom: 1.5rem;\n    }\n    .eyebrow {\n      color: var(--gold);\n      font-size: 0.85rem;\n      letter-spacing: 0.12em;\n      text-transform: uppercase;\n      margin: 0 0 0.35rem;\n    }\n    h1 {\n      margin: 0;\n      font-size: clamp(1.6rem, 4vw, 2.2rem);\n      color: var(--gold);\n      font-weight: normal;\n    }\n    .meta {\n      display: grid;\n      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));\n      gap: 0.75rem 1.5rem;\n      margin-top: 1rem;\n      color: var(--muted);\n      font-size: 0.95rem;\n    }\n    .meta strong { color: var(--text); font-weight: normal; }\n    .team-block {\n      background: var(--panel);\n      border: 1px solid var(--border);\n      border-radius: 4px;\n      margin-bottom: 1.25rem;\n      overflow: hidden;\n    }\n    .team-block h2 {\n      margin: 0;\n      padding: 0.65rem 1rem;\n      font-size: 1rem;\n      font-weight: normal;\n      color: var(--gold-dim);\n      background: rgba(0, 0, 0, 0.2);\n      border-bottom: 1px solid var(--border);\n    }\n    table {\n      width: 100%;\n      border-collapse: collapse;\n    }\n    th, td {\n      padding: 0.65rem 1rem;\n      text-align: left;\n      border-bottom: 1px solid rgba(92, 74, 42, 0.45);\n    }\n    th {\n      color: var(--gold-dim);\n      font-size: 0.8rem;\n      text-transform: uppercase;\n      letter-spacing: 0.06em;\n      font-weight: normal;\n    }\n    tr:last-child td { border-bottom: none; }\n    .stats-block {\n      background: var(--panel);\n      border: 1px solid var(--border);\n      border-radius: 4px;\n      margin-bottom: 1.25rem;\n      padding: 1rem;\n    }\n    .stats-block h2 {\n      margin: 0 0 0.75rem;\n      font-size: 1rem;\n      font-weight: normal;\n      color: var(--gold-dim);\n    }\n    .stats-grid {\n      display: grid;\n      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));\n      gap: 0.5rem 1rem;\n      color: var(--muted);\n      font-size: 0.95rem;\n    }\n    footer {\n      margin-top: 2rem;\n      color: var(--muted);\n      font-size: 0.85rem;\n      text-align: center;\n    }\n    a { color: var(--gold); }\n  </style>\n</head>\n<body>\n  <div class="wrap">\n    <header>\n      <p class="eyebrow">Malros Skirmish</p>\n      <h1>' +
    escapeHtml(title) +
    '</h1>\n      <div class="meta">\n        <div><strong>Turn</strong> ' +
    escapeHtml(turn) +
    '</div>\n        <div><strong>Map</strong> ' +
    escapeHtml(mapScript) +
    '</div>\n        <div><strong>Mode</strong> ' +
    escapeHtml(mode) +
    '</div>\n        <div><strong>Winner</strong> ' +
    escapeHtml(winnerTeam) +
    '</div>\n        <div><strong>Received</strong> ' +
    escapeHtml(receivedLabel) +
    '</div>\n      </div>\n    </header>\n    <section class="stats-block">\n      <h2>Milestones</h2>\n      <div class="stats-grid">\n        <div><strong>Max prod @80</strong> ' +
    formatNullableNumber(milestones.maxProductionAt80) +
    '</div>\n        <div><strong>Max prod @100</strong> ' +
    formatNullableNumber(milestones.maxProductionAt100) +
    '</div>\n        <div><strong>Max prod @120</strong> ' +
    formatNullableNumber(milestones.maxProductionAt120) +
    '</div>\n        <div><strong>Max culture/turn</strong> ' +
    formatNullableNumber(milestones.maxCulturePerTurnAtEnd) +
    '</div>\n      </div>\n    </section>\n    <section class="team-block">\n      <h2>Team Tech Turns</h2>\n      <table>\n        <thead>\n          <tr>\n            <th>Team</th>\n            <th>Machinery</th>\n            <th>Metal Casting</th>\n            <th>Chivalry</th>\n          </tr>\n        </thead>\n        <tbody>' +
    techRows +
    '</tbody>\n      </table>\n    </section>\n    ' +
    teamSections +
    '\n    <footer>Game ID ' +
    escapeHtml(snapshot.gameId || id) +
    "</footer>\n  </div>\n</body>\n</html>"
  );
}

function renderNotFoundPage() {
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Snapshot Not Found - Malros</title>\n  <style>\n    body {\n      margin: 0; min-height: 100vh; display: grid; place-items: center;\n      background: #1a1208; color: #e8dcc8; font-family: Georgia, serif;\n    }\n    .box { text-align: center; padding: 2rem; }\n    h1 { color: #c9a227; font-weight: normal; }\n    p { color: #a89878; }\n  </style>\n</head>\n<body>\n  <div class="box">\n    <h1>Snapshot Not Found</h1>\n    <p>This game snapshot does not exist or has expired.</p>\n  </div>\n</body>\n</html>';
}

module.exports = Object.assign({}, api, {
  escapeHtml: escapeHtml,
  formatNullableNumber: formatNullableNumber,
  formatReligionSummary: formatReligionSummary,
  groupPlayersByTeam: groupPlayersByTeam,
  renderSnapshotPage: renderSnapshotPage,
  renderNotFoundPage: renderNotFoundPage,
});
