/** Development proxy. Production Nginx routes /api directly to the Moldova API. */
const nextConfig = {
  experimental: {
    proxyClientMaxBodySize: "17mb",
    // Serverul de producție are glibc < 2.29, deci SWC nativ nu se încarcă și
    // Next cade pe WASM — mult mai costisitor ca memorie. Cu numărul implicit
    // de workeri (7 pe acea mașină), pasul „Collecting page data” depășește
    // limita și build-ul este ucis. Un singur worker ține consumul mărginit;
    // pentru cele 9 pagini ale proiectului, costul în timp este mic.
    // Ridică-l cu NEXT_BUILD_WORKERS când compilezi pe o mașină încăpătoare.
    cpus: Number(process.env.NEXT_BUILD_WORKERS || 1),
    webpackMemoryOptimizations: true,
  },
  // Source map-urile consumă memorie suplimentară exact în faza de prerender,
  // acolo unde build-ul cădea. Nu sunt necesare în producție.
  enablePrerenderSourceMaps: false,
  productionBrowserSourceMaps: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_PROXY_TARGET || "http://127.0.0.1:4000"}/api/:path*`,
      },
    ];
  },
};
export default nextConfig;
