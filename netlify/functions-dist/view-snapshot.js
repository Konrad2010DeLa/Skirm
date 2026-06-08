"use strict";

const { renderSnapshotPage, renderNotFoundPage } = require("./snapshot-core");
const { fetchSnapshot } = require("./db");
const { getSnapshotId } = require("./ids");

exports.handler = async (event) => {
  const id = getSnapshotId(event);
  if (!id) {
    console.error("view-snapshot: missing id", { path: event.path, rawUrl: event.rawUrl });
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: renderNotFoundPage(),
    };
  }

  try {
    const entry = await fetchSnapshot(id);
    if (!entry) {
      console.error("view-snapshot: not in database", { id: id });
      return {
        statusCode: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: renderNotFoundPage(),
      };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: renderSnapshotPage(entry),
    };
  } catch (err) {
    console.error("view-snapshot error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "Server error loading snapshot. Check Netlify function logs.",
    };
  }
};
