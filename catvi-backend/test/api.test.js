const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const bcrypt = require("bcryptjs");
const { openStorage } = require("../storage");
const { createApp } = require("../app");
const { validateMeasurement, csvCell } = require("../measurement");
let db, server, app, base, cookie, token, savedId;
const payload = {
  consent: true,
  consentVersion: "2026-09-21",
  ping: 12,
  jitter: 2,
  httpSamples: 8,
  httpFailures: 0,
  downloadBytes: 4096,
  uploadBytes: 4096,
  downloadMs: 2500,
  uploadMs: 2500,
  region: "Chișinău",
  provider: "StarNet",
  connectionType: "ethernet",
};
before(async () => {
  process.env.SQLITE_PATH = ":memory:";
  db = await openStorage(process.env.TEST_DATABASE_URL || "");
  // TEST_DATABASE_URL must reference a disposable test database, never production.
  await db.query("DELETE FROM admin_audit");
  await db.query("DELETE FROM measurements");
  await db.query("DELETE FROM research_admins");
  await db.query(
    "INSERT INTO research_admins(id,email,password_hash,created_at) VALUES($1,$2,$3,$4)",
    [
      "test-admin",
      "test@example.md",
      await bcrypt.hash("test-password-123", 4),
      new Date().toISOString(),
    ],
  );
  app = createApp(db, {
    production: false,
    origins: ["http://localhost:3000"],
    secret: "test-only-secret-12345678901234567890",
    server: {
      id: "test-md",
      name: "Test Moldova",
      country: "MD",
      method: "http-v1",
    },
  });
  server = await new Promise((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
    s.once("error", reject);
  });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  app?.locals.cleanup();
  if (server) await new Promise((resolve) => server.close(resolve));
  await db?.close();
});
async function api(path, { method = "GET", body, headers = {} } = {}) {
  return fetch(base + path, {
    signal: AbortSignal.timeout(5000),
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
test("healthy database and empty public data; legacy endpoints are removed", async () => {
  assert.equal((await api("/health")).status, 200);
  assert.deepEqual(await (await api("/regions")).json(), []);
  assert.equal(
    (await api("/auth/register", { method: "POST", body: {} })).status,
    404,
  );
  assert.equal((await api("/wifi-points")).status, 404);
});
test("admin API rejects unauthenticated users and disallowed origins", async () => {
  for (const path of [
    "/admin/stats",
    "/admin/measurements",
    "/admin/export",
    "/admin/audit",
  ])
    assert.equal((await api(path)).status, 401);
  assert.equal(
    (await api("/health", { headers: { Origin: "https://attacker.example" } }))
      .status,
    403,
  );
  assert.equal(
    (
      await api("/auth/login", {
        method: "POST",
        body: { email: [], password: 123 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("/auth/login", {
        method: "POST",
        body: { email: "test@example.md", password: "wrong" },
      })
    ).status,
    401,
  );
});
test("bounded measurement transfers require a session", async () => {
  assert.equal((await api("/speedtest/download?size=4096")).status, 401);
  const response = await api("/speedtest/session", { method: "POST" });
  assert.equal(response.status, 201);
  token = (await response.json()).token;
  const headers = { "X-Test-Token": token };
  assert.equal(
    (await api("/speedtest/download?size=-1", { headers })).status,
    400,
  );
  assert.equal(
    (await api("/speedtest/download?size=999999999", { headers })).status,
    400,
  );
  assert.equal(
    (await api("/speedtest/result", { method: "POST", headers, body: payload }))
      .status,
    409,
  );
  for (let i = 0; i < 8; i++)
    assert.equal((await api("/speedtest/ping", { headers })).status, 204);
  const download = await api("/speedtest/download?size=4096", { headers });
  assert.match(download.headers.get("cache-control"), /no-transform/);
  const bytes = Buffer.from(await download.arrayBuffer());
  assert.equal(bytes.length, 4096);
  assert.ok(bytes.some((byte) => byte !== 0));
  assert.equal(
    (await api("/speedtest/upload", { method: "POST", body: {}, headers }))
      .status,
    415,
  );
  const upload = await fetch(base + "/speedtest/upload", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/octet-stream" },
    body: bytes,
  });
  assert.equal(upload.status, 200);
  assert.equal((await upload.json()).receivedBytes, 4096);
});
test("consent and valid metadata required; a session can only save once", async () => {
  const headers = { "X-Test-Token": token };
  for (const patch of [
    { consent: false },
    { region: "Fake region" },
    { downloadMs: -1 },
    { jitter: null },
    { httpFailures: 8 },
    { downloadBytes: 4097 },
  ]) {
    const response = await api("/speedtest/result", {
      method: "POST",
      headers,
      body: { ...payload, ...patch },
    });
    assert.ok([400, 409].includes(response.status));
  }
  const response = await api("/speedtest/result", {
    method: "POST",
    headers,
    body: payload,
  });
  assert.equal(response.status, 201);
  savedId = (await response.json()).id;
  assert.equal(
    (await api("/speedtest/result", { method: "POST", headers, body: payload }))
      .status,
    401,
  );
  const rows = await db.query("SELECT * FROM measurements");
  assert.equal(rows.length, 1);
  assert.equal(
    rows[0].down,
    (payload.downloadBytes * 8) / payload.downloadMs / 1000,
  );
  assert.equal(rows[0].region, "Chișinău");
  assert.equal(rows[0].location_source, "self-reported");
  assert.ok(!("ip" in rows[0]));
  assert.deepEqual(await (await api("/regions")).json(), []);
});
test("admin cookie authentication, filtered pagination and safe export", async () => {
  const response = await api("/auth/login", {
    method: "POST",
    body: { email: "test@example.md", password: "test-password-123" },
  });
  assert.equal(response.status, 200);
  cookie = response.headers.get("set-cookie").split(";")[0];
  assert.match(response.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  const headers = { Cookie: cookie };
  assert.equal((await api("/auth/me", { headers })).status, 200);
  const list = await (
    await api("/admin/measurements?region=Chi%C8%99in%C4%83u&page=1", {
      headers,
    })
  ).json();
  assert.equal(list.total, 1);
  assert.equal(list.rows.length, 1);
  assert.equal(
    (
      await (
        await api("/admin/measurements?provider=Orange", { headers })
      ).json()
    ).total,
    0,
  );
  assert.equal(
    (await api("/admin/measurements?from=invalid", { headers })).status,
    400,
  );
  const csv = await api("/admin/export", { headers });
  assert.equal(csv.status, 200);
  assert.match(await csv.text(), /download_bytes/);
  assert.equal(
    (await (await api("/admin/audit", { headers })).json()).length,
    1,
  );
});
test("public minimum sample threshold excludes local and short tests; exclusions are audited", async () => {
  const [source] = await db.query("SELECT * FROM measurements WHERE id=$1", [
    savedId,
  ]);
  for (let i = 0; i < 6; i++) {
    const row = {
      ...source,
      id: randomUUID(),
      quality: i === 4 ? "short" : "usable",
      server_country: i === 5 ? "LOCAL" : "MD",
    };
    const columns = Object.keys(row);
    await db.query(
      `INSERT INTO measurements(${columns.join(",")}) VALUES(${columns.map((_, i) => "$" + (i + 1)).join(",")})`,
      Object.values(row),
    );
  }
  const regions = await (await api("/regions")).json();
  assert.equal(regions.length, 1);
  assert.equal(Number(regions[0].sample_count), 5);
  const headers = { Cookie: cookie };
  assert.equal(
    (
      await api("/admin/measurements/" + savedId, {
        method: "PATCH",
        body: { reason: "x" },
        headers,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("/admin/measurements/" + savedId, {
        method: "PATCH",
        body: { reason: "=suspicious repeated sample" },
        headers,
      })
    ).status,
    200,
  );
  assert.deepEqual(await (await api("/regions")).json(), []);
  const audit = await (await api("/admin/audit", { headers })).json();
  assert.equal(audit[0].action, "exclude");
  const csv = await (await api("/admin/export", { headers })).text();
  assert.match(csv, /'=suspicious/);
  const [row] = await db.query("SELECT * FROM measurements WHERE id=$1", [
    savedId,
  ]);
  assert.equal(row.down, source.down);
  const stats = await (await api("/admin/stats", { headers })).json();
  assert.equal(Number(stats.total), 7);
  assert.equal(Number(stats.excluded), 1);
});
test("deactivating an admin immediately invalidates an existing cookie", async () => {
  await db.query("UPDATE research_admins SET active=0 WHERE id=$1", [
    "test-admin",
  ]);
  assert.equal(
    (await api("/admin/stats", { headers: { Cookie: cookie } })).status,
    401,
  );
});
test("validation rejects non-finite values and spreadsheet formulas are escaped", () => {
  assert.equal(validateMeasurement(payload), null);
  assert.equal(
    validateMeasurement({ ...payload, ping: Infinity }),
    "invalid_latency",
  );
  assert.equal(
    validateMeasurement({ ...payload, downloadBytes: 1.5 }),
    "invalid_transfer",
  );
  assert.equal(csvCell("=cmd()"), '"\'=cmd()"');
  assert.equal(csvCell('a"b'), '"a""b"');
});

test("short transfers are retained for review and consent-free sessions leave no record", async () => {
  const [before] = await db.query("SELECT COUNT(*) AS total FROM measurements");
  const makeSession = async () =>
    (await (await api("/speedtest/session", { method: "POST" })).json()).token;
  const privateToken = await makeSession();
  assert.equal(
    (
      await api("/speedtest/session", {
        method: "DELETE",
        headers: { "X-Test-Token": privateToken },
      })
    ).status,
    204,
  );
  assert.equal(
    (
      await api("/speedtest/ping", {
        headers: { "X-Test-Token": privateToken },
      })
    ).status,
    401,
  );
  const [unchanged] = await db.query(
    "SELECT COUNT(*) AS total FROM measurements",
  );
  assert.equal(Number(unchanged.total), Number(before.total));
  const shortToken = await makeSession(),
    headers = { "X-Test-Token": shortToken };
  for (let i = 0; i < 8; i++) await api("/speedtest/ping", { headers });
  await (await api("/speedtest/download?size=4096", { headers })).arrayBuffer();
  await fetch(base + "/speedtest/upload", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/octet-stream" },
    body: Buffer.alloc(4096),
  });
  const response = await api("/speedtest/result", {
    method: "POST",
    headers,
    body: { ...payload, downloadMs: 100 },
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).quality, "short");
  assert.deepEqual(await (await api("/regions")).json(), []);
});
