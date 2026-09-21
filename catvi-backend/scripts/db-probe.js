// Diagnostic: încearcă mai multe moduri de conectare la PostgreSQL și
// raportează care funcționează. Rulează din panou cu: Run script → db:probe
//
// Există pentru că mesajul „Ident authentication failed” nu spune ce metodă
// de autentificare ar merge — doar că cea aleasă de pg_hba.conf a eșuat.
// Parola nu este afișată niciodată.
require("dotenv").config({
  path: require("node:path").join(__dirname, "..", ".env"),
  quiet: true,
});
const { parse } = require("pg-connection-string");
const { Client } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL lipsește din .env — nimic de testat.");
  process.exit(1);
}

const base = parse(url);
const sockets = ["/var/run/postgresql", "/tmp", "/var/lib/pgsql"];

const candidates = [
  { label: "ca în .env", host: base.host, port: base.port },
  { label: "TCP 127.0.0.1", host: "127.0.0.1", port: base.port || 5432 },
  { label: "TCP localhost", host: "localhost", port: base.port || 5432 },
  ...sockets.map((s) => ({ label: `socket ${s}`, host: s, port: undefined })),
  // Pe socket, peer auth folosește utilizatorul de sistem: încearcă și fără
  // user explicit, caz în care driverul îl ia din mediu.
  ...sockets.map((s) => ({
    label: `socket ${s} (user din sistem)`,
    host: s,
    port: undefined,
    omitUser: true,
  })),
];

const seen = new Set();

(async () => {
  console.log(`bază: ${base.database}   utilizator: ${base.user || "(din sistem)"}`);
  console.log("");
  let success = 0;

  for (const c of candidates) {
    const key = `${c.host}|${c.omitUser ? "" : base.user}`;
    if (!c.host || seen.has(key)) continue;
    seen.add(key);

    const client = new Client({
      host: c.host,
      port: c.port,
      database: base.database,
      ...(c.omitUser ? {} : { user: base.user, password: base.password }),
      connectionTimeoutMillis: 5000,
    });
    try {
      await client.connect();
      await client.query("SELECT 1");
      console.log(`  ✓ MERGE     ${c.label}`);
      success++;
    } catch (error) {
      // `localhost` încearcă și IPv6, și IPv4, iar eșecul ambelor vine ca
      // AggregateError, care are message gol. Fără asta, linia ar fi mută.
      const detail =
        error.message ||
        (error.errors || []).map((e) => e.message || e.code).join(" / ") ||
        error.code ||
        String(error);
      console.log(`  ✗ eșec      ${c.label}  —  ${detail}`);
    } finally {
      await client.end().catch(() => {});
    }
  }

  console.log("");
  if (success) {
    console.log(
      "Pune în .env varianta care merge. Pentru socket, forma este:\n" +
        "  DATABASE_URL=postgres://UTILIZATOR:PAROLA@/BAZA?host=/cale/socket\n" +
        "iar fără utilizator explicit:\n" +
        "  DATABASE_URL=postgres:///BAZA?host=/cale/socket",
    );
  } else {
    console.log(
      "Nicio variantă nu a mers. Dacă mesajele spun „Ident authentication\n" +
        "failed”, parola nu este consultată deloc: cere-i suportului host.md\n" +
        "să permită autentificare cu parolă (scram-sha-256 sau md5) pentru\n" +
        "utilizatorul tău, în loc de ident.",
    );
  }
})();
