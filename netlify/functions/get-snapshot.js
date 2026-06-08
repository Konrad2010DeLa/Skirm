"use strict";

const { fetchSnapshot } = require("../../lib/db");
const { getSnapshotId } = require("../../lib/ids");

exports.handler = async (event) => {
  const id = getSnapshotId(event);
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing snapshot id" }) };
  }

  try {
    const entry = await fetchSnapshot(id);
    if (!entry) {
      return { statusCode: 404, body: JSON.stringify({ error: "Snapshot not found" }) };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: entry.id,
        receivedAt: entry.receivedAt,
        snapshot: entry.snapshot,
      }),
    };
  } catch (err) {
    console.error("get-snapshot error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to load snapshot" }),
    };
  }
};
