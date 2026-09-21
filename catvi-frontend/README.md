# CATVI frontend

Next.js App Router / React. See the [root README](../README.md) for project setup.

Pages: `/` speed test, `/harta` regional data, `/istoric` browser history, `/despre` methodology, `/confidentialitate` collection details, `/admin` authenticated administration. Old `/login` and `/abonamente` links redirect to their replacements.

`lib/speedtestEngine.js` measures real HTTP bytes and elapsed time with abort/timeout support. It uses one adaptive stream in each direction and rejects truncated/compressed download responses. It does not measure UDP loss or certify advertised subscription speed. Upload results use server-acknowledged bytes.

The design uses local system fonts, a warm white background, dark typography and one blue accent. No external font requests, map-tile service, or geolocation service is required. Region shapes are derived from the existing geoBoundaries GeoJSON (CC BY 4.0, attributed in the UI).

`NEXT_PUBLIC_API_BASE` defaults to `/api`. `API_PROXY_TARGET` defaults to `http://127.0.0.1:4000` for local development. In production Nginx routes `/api/` directly to the Moldova measurement server. Avoid a CDN or Next.js proxy for measurement traffic.

`npm run test:e2e` uses installed Google Chrome and isolated test servers. The old service worker is retired and its CATVI caches are cleared, preventing cached resources from affecting measurements.
