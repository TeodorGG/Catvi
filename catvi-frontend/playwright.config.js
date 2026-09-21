const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 90000,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:4300",
    browserName: "chromium",
    channel: "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node e2e/api-server.cjs",
      url: "http://127.0.0.1:4301/api/health",
      env: {
        PORT: "4301",
        HOST: "127.0.0.1",
        DATABASE_URL: "",
        SQLITE_PATH: ":memory:",
        NODE_ENV: "development",
        ALLOWED_ORIGINS: "http://localhost:4300",
        SERVER_ID: "browser-test",
        SERVER_COUNTRY: "LOCAL",
      },
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 4300",
      url: "http://localhost:4300",
      env: {
        API_PROXY_TARGET: "http://127.0.0.1:4301",
        NEXT_PUBLIC_API_BASE: "/api",
        NEXT_DIST_DIR: ".next-e2e",
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
