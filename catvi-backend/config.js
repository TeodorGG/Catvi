const { randomBytes } = require("node:crypto");

function config() {
  const production = process.env.NODE_ENV === "production";
  const secret = process.env.JWT_SECRET;
  if (
    production &&
    (!secret ||
      secret.length < 32 ||
      /change|example|secret-change/.test(secret))
  )
    throw new Error("Set a random JWT_SECRET of at least 32 characters.");
  if (production && !process.env.DATABASE_URL)
    throw new Error("Production requires DATABASE_URL (PostgreSQL).");
  if (
    production &&
    (!process.env.SERVER_ID ||
      !process.env.SERVER_NAME ||
      process.env.SERVER_COUNTRY !== "MD")
  )
    throw new Error(
      "Configure the actual Moldova measurement server: SERVER_ID, SERVER_NAME, SERVER_COUNTRY=MD.",
    );
  if (production && !process.env.ALLOWED_ORIGINS)
    throw new Error("Set ALLOWED_ORIGINS to the public HTTPS origin.");
  const origins = (
    process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000"
  )
    .split(",")
    .map((s) => s.trim());
  if (
    origins.some(
      (origin) =>
        origin === "*" || (production && !origin.startsWith("https://")),
    )
  )
    throw new Error(
      "ALLOWED_ORIGINS must contain explicit HTTPS origins in production.",
    );
  return {
    production,
    secret: secret || randomBytes(48).toString("hex"),
    origins,
    server: {
      id: process.env.SERVER_ID || "local-development",
      name: process.env.SERVER_NAME || "Server de dezvoltare",
      country: process.env.SERVER_COUNTRY || "LOCAL",
      method: "http-v1",
      maxTestMB: 240,
    },
  };
}
module.exports = { config };
