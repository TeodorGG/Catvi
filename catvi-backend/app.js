const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { randomBytes, randomUUID } = require("node:crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validateMeasurement, csvCell } = require("./measurement");
const wrap = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

function createApp(db, config) {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store, no-transform");
    const origin = req.get("Origin");
    if (origin && !config.origins.includes(origin))
      return res.status(403).json({ error: "origin_denied" });
    next();
  });
  app.use(
    cors({
      origin: config.origins,
      credentials: true,
      exposedHeaders: ["Content-Length"],
    }),
  );
  const limiter = (limit, windowMs) =>
    rateLimit({
      limit,
      windowMs,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "rate_limited" },
    });
  const sessions = new Map();
  const cleanup = setInterval(() => {
    for (const [key, value] of sessions)
      if (value.expires < Date.now()) sessions.delete(key);
  }, 60000);
  cleanup.unref();
  app.locals.cleanup = () => clearInterval(cleanup);
  const randomChunk = randomBytes(1024 * 1024);
  const MAX_TRANSFER = 16 * 1024 * 1024;
  const BUDGET = 120000000;
  app.get(
    "/api/health",
    wrap(async (req, res) => {
      await db.query("SELECT 1");
      res.json({ ok: true });
    }),
  );
  app.get("/api/server", (req, res) => res.json(config.server));
  app.post("/api/speedtest/session", limiter(12, 3600000), (req, res) => {
    if (sessions.size >= 500)
      return res.status(503).json({ error: "server_busy" });
    const token = randomBytes(32).toString("hex");
    sessions.set(token, {
      id: randomUUID(),
      expires: Date.now() + 180000,
      reservedDown: 0,
      reservedUp: 0,
      down: 0,
      up: 0,
      pings: 0,
      active: 0,
    });
    res.status(201).json({ token, server: config.server });
  });
  function testSession(req, res, next) {
    const session = sessions.get(req.get("X-Test-Token"));
    if (!session || session.expires < Date.now() || session.saving)
      return res.status(401).json({ error: "invalid_test_session" });
    req.testSession = session;
    next();
  }
  app.use("/api/speedtest", testSession);
  app.get("/api/speedtest/ping", (req, res) => {
    if (++req.testSession.pings > 20)
      return res.status(429).json({ error: "ping_limit" });
    res.status(204).end();
  });
  app.delete("/api/speedtest/session", (req, res) => {
    sessions.delete(req.get("X-Test-Token"));
    res.status(204).end();
  });
  app.get("/api/speedtest/download", (req, res) => {
    const size = Number(req.query.size),
      s = req.testSession;
    if (!Number.isSafeInteger(size) || size < 1 || size > MAX_TRANSFER)
      return res.status(400).json({ error: "invalid_size" });
    if (s.reservedDown + size > BUDGET || s.active >= 4)
      return res.status(429).json({ error: "transfer_limit" });
    s.reservedDown += size;
    s.active++;
    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Length": String(size),
      "X-Accel-Buffering": "no",
    });
    res.once("finish", () => {
      s.down += size;
    });
    res.once("close", () => {
      s.active--;
    });
    let sent = 0;
    const pump = () => {
      while (sent < size && !res.destroyed) {
        const chunk = randomChunk.subarray(
          0,
          Math.min(size - sent, randomChunk.length),
        );
        sent += chunk.length;
        if (!res.write(chunk)) {
          res.once("drain", pump);
          return;
        }
      }
      if (!res.destroyed) res.end();
    };
    pump();
  });
  // Before JSON parsing: stream and discard the upload without disk writes.
  app.post("/api/speedtest/upload", (req, res) => {
    const s = req.testSession;
    if (req.get("Content-Type") !== "application/octet-stream")
      return res.status(415).json({ error: "binary_required" });
    const length = Number(req.get("Content-Length"));
    if (!Number.isSafeInteger(length) || length < 1 || length > MAX_TRANSFER)
      return res.status(413).json({ error: "upload_too_large" });
    if (s.reservedUp + length > BUDGET || s.active >= 4)
      return res.status(429).json({ error: "transfer_limit" });
    s.reservedUp += length;
    s.active++;
    req.once("close", () => {
      s.active--;
    });
    let received = 0;
    req.on("data", (chunk) => {
      received += chunk.length;
      if (received > length || received > MAX_TRANSFER) req.destroy();
    });
    req.once("end", () => {
      s.up += received;
      res.json({ receivedBytes: received });
    });
    req.once("error", () => {
      if (!res.headersSent && !res.destroyed)
        res.status(400).json({ error: "upload_failed" });
    });
  });
  app.use(express.json({ limit: "16kb" }));
  app.post(
    "/api/speedtest/result",
    wrap(async (req, res) => {
      const error = validateMeasurement(req.body);
      if (error) return res.status(400).json({ error });
      const b = req.body,
        s = req.testSession;
      if (
        s.active ||
        s.pings < b.httpSamples - b.httpFailures ||
        s.down < b.downloadBytes ||
        s.up < b.uploadBytes
      )
        return res.status(409).json({ error: "incomplete_test" });
      s.saving = true;
      const quality =
        b.downloadMs < 250 || b.uploadMs < 250 ? "short" : "usable";
      const row = {
        id: s.id,
        created_at: new Date().toISOString(),
        server_id: config.server.id,
        server_name: config.server.name,
        server_country: config.server.country,
        down: (b.downloadBytes * 8) / b.downloadMs / 1000,
        up: (b.uploadBytes * 8) / b.uploadMs / 1000,
        ping: b.ping,
        jitter: b.jitter,
        http_failures: b.httpFailures,
        http_samples: b.httpSamples,
        download_bytes: b.downloadBytes,
        upload_bytes: b.uploadBytes,
        download_ms: b.downloadMs,
        upload_ms: b.uploadMs,
        region: b.region,
        provider: b.provider,
        connection_type: b.connectionType,
        location_source: "self-reported",
        method_version: config.server.method,
        consent_version: b.consentVersion,
        quality,
      };
      try {
        const columns = Object.keys(row);
        await db.query(
          `INSERT INTO measurements (${columns.join(",")}) VALUES (${columns.map((_, i) => "$" + (i + 1)).join(",")})`,
          Object.values(row),
        );
      } catch (error) {
        s.saving = false;
        throw error;
      }
      sessions.delete(req.get("X-Test-Token"));
      res.status(201).json({ id: row.id, quality });
    }),
  );
  function cookie(token, age) {
    return `catvi_admin=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${age}${config.production ? "; Secure" : ""}`;
  }
  app.post(
    "/api/auth/login",
    limiter(10, 900000),
    wrap(async (req, res) => {
      const { email, password } = req.body || {};
      if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        email.length > 254 ||
        password.length > 200
      )
        return res.status(400).json({ error: "invalid_input" });
      const [admin] = await db.query(
        "SELECT * FROM research_admins WHERE email=$1 AND active=1",
        [email.trim().toLowerCase()],
      );
      const valid = await bcrypt.compare(
        password,
        admin?.password_hash ||
          "$2a$10$QXaQXaQXaQXaQXaQXaQXaeGBbzEIcOBLu.yTM.mQSbMQ4hsEh1q6y",
      );
      if (!admin || !valid)
        return res.status(401).json({ error: "invalid_credentials" });
      const token = jwt.sign({}, config.secret, {
        subject: admin.id,
        expiresIn: "8h",
        algorithm: "HS256",
        issuer: "catvi-admin",
      });
      res.set("Set-Cookie", cookie(token, 28800)).json({ email: admin.email });
    }),
  );
  app.post("/api/auth/logout", (req, res) =>
    res.set("Set-Cookie", cookie("", 0)).json({ ok: true }),
  );
  async function adminAuth(req, res, next) {
    try {
      const token = (req.headers.cookie || "")
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("catvi_admin="))
        ?.slice(12);
      const claims = jwt.verify(token, config.secret, {
        algorithms: ["HS256"],
        issuer: "catvi-admin",
      });
      const [admin] = await db.query(
        "SELECT id, email FROM research_admins WHERE id=$1 AND active=1",
        [claims.sub],
      );
      if (!admin) return res.status(401).json({ error: "unauthorized" });
      req.admin = admin;
      next();
    } catch {
      res.status(401).json({ error: "unauthorized" });
    }
  }
  app.get("/api/auth/me", adminAuth, (req, res) => res.json(req.admin));
  app.use("/api/admin", limiter(120, 60000), adminAuth);
  const publicWhere = "quality='usable' AND server_country='MD'";
  app.get(
    "/api/regions",
    limiter(120, 60000),
    wrap(async (req, res) => {
      res.json(
        await db.query(
          `SELECT region, AVG(down) AS avg_down, AVG(up) AS avg_up, COUNT(*) AS sample_count FROM measurements WHERE ${publicWhere} AND region IS NOT NULL GROUP BY region HAVING COUNT(*) >= 5 ORDER BY region`,
        ),
      );
    }),
  );
  app.get(
    "/api/admin/stats",
    wrap(async (req, res) => {
      const [totals] = await db.query(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN quality='excluded' THEN 1 ELSE 0 END) AS excluded, SUM(CASE WHEN quality='short' THEN 1 ELSE 0 END) AS short FROM measurements`,
      );
      const [today] = await db.query(
        "SELECT COUNT(*) AS total FROM measurements WHERE created_at >= $1",
        [new Date().toISOString().slice(0, 10) + "T00:00:00.000Z"],
      );
      const [speeds] = await db.query(
        `SELECT AVG(down) AS down, AVG(up) AS up, COUNT(DISTINCT region) AS regions FROM measurements WHERE ${publicWhere}`,
      );
      res.json({
        ...totals,
        today: today.total,
        ...speeds,
        database: db.dialect,
        server: config.server,
      });
    }),
  );
  function filters(req) {
    const clauses = [],
      params = [];
    for (const key of ["region", "provider", "quality"])
      if (req.query[key]) {
        if (typeof req.query[key] !== "string" || req.query[key].length > 80)
          throw Object.assign(new Error("invalid_filter"), { status: 400 });
        params.push(req.query[key]);
        clauses.push(`${key}=$${params.length}`);
      }
    for (const [key, operator] of [
      ["from", ">="],
      ["to", "<="],
    ])
      if (req.query[key]) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query[key]))
          throw Object.assign(new Error("invalid_date"), { status: 400 });
        params.push(
          req.query[key] +
            (key === "from" ? "T00:00:00.000Z" : "T23:59:59.999Z"),
        );
        clauses.push(`created_at ${operator} $${params.length}`);
      }
    return {
      where: clauses.length ? " WHERE " + clauses.join(" AND ") : "",
      params,
    };
  }
  app.get(
    "/api/admin/measurements",
    wrap(async (req, res) => {
      const { where, params } = filters(req);
      const page = Math.max(
        1,
        Math.min(100000, parseInt(req.query.page, 10) || 1),
      );
      const [count] = await db.query(
        "SELECT COUNT(*) AS total FROM measurements" + where,
        params,
      );
      const rows = await db.query(
        `SELECT * FROM measurements${where} ORDER BY created_at DESC, id LIMIT 25 OFFSET $${params.length + 1}`,
        [...params, (page - 1) * 25],
      );
      res.json({ rows, total: Number(count.total), page, pageSize: 25 });
    }),
  );
  app.get(
    "/api/admin/export",
    wrap(async (req, res) => {
      const { where, params } = filters(req);
      const [count] = await db.query(
        "SELECT COUNT(*) AS total FROM measurements" + where,
        params,
      );
      if (Number(count.total) > 10000)
        return res
          .status(400)
          .json({ error: "narrow_export_filters", limit: 10000 });
      const rows = await db.query(
        `SELECT * FROM measurements${where} ORDER BY created_at DESC, id LIMIT 10000`,
        params,
      );
      const columns = [
        "id",
        "created_at",
        "server_id",
        "server_country",
        "region",
        "provider",
        "connection_type",
        "down",
        "up",
        "ping",
        "jitter",
        "http_failures",
        "http_samples",
        "download_bytes",
        "upload_bytes",
        "download_ms",
        "upload_ms",
        "quality",
        "excluded_reason",
        "location_source",
        "method_version",
        "consent_version",
      ];
      await db.query(
        "INSERT INTO admin_audit(id,admin_id,action,reason,created_at) VALUES($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          req.admin.id,
          "export",
          JSON.stringify(req.query),
          new Date().toISOString(),
        ],
      );
      res.set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="catvi-measurements.csv"',
      });
      res.send(
        "\uFEFF" +
          [
            columns.join(","),
            ...rows.map((row) =>
              columns.map((key) => csvCell(row[key])).join(","),
            ),
          ].join("\r\n"),
      );
    }),
  );
  app.patch(
    "/api/admin/measurements/:id",
    wrap(async (req, res) => {
      const { reason } = req.body || {};
      if (
        typeof reason !== "string" ||
        reason.trim().length < 5 ||
        reason.length > 500
      )
        return res.status(400).json({ error: "reason_required" });
      const now = new Date().toISOString();
      const row = await db.transaction(async (query) => {
        const [updated] = await query(
          "UPDATE measurements SET quality='excluded', excluded_reason=$1, reviewed_at=$2, reviewed_by=$3 WHERE id=$4 RETURNING id",
          [reason.trim(), now, req.admin.id, req.params.id],
        );
        if (updated)
          await query(
            "INSERT INTO admin_audit(id,admin_id,measurement_id,action,reason,created_at) VALUES($1,$2,$3,$4,$5,$6)",
            [
              randomUUID(),
              req.admin.id,
              req.params.id,
              "exclude",
              reason.trim(),
              now,
            ],
          );
        return updated;
      });
      if (!row) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/admin/audit",
    wrap(async (req, res) =>
      res.json(
        await db.query(
          "SELECT a.*, u.email FROM admin_audit a JOIN research_admins u ON u.id=a.admin_id ORDER BY a.created_at DESC LIMIT 100",
        ),
      ),
    ),
  );
  app.use((req, res) => res.status(404).json({ error: "not_found" }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || 500;
    if (status >= 500)
      console.error("API request failed:", error.code || error.name);
    res
      .status(status)
      .json({
        error: status >= 500 ? "server_error" : error.type || error.message,
      });
  });
  return app;
}
module.exports = { createApp };
