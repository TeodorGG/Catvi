require("dotenv").config({
  path: require("node:path").join(__dirname, "..", ".env"),
  quiet: true,
});
const { openStorage } = require("../storage");
(async () => {
  const db = await openStorage();
  try {
    console.log({
      database: db.dialect,
      migrations: await db.query("SELECT * FROM schema_migrations"),
    });
  } finally {
    await db.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
