"use strict";

const { fetchAllSnapshots } = require("../../lib/db");
const { buildMatchSummary, dedupeSnapshotsByGameId } = require("../../lib/snapshot-api");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const entries = await fetchAllSnapshots();
    const matches = dedupeSnapshotsByGameId(entries).map(buildMatchSummary);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matches }),
    };
  } catch (err) {
    console.error("list-snapshots error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to list snapshots" }),
    };
  }
};
