// Isolated browser-test fixture. No production users or database are touched.
const { createRequire } = require("node:module");
const backendRequire = createRequire(
  require.resolve("../../catvi-backend/package.json"),
);
const { openStorage } = require("../../catvi-backend/storage");
const { createApp } = require("../../catvi-backend/app");
const { config } = require("../../catvi-backend/config");
(async () => {
  const db = await openStorage("");
  const hash = await backendRequire("bcryptjs").hash(
    "browser-test-password",
    4,
  );
  await db.query(
    "INSERT INTO research_admins(id,email,password_hash,created_at) VALUES($1,$2,$3,$4)",
    ["browser-admin", "admin@example.md", hash, new Date().toISOString()],
  );
  const app = createApp(db, config());
  const server = app.listen(4301, "127.0.0.1");
  process.on("SIGTERM", () => {
    app.locals.cleanup();
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
