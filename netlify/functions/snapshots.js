"use strict";

const {
  resolveSnapshotId,
  validateSnapshotBody,
  parseJsonBody,
  getPublicBaseUrl,
  buildMatchSummary,
  dedupeSnapshotsByGameId,
} = require("../../lib/snapshot-api");
const { upsertSnapshot, fetchAllSnapshots } = require("../../lib/db");

async function handleGet() {
  const entries = await fetchAllSnapshots();
  const matches = dedupeSnapshotsByGameId(entries).map(buildMatchSummary);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matches: matches }),
  };
}

async function handlePost(event) {
  const parsed = parseJsonBody(event.body);
  if (parsed.error) {
    return { statusCode: 400, body: JSON.stringify({ error: parsed.error }) };
  }

  const validationError = validateSnapshotBody(parsed.body);
  if (validationError) {
    return { statusCode: 400, body: JSON.stringify({ error: validationError }) };
  }

  const id = resolveSnapshotId(parsed.body);
  await upsertSnapshot(id, parsed.body);
  const viewUrl = getPublicBaseUrl() + "/snapshot/" + id;
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: true, id: id, viewUrl: viewUrl }),
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      return await handleGet();
    }
    if (event.httpMethod === "POST") {
      return await handlePost(event);
    }
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    console.error("snapshots error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to process snapshot request" }),
    };
  }
};
