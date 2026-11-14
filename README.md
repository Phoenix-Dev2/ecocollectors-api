# eco-collectors API

Express 4 + MariaDB (mysql2) API for the eco-collectors web app. Production runs in Docker on a Raspberry Pi behind a Cloudflare Tunnel (`https://api-eco.barkaziro.co.il`).

## Layout
- `server.js` loads `.env`, checks `JWT_SECRET` (32+ characters) and starts `app.js`.
- `app.js` is the Express app: CORS, `/healthz`, routes, 404 and error handlers.
- `routes/` maps URLs to `controllers/`, with auth, roles and rate limits applied per route.
- `middleware/auth.js`: `requireAuth`, `optionalAuth` and `requireRole(...)`. The token comes from `Authorization: Bearer` (preferred) or the `access_token` cookie. Role and `active` are read from the database on every request.
- `constants.js` holds the roles, request statuses and join statuses.

## Run locally
```
npm install
npm run dev
```
The local `.env` needs `DB_*`, `JWT_SECRET`, `GMAIL_*`, `CONTACT_US_MAIL` and `CLIENT_URL*`.

## Tests
These are integration tests: the real app runs against a throwaway MariaDB in Docker. They never touch the `.env` database, and they refuse anything but a local database whose name ends in `_test`.
```
npm run test:db:start   # once: MariaDB 11.4 on 127.0.0.1:3307
npm test
npm run test:db:stop
```
Each test file recreates the database from `test/schema.sql` (the live schema, structure only). Keep that file in step with schema changes. E-mail is stubbed.
