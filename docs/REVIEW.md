# Frontend/backend review — 2026-09-21

## Findings addressed

| Finding | Change |
| --- | --- |
| Seeded speeds mixed with real regional submissions; offline map also fabricated values | New clean research dataset; no demo data or fallback averages; original database untouched |
| City selector changed a label but used one endpoint | Actual server identity comes from backend configuration; no fictional selector |
| Test history required registration | Anonymous tests, browser-local history, optional research consent |
| Manual admin edits could rewrite region averages | Read-only measured values; exclusion with reason and transactional audit |
| Anyone registering an allowlisted email could become admin without proving ownership | Public registration removed; trusted CLI admin provisioning |
| JWT stored in localStorage, role trusted for 30 days | 8-hour HttpOnly cookie and database authorization checks on each request |
| Broad CORS, weak fallback secret in production, unlimited upload stream | Explicit origins, production validation, per-session byte/concurrency limits, request limits |
| Compressible download payload could inflate apparent speed | Random payload, no-store/no-transform headers, client compression/truncation checks |
| HTTP failures presented as packet loss | Explicit HTTP latency/jitter/failure labeling; no UDP/ICMP loss claim |
| UI included subscription ads, placeholder apps/legal links, Wi-Fi sharing and notification infrastructure unrelated to collection | Removed from active UI/API and dependencies; methodology and data explanation added |
| Frontend used manual DOM updates and no reliable cancellation | React state, timeout/abort support, partial tests not saved |
| Cache-first service worker could intercept traffic and stale pages | Retirement worker unregisters and clears CATVI caches |
| Next development proxy truncated uploads larger than 10 MB | 17 MB proxy allowance; production Nginx bypasses Next entirely |
| SVG floating-point differences caused hydration warnings | Stable rounded SVG coordinates |

## Architecture and limits

PostgreSQL in production, separate SQLite database locally; common integration suite. Measurement metadata is constrained and parameterized, indexed, timestamped, versioned, and consented. No raw IP/GPS/user-agent is saved in measurement records. Local data and legacy users are intentionally not automatically imported because of demo contamination and the old admin-provisioning model.

Browser timings remain client reports. Server tickets verify that corresponding transfers occurred, not that every timing or selected ISP/region is truthful. The sample is voluntary and can contain repeated participants. Results are not a contract-speed certification or proof of a wholly domestic network route.

Single-process tickets/rate limits are appropriate for the initial deployment. Shared tickets/limits are needed before multiple workers. Regional aggregate queries have indexes, but there are no materialized rollups/partitions yet. Backup scheduling, retention deletion, operator identity/contact, and load/ISP-path validation remain deployment responsibilities.

## Review artifacts

- `review/home-desktop.png`: rendered desktop landing page.
- `review/home-mobile.png`: rendered mobile landing page.
- `review/admin-desktop.png`: admin view from an isolated test fixture, not production data.

The API integration suite covers authorization, consent, validation, receipts, replay prevention, public thresholds, exclusions/auditing, filtering, exports and revocation. Browser tests cover real transfers, consent and no-consent flows, cancellation, history, admin workflow and mobile overflow. See the root README for reproducible commands.

Fast connections can reach the data budget before the 5-second target. The minimum eligible duration is 250 ms, not 2 seconds: a 2-second floor would systematically drop typical gigabit measurements at the 115 MB client cap. The full durations/bytes remain available for downstream quality analysis.
