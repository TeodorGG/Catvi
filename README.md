# CATVI — Moldova internet measurements

Romanian-first internet speed testing, voluntary research collection, regional statistics, and an authenticated research admin panel. Next.js and Express remain separate applications.

## Run locally

Use Node.js 24 or newer. Install dependencies in both projects:

```sh
npm ci --prefix catvi-backend
npm ci --prefix catvi-frontend
```

Start the API and frontend in separate terminals:

```sh
cd catvi-backend
cp .env.example .env  # only when creating a new environment; preserve existing credentials
npm run dev
```

```sh
cd catvi-frontend
npm run dev
```

Open http://localhost:3000. The frontend uses same-origin `/api`; Next.js proxies to port 4000 in development. Restart any old backend process after upgrading. Public tests need no account. A separate `research.db` is used locally when `DATABASE_URL` is absent. The original `catvi.db` and its WAL files are untouched and are never read by the new application.

## PostgreSQL

Set `DATABASE_URL` in `catvi-backend/.env` to your existing PostgreSQL service. The API applies the initial idempotent schema migration on startup. Use a dedicated CATVI database/schema and a dedicated database role; do not use the PostgreSQL superuser. Only the deployment migration role needs DDL access; after the first migration, runtime can use a restricted role if startup DDL is removed into a separate deployment migration step.

```dotenv
DATABASE_URL=postgres://catvi:URL_ENCODED_PASSWORD@database-host:5432/catvi
```

For remote PostgreSQL, configure certificate-verified TLS as required by the hosting provider. Do not disable certificate verification. The pool has 10 connections and bounded connection/query timeouts. Measurements have database constraints, foreign keys, and indexes by time, region, and provider. Exclusion and audit insertion share a transaction. Schema version 1 is recorded in `schema_migrations`; subsequent changes should be explicit numbered migrations.

```sh
npm run db:check --prefix catvi-backend
```

Production requires PostgreSQL, a strong signing secret, explicit HTTPS origins, and the real measurement-server identity. SQLite is a development convenience.

## Create an administrator

There is no public registration or automatic promotion based on an unverified email. Provision admins from a trusted server terminal. In zsh/bash, avoid putting passwords in shell history:

```sh
cd catvi-backend
read -s CATVI_ADMIN_PASSWORD
export CATVI_ADMIN_PASSWORD
npm run admin:create -- your-email@example.md
unset CATVI_ADMIN_PASSWORD
```

Enter the password after `read`, then press Enter. Use at least 12 characters and at most 72 UTF-8 bytes. Sign in at `/admin`. Admin cookies are HttpOnly, SameSite=Strict, and Secure in production, and expire after 8 hours. Disable an admin by setting `research_admins.active=0`; authorization checks the current database record on every request. Rotating `JWT_SECRET` invalidates all sessions.

Admin features: total/today counts, usable Moldova averages, region/provider/quality/date filters, 25-row pages, CSV export up to 10,000 filtered records, exclusion with a reason, and the latest 100 audit entries. Measured speeds cannot be edited.

## What is collected

The unchecked contribution checkbox is optional. Without consent the server keeps only short-lived session/traffic counters and in-memory IP rate-limit counters; the completed result is stored in browser history only. With consent, the API records:

- Download/upload byte counts and elapsed milliseconds, with server-derived Mbps.
- Mean HTTP latency, jitter, HTTP failure count and sample count.
- Server ID/name/country, timestamp, methodology and consent versions.
- Optional self-reported region/provider and connection type.
- Quality classification and any subsequent exclusion reason/reviewer.

No IP, GPS coordinates, visitor account, advertising ID, or user agent is stored in measurement rows. Browser-reported timings and participant-provided context are unverified. Session receipts and bounds reduce casual fabrication but do not make this a fraud-proof or representative dataset.

Public regional averages require at least 5 usable tests against a server configured as `MD`. Transfers under 250 milliseconds, manually excluded results, and development-server results do not qualify. No seeded/demo measurements are loaded. The map represents measured experience, not verified network coverage.

## Moldova deployment

See [deployment instructions](deployment/README.md), [Compose](deployment/compose.yml), and [Nginx configuration](deployment/nginx.conf). The frontend and measurement API should share a public HTTPS origin, with `/api/` routed directly to the Moldova API. Do not put measurement traffic behind a CDN, tunnel, response compression, or buffering proxy. Next.js buffering is acceptable for development only; its upload limit is configured above the API's bounded payload size.

A Moldova endpoint measures the route to that endpoint. It does **not** prove the entire route stays within Moldova or measure all international internet destinations. Validate the host's physical location, transit/peering, available uplink capacity and throughput under concurrent clients before launch.

Before public collection, fill in the operator identity/contact, retention period and infrastructure-log policy on `/confidentialitate`. There are no analytics/ad SDKs. Keep the service as a private preview until that information and the hosting configuration are ready.

## Verification

```sh
npm test --prefix catvi-backend
npm run lint --prefix catvi-frontend
npm run build --prefix catvi-frontend
npm run test:e2e --prefix catvi-frontend
```

Browser tests use locally installed Google Chrome, isolated ports 4300/4301, an in-memory database, and a `.next-e2e` build directory. They exercise real byte transfers, consent/save, cancellation, history, regional empty states, admin login/export/exclusion/logout, and mobile layout. Screenshots are written to `docs/review/`.

Run the same API suite on a **disposable** PostgreSQL database with `TEST_DATABASE_URL=... npm test --prefix catvi-backend`. The suite clears its own test tables at setup: never point it at a production database.

See [review and implementation notes](docs/REVIEW.md) for changes and remaining operational work.
