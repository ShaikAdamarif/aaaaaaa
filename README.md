# AV PROP MISSION — self-hosted with live cross-device sync

This zip contains everything needed to run the rental site as a **live server**
with a real database. All admin data (HRs, projects, leads, etc.) is stored in
a SQL database file inside this folder and **automatically synced** across every
device that opens the site.

## What's inside
- `server.js` — Node + Express server with built-in SQLite database
- `public/` — the website (HTML/CSS/JS)
- `data/avprop.db` — created on first run; this **IS** your database (SQL,
  file-based, ships with the project — no separate MySQL install needed)

> Note: a real MySQL server cannot live "inside" a zip — it needs a
> separately installed daemon. SQLite is the standard embedded SQL database
> for exactly this use case: same SQL, single file, zero setup. If you must
> use MySQL later, only `server.js` needs to change; the client stays the same.

## Run locally
```
npm install
npm start
```
Open http://localhost:3000

## Run as a live server (so phone + laptop share data)
Deploy to any host with a persistent disk:
- **Render** (recommended — `render.yaml` included): create a Web Service,
  attach a 1 GB disk mounted at `/var/data`. Done.
- **Railway / Fly.io / VPS**: `node server.js`, mount or persist `./data`.
- Do **not** use Netlify / Vercel / Cloudflare Pages — no persistent disk.

## How sync works
- Every key the app writes that starts with `av_` (HRs, projects, leads, …)
  is pushed to the server and saved in `data/avprop.db`.
- Every other connected device receives the change within ~1 second over
  Server-Sent Events — no refresh needed.
- `av_session` stays per-device, so each browser keeps its own login.
- A **Sync** badge appears at the bottom-right of every page:
  - green dot = live connected
  - amber = syncing
  - red = offline / reconnecting
  - **click it to force a full re-sync from the server**

## Admin login from any device
1. Admin logs in on Phone A → creates HRs / projects → logs out.
2. Opens the site on Laptop B → logs in as the same admin.
3. On page load the client pulls everything from `data/avprop.db` → all data
   is there. No data loss, ever.
4. Two admins online at once see each other's edits in real time.

## Backup
Just copy `data/avprop.db` — that single file is your entire database.

## Deploy to Vercel + Neon
1. Push this folder to GitHub.
2. Import the repo in Vercel.
3. In Vercel → Project Settings → Environment Variables, add:
   - `DATABASE_URL` = your Neon Postgres connection string (must contain `?sslmode=require`)
4. Deploy. Vercel will use `vercel.json` to route everything to `server.js`.
5. All HR / User / Admin data, attendance records, login–logout timings live in Neon and are shared across every device that opens the site.

## Attendance flow (new)
- Admin dashboard → **Attendance Records** tab → toggle the big button to TURN ON / OFF.
- When ON, HR and User dashboards show a **Mark Attendance** tab with a webcam capture button.
- After capture, the user sees **"Your attendance marked successfully ✅"**.
- Admin sees every attendance entry (with photo) plus every login / logout timing and total worked duration.
- Per-person **Export Excel** and **Export PDF** buttons download a full report (attendance + timings) for any HR or User.
