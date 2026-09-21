// Passenger pornește procesul cu alt director curent decât rădăcina
// aplicației, iar dotenv caută .env relativ la cwd. Fără calea explicită,
// .env nu este citit sub Passenger, NODE_ENV=production rămâne setat de
// panou, iar config() oprește procesul — „exited prematurely”.
require("dotenv").config({
  path: require("node:path").join(__dirname, ".env"),
  quiet: true,
});
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
  // Sub Passenger, un proces care moare la pornire apare în log doar ca
  // „The application process exited prematurely”, fără niciun motiv. Tot ce
  // se scrie aici ajunge în fișierul de eroare al lui Passenger, deci merită
  // spus exact ce s-a întâmplat și în ce context.
  const fs = require("node:fs");
  const envPath = require("node:path").join(__dirname, ".env");
  const lines = [
    `[${new Date().toISOString()}] CATVI backend nu a pornit: ${error.message}`,
    `  cwd         : ${process.cwd()}`,
    `  NODE_ENV    : ${process.env.NODE_ENV || "(nesetat)"}`,
    `  .env        : ${envPath} ${fs.existsSync(envPath) ? "(găsit)" : "(LIPSEȘTE)"}`,
    `  DATABASE_URL: ${process.env.DATABASE_URL ? "(setat)" : "(nesetat → ar folosi SQLite)"}`,
    ...(error.code ? [`  cod         : ${error.code}`] : []),
    ...(error.stack ? [error.stack] : []),
    "",
  ];
  for (const line of lines) console.error(line);

  // Passenger salvează propriul raport în /tmp, dar acela aparține altui
  // utilizator și nu poate fi citit din panou. Scriem același lucru lângă
  // aplicație, unde avem drepturi. Directorul nu este Document Root, deci
  // fișierul nu este servit public.
  try {
    fs.appendFileSync(
      require("node:path").join(__dirname, "startup-error.log"),
      lines.join("\n"),
    );
  } catch {
    // dacă nici aici nu putem scrie, stderr de mai sus rămâne singura urmă
  }
  process.exit(1);
});
