# Deploy on the Moldova host

The server must physically be in Moldova. Hosting and database credentials have not been configured by this code change.

## Existing PostgreSQL (the intended production setup)

Run one backend process and one Next.js frontend on the host, using a process manager or containers. Configure the backend from `.env.example`:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=4000
DATABASE_URL=postgres://catvi:ENCODED_PASSWORD@your-postgresql-host:5432/catvi
JWT_SECRET=<openssl rand -hex 48>
ALLOWED_ORIGINS=https://your-domain.md
SERVER_ID=md-chisinau-01
SERVER_NAME=Chișinău · CATVI 01
SERVER_COUNTRY=MD
TRUST_PROXY=1
```

Set the server label to its actual host location. Configure TLS to the database according to the provider; retain certificate verification. `TRUST_PROXY=1` assumes exactly one trusted reverse proxy and a backend that cannot be reached directly from the internet. Configure the forwarded headers exactly as in `nginx.conf`.

Install with `npm ci`, build the frontend with `npm run build`, and run `npm start` in each project. Provision an admin with the root README command. Do not reuse the old unverified-email admin mechanism.

Install `nginx.conf` using the actual domain and certificate paths; run `nginx -t` before reloading. `/api/` goes directly to Express, not through Next. Serve the frontend and API under the same HTTPS origin. Turn off all CDN/proxy caching, compression and buffering for measurement paths. If Brotli is enabled globally, disable it in the API location too. Keep backend port 4000 private.

## Optional self-contained containers

`compose.yml` includes PostgreSQL for environments without an existing database. For the existing hosted database, remove the `database` service/dependency and supply the provider's `DATABASE_URL` instead. Never start a second database by accident when you intend to use the existing one.

Copy `.env.example` to `.env`, replace every placeholder, then:

```sh
docker compose --env-file deployment/.env -f deployment/compose.yml up -d --build
```

Host Nginx connects to loopback ports 3000 and 4000. The database is private on the Compose network, with a named persistent volume. Dockerfiles exclude environment files and local databases.

## Backups and restoration

For a managed PostgreSQL service, enable daily backups and point-in-time recovery if offered. Keep an encrypted off-host copy in addition to the primary host. Establish and test your retention policy before collecting public data.

For the optional Compose database, create a custom-format dump:

```sh
docker compose --env-file deployment/.env -f deployment/compose.yml exec -T database pg_dump -U catvi -Fc catvi > catvi-backup.dump
```

Verify a backup by restoring into a **separate empty database**, never over the live research database:

```sh
pg_restore --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" catvi-backup.dump
```

Compare measurement/audit counts, verify an admin can log in, and retain the verification date. Do not treat untested dumps as a recovery plan. The app itself does not schedule backups or delete records for retention.

## Capacity and methodology checks

Start with one backend worker because rate limits and test tickets are in memory. Use a shared store (e.g. Redis) before scaling horizontally. Observe CPU, uplink saturation, concurrent tests, database growth and query latency. Regional averages currently use indexed aggregate queries; add maintained rollups and a suitable partition/retention scheme if volume warrants it.

Compare controlled wired tests against a known baseline and multiple ISP paths, then check behavior under concurrent load. Single-stream HTTP tests are affected by device limits, TCP/TLS overhead, VPNs and competing traffic. Neither server location nor a participant's selected region proves the route stays inside Moldova.

Public launch also requires operator/contact details, an explicit retention period and a log policy in the privacy page. The supplied API Nginx location disables access logging; document any load balancer or hosting-provider logs separately.

References: [Nginx proxy buffering](https://nginx.org/en/docs/http/ngx_http_proxy_module.html), [PostgreSQL logical backup/restore](https://www.postgresql.org/docs/17/backup-dump.html), [browser transfer-size/compression semantics](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming).
