"use strict";

const {
  generateId,
  validateSnapshotBody,
  parseJsonBody,
  getPublicBaseUrl,
} = require("../../lib/snapshot-core");
const { insertSnapshot } = require("../../lib/db");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const parsed = parseJsonBody(event.body);
  if (parsed.error) {
    return { statusCode: 400, body: JSON.stringify({ error: parsed.error }) };
  }

  const validationError = validateSnapshotBody(parsed.body);
  if (validationError) {
    return { statusCode: 400, body: JSON.stringify({ error: validationError }) };
  }

  try {
    const id = generateId();
    await insertSnapshot(id, parsed.body);
    const viewUrl = getPublicBaseUrl() + "/snapshot/" + id;
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, id: id, viewUrl: viewUrl }),
    };
  } catch (err) {
    console.error("upload-snapshot error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to store snapshot" }),
    };
  }
};
