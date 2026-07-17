# ScheduleBot

WhatsApp scheduled-message bot with a web dashboard (imported project).

## Tech Stack
- Node.js + Express, EJS views
- WhatsApp connection via `atexovi-baileys`
- Schedule storage: PostgreSQL (via `DATABASE_URL`), falls back to in-memory if unset

## Running on Replit
- `npm start` runs `node src/server.js`, bound to `0.0.0.0:5000` (the "Start application" workflow does this).
- Uses Replit's built-in PostgreSQL database automatically via the `DATABASE_URL` env var provided by the environment — no manual secret setup was needed.
- `PORT`, `TZ`, `DEFAULT_DIAL_CODE` are set as shared env vars in `.replit`.
- To link a WhatsApp account, open the dashboard's Account page and scan the QR/pairing code — until then the dashboard shows "Offline" and some API calls return 409, which is expected pre-connection.

## Notes
- The imported `.env.example` contained a live-looking Neon Postgres connection string. It was left untouched but is not used — the app connects to Replit's own Postgres instead. Treat that credential as compromised if it was ever real.
- Fixed the WhatsApp `.schedule` command's "open web schedule" button: `getPublicBaseUrl()` in `src/services/whatsappService.js` only checked `PUBLIC_URL`/`APP_URL`/Railway env vars, so on Replit (none of those set) it fell back to `http://localhost:3000`, which is unreachable from a phone. Added `REPLIT_DOMAINS`/`REPLIT_DEV_DOMAIN` as candidates so the button now points to the live `https://<repl>.replit.dev` URL.

## User preferences
None recorded yet.
