# CATVI measurement API

See the [root README](../README.md) for setup, PostgreSQL, admin provisioning and tests.

- `app.js`: public measurement, consent, session limits, authentication and admin routes.
- `storage.js`: PostgreSQL pool, SQLite development adapter, versioned initial schema.
- `measurement.js`: validation and CSV encoding.
- `config.js`: production configuration checks.
- `scripts/create-admin.js`: trusted administrator provisioning.
- `test/api.test.js`: integration tests for either database engine.

Public endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Database health |
| `GET /api/server` | Actual configured endpoint identity |
| `POST /api/speedtest/session` | Create an ephemeral measurement ticket |
| `GET /api/speedtest/ping` | HTTP round-trip measurement |
| `GET /api/speedtest/download?size=...` | Bounded, noncompressible bytes |
| `POST /api/speedtest/upload` | Stream/discard bounded binary bytes |
| `POST /api/speedtest/result` | Save a completed test with explicit consent |
| `DELETE /api/speedtest/session` | Dispose of the ephemeral ticket |
| `GET /api/regions` | Eligible regional averages, minimum 5 samples |

Measurement endpoints after ticket creation require `X-Test-Token`. Each session expires after 3 minutes, accepts at most 120 MB per transfer direction, 20 ping requests, and 4 concurrent transfers. Each individual transfer is bounded to 16 MiB. At most 500 sessions are held in memory; session creation is limited to 12/hour/IP. No session data is written to disk before a consented result.

Admin routes require the login cookie. All API responses are `no-store, no-transform`. CORS accepts only configured origins; JSON bodies are limited to 16 KB; binary uploads bypass the JSON parser. Login is limited to 10 attempts per 15 minutes/IP. Limits are process-local: deploy **one API worker** initially; add a shared session/rate-limit store before using multiple workers or replicas.

An active admin is looked up on every protected request. The original JWT/localStorage login and email-based admin promotion were removed. Existing legacy accounts are not imported automatically; provision authorized admins explicitly.
