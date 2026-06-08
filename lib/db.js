"use strict";

const { createClient } = require("@supabase/supabase-js");

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function getTtlDays() {
  const days = Number(process.env.SNAPSHOT_TTL_DAYS || 30);
  return Number.isFinite(days) ? days : 30;
}

async function insertSnapshot(id, snapshot) {
  const supabase = getSupabase();
  const { error } = await supabase.from("game_snapshots").insert({
    id: id,
    snapshot: snapshot,
  });
  if (error) {
    throw error;
  }
}

async function fetchSnapshot(id) {
  const supabase = getSupabase();
  const ttlDays = getTtlDays();
  let query = supabase
    .from("game_snapshots")
    .select("id, snapshot, received_at")
    .eq("id", id);

  if (ttlDays > 0) {
    const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("received_at", cutoff);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return {
    id: data.id,
    snapshot: data.snapshot,
    receivedAt: data.received_at,
  };
}

module.exports = { insertSnapshot, fetchSnapshot };
