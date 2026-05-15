# FSM Leaflet Platform

Multi-template Free School Meals leaflet customization platform. Lets schools, local authorities, and (later) housing associations customise and publish a printable A4 information leaflet based on the NAWRA v11 template.

Brief: [`reference/STAGE2_brief_school_admin_system_v2.md`](reference/STAGE2_brief_school_admin_system_v2.md)

## Stack

- **Backend:** Node.js + Express, TypeScript (run with `tsx`, no build step in dev)
- **Database:** SQLite (better-sqlite3)
- **Frontend:** Vite + React + TypeScript
- **PDF/PNG export:** Playwright (headless Chromium)
- **QR code:** `qrcode` library, server-side
- **AI re-write (Pass B):** Anthropic SDK, Claude Sonnet

## Layout

```
fsm-leaflet/
├── server/       Express API, SQLite, GIAS importer, render pipeline
├── client/       Vite + React editor UI
├── templates/    Raw HTML/CSS for each leaflet template (NAWRA, entitledto-LA, ...)
├── reference/    Brief, reference PNGs (the visual targets)
└── .env.example  Copy to .env and fill in
```

## First-time setup

```sh
npm install
npx playwright install chromium -w server
cp .env.example .env
npm run migrate -w server
npm run seed -w server
npm run gias:import -w server   # downloads ~50 MB CSV from DfE
npm run dev
```

Skip the `playwright install` step if you don't need PDF export yet; the server will boot fine, only the PDF endpoints fail (with a clear message).

- Server: <http://localhost:4000>
- Client (Vite dev): <http://localhost:5173>

## Deploying

This repo includes a `Dockerfile` and `render.yaml`. To deploy on [Render](https://render.com):

1. Sign in to Render with your GitHub account.
2. New → Blueprint → pick this repo. Render reads `render.yaml` and provisions the service.
3. Wait ~3 min for the first build. Open the URL Render gives you (e.g. `fsm-leaflet.onrender.com`).
4. Set `ANTHROPIC_API_KEY` in the Render dashboard before testing AI re-write (Pass B).
5. **Before any non-trivial sharing:** re-enable the admin password gate — see the comments in `server/src/routes/admin.ts` and `client/src/admin/AdminDashboard.tsx`.

The free tier sleeps after 15 min of inactivity; first request wakes it in ~10s.

## Build status

- [x] **Pass A** — foundation, no auth
- [x] **Pass B (partial)** — magic-link auth, platform-admin UI (currently ungated for demo), PDF export, sites-CSV import
- [ ] **Pass B remaining** — AI re-write with fact-check, translation, transactional email, template-versioning UI, Sentry/backups
