require("dotenv").config({ quiet: true });
const { createApp } = require("./app");
const { openStorage } = require("./storage");
const { config } = require("./config");
async function main() {
  const settings = config();
  const db = await openStorage();
  const app = createApp(db, settings);
  const server = app.listen(
    process.env.PORT || 4000,
    process.env.HOST || "127.0.0.1",
    () => console.log(`CATVI API ready (${db.dialect}, ${settings.server.id})`),
  );
  server.requestTimeout = 90000;
  server.headersTimeout = 15000;
  function stop() {
    app.locals.cleanup();
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
