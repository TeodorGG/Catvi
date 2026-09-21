/** Development proxy. Production Nginx routes /api directly to the Moldova API. */
const nextConfig = {
  experimental: { proxyClientMaxBodySize: "17mb" },
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
