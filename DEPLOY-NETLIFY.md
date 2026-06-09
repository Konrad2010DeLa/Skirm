# Deploy Malros Snapshot Server on Netlify + Supabase

## Overview

| Piece | Role |
|-------|------|
| **Netlify** | HTTPS hosting + serverless API (`POST /api/snapshots`, `GET /snapshot/:id`) |
| **Supabase** | PostgreSQL persistence for snapshots |

Local dev (`npm start`) still uses in-memory storage. Production uses the files in `netlify/functions/` + Supabase.

---

## Part 1 — Supabase (database)

### 1. Create a project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Pick an organization, name the project (e.g. `malros-snapshots`), set a **database password** (save it), choose a region close to your players.
4. Wait until the project status is **Healthy** (~1–2 min).

### 2. Create the table

1. In the left sidebar, open **SQL Editor**.
2. Click **New query**.
3. Paste the contents of `supabase/schema.sql` from this folder.
4. Click **Run**. You should see `Success. No rows returned`.

### 3. Copy API credentials

1. Go to **Project Settings** (gear) → **API**.
2. Copy and save:
   - **Project URL** → you will set this as `SUPABASE_URL`
   - **service_role** key (under *Project API keys*, click Reveal) → `SUPABASE_SERVICE_ROLE_KEY`

**Important:** The `service_role` key bypasses Row Level Security. Use it **only** in Netlify environment variables. Never put it in the mod, Lua, or any client-side code.

---

## Part 2 — Git repo (required by Netlify)

Netlify deploys from Git. You need `Web/GameSnapshotServer` in a GitHub/GitLab/Bitbucket repo.

### Option A — Dedicated repo (simplest)

1. Create a new empty GitHub repo (e.g. `malros-snapshot-server`).
2. Copy **only** the `Web/GameSnapshotServer` folder contents into that repo root.
3. Commit and push.

### Option B — Whole mod repo

1. Push the full mod repo to GitHub.
2. In Netlify, set **Base directory** to `Web/GameSnapshotServer`.

---

## Part 3 — Netlify (hosting)

### 1. Create the site

1. Go to [https://app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**.
2. Connect your Git provider and select the repo.
3. Build settings (should auto-detect from `netlify.toml`):

   | Setting | Value |
   |---------|-------|
   | Base directory | *(empty if dedicated repo, or `Web/GameSnapshotServer`)* |
   | Build command | `npm install` |
   | Publish directory | `public` |
   | Functions directory | `netlify/functions` |

4. Click **Deploy site** (first deploy may fail until env vars are set — that's OK).

### 2. Set environment variables

**Site configuration** → **Environment variables** → **Add a variable** → **Add all**:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key |
| `PUBLIC_BASE_URL` | Your Netlify site URL, e.g. `https://malros-snapshots.netlify.app` (no trailing slash) |
| `SNAPSHOT_TTL_DAYS` | `30` (optional; `0` = never expire) |

`PUBLIC_BASE_URL` must match the URL players open in Steam overlay. If you add a custom domain later, update this.

### 3. Redeploy

**Deploys** → **Trigger deploy** → **Deploy site**.

### 4. Note your live URLs

After deploy succeeds:

- Upload: `https://YOUR-SITE.netlify.app/api/snapshots`
- Viewer: `https://YOUR-SITE.netlify.app/snapshot/{id}`

### 5. (Optional) Custom domain

1. **Domain management** → **Add a domain**.
2. Follow DNS instructions.
3. Netlify provisions HTTPS automatically.
4. Update `PUBLIC_BASE_URL` to `https://your-domain.com` and redeploy.

---

## Part 4 — Verify

Replace the host with your Netlify URL.

```bash
curl -X POST https://YOUR-SITE.netlify.app/api/snapshots \
  -H "Content-Type: application/json" \
  -d "{\"mod\":\"Malros\",\"turn\":10,\"gameName\":\"Test Lobby\",\"mapScript\":\"TestMap.lua\",\"optionsChecksum\":12345,\"isMultiplayer\":true,\"players\":[{\"slot\":0,\"team\":0,\"playerName\":\"Alice\",\"civilization\":\"Rome\",\"leader\":\"Augustus\",\"isHuman\":true,\"isAlive\":true}]}"
```

Expected response:

```json
{"success":true,"id":"...","viewUrl":"https://YOUR-SITE.netlify.app/snapshot/..."}
```

Open `viewUrl` in a browser — you should see Alice / Rome.

In Supabase **Table Editor** → `game_snapshots`, confirm a new row appeared.

---

## Part 5 — Point the mod at production

In `UI/MiniMap/MiniMapPanel.lua`:

```lua
local SKIRM_GAME_SNAPSHOT_UPLOAD_URL = "https://YOUR-SITE.netlify.app/api/snapshots";
```

Rebuild the DLL with `SKIRM_GAME_SNAPSHOT_UPLOAD` defined. Click the minimap share button in-game; Steam overlay should open the viewer.

---

## Local testing with Netlify Dev (optional)

1. Create `Web/GameSnapshotServer/.env`:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PUBLIC_BASE_URL=http://localhost:8888
```

2. Run:

```bash
npm install
npm run netlify:dev
```

3. Test against `http://localhost:8888/api/snapshots`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Upload returns 500 | Check Netlify **Functions** logs; verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |
| `viewUrl` points at wrong host | Set `PUBLIC_BASE_URL` to your public HTTPS URL and redeploy |
| Game says upload failed | Response must contain `"viewUrl":"https://..."` — test with curl first |
| Snapshot not found | Check Supabase table; TTL may have excluded old rows |
| 400 on invalid JSON | Expected; game shows error body |
| `Could not resolve "@supabase/supabase-js"` | Run `npm install` in `Web/GameSnapshotServer` before `netlify dev` |
| `Expected ";" but found "\x00"` on a function file | File was saved as UTF-16; re-save as UTF-8 (VS Code: bottom-right encoding → UTF-8) |
