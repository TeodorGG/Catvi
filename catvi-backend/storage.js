const path = require("node:path");

// The legacy catvi.db is deliberately never opened: its averages include seed data.
async function openStorage(url = process.env.DATABASE_URL) {
  let query, close, transaction;
  const dialect = url ? "postgresql" : "sqlite";
  if (url) {
    const { Pool } = require("pg");
    const pool = new Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
    });
    query = async (sql, params = []) => (await pool.query(sql, params)).rows;
    close = () => pool.end();
    transaction = async (work) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work(
          async (sql, params = []) => (await client.query(sql, params)).rows,
        );
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    };
  } else {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(
      process.env.SQLITE_PATH || path.join(__dirname, "research.db"),
    );
    db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
    const execute = async (sql, params = []) => {
      const ordered = [];
      const text = sql.replace(/\$(\d+)/g, (_, n) => {
        ordered.push(params[Number(n) - 1]);
        return "?";
      });
      const stmt = db.prepare(text);
      return stmt.all(...ordered);
    };
    close = async () => db.close();
    let queue = Promise.resolve();
    query = (sql, params = []) => {
      const next = queue.then(() => execute(sql, params));
      queue = next.catch(() => {});
      return next;
    };
    transaction = (work) => {
      const next = queue.then(async () => {
        db.exec("BEGIN IMMEDIATE");
        try {
          const result = await work(execute);
          db.exec("COMMIT");
          return result;
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      });
      queue = next.catch(() => {});
      return next;
    };
  }
  // Idempotent initial migration. Run one migration process during deployment.
  // Subsequent schema changes should be added as numbered migrations.
  const schema = [
    `CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS research_admins (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS measurements (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, server_id TEXT NOT NULL,
      server_name TEXT NOT NULL, server_country TEXT NOT NULL,
      down DOUBLE PRECISION NOT NULL CHECK(down >= 0 AND down <= 100000),
      up DOUBLE PRECISION NOT NULL CHECK(up >= 0 AND up <= 100000),
      ping DOUBLE PRECISION NOT NULL CHECK(ping >= 0 AND ping <= 30000),
      jitter DOUBLE PRECISION NOT NULL CHECK(jitter >= 0 AND jitter <= 30000),
      http_failures INTEGER NOT NULL CHECK(http_failures >= 0),
      http_samples INTEGER NOT NULL CHECK(http_samples > 0 AND http_failures < http_samples),
      download_bytes BIGINT NOT NULL CHECK(download_bytes > 0),
      upload_bytes BIGINT NOT NULL CHECK(upload_bytes > 0),
      download_ms DOUBLE PRECISION NOT NULL CHECK(download_ms > 0),
      upload_ms DOUBLE PRECISION NOT NULL CHECK(upload_ms > 0),
      region TEXT, provider TEXT, connection_type TEXT NOT NULL,
      location_source TEXT NOT NULL DEFAULT 'self-reported',
      method_version TEXT NOT NULL, consent_version TEXT NOT NULL,
      quality TEXT NOT NULL CHECK(quality IN ('usable','short','excluded')),
      excluded_reason TEXT, reviewed_at TEXT, reviewed_by TEXT REFERENCES research_admins(id))`,
    `CREATE INDEX IF NOT EXISTS measurements_created ON measurements(created_at DESC, id)`,
    `CREATE INDEX IF NOT EXISTS measurements_region ON measurements(region, quality, created_at)`,
    `CREATE INDEX IF NOT EXISTS measurements_provider ON measurements(provider, created_at)`,
    `CREATE TABLE IF NOT EXISTS admin_audit (
      id TEXT PRIMARY KEY, admin_id TEXT NOT NULL REFERENCES research_admins(id),
      measurement_id TEXT REFERENCES measurements(id), action TEXT NOT NULL,
      reason TEXT, created_at TEXT NOT NULL)`,
    `INSERT INTO schema_migrations(version, applied_at) VALUES (1, $1) ON CONFLICT(version) DO NOTHING`,
  ];
  try {
    for (const sql of schema)
      await query(sql, sql.includes("$1") ? [new Date().toISOString()] : []);
  } catch (error) {
    await close();
    throw error;
  }
  return { query, close, transaction, dialect };
}

module.exports = { openStorage };
