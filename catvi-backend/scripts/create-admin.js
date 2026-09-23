require("dotenv").config({
  path: require("node:path").join(__dirname, "..", ".env"),
  quiet: true,
});
const { randomUUID } = require("node:crypto");
const bcrypt = require("bcryptjs");
const { openStorage } = require("../storage");
async function main() {
  // Argumentul rămâne varianta preferată într-un terminal. Panoul Plesk însă
  // rulează scripturile fără argumente, așa că acceptăm și o variabilă de
  // mediu — de pus temporar în .env, alături de parolă, și ștearsă imediat.
  const email = (process.argv[2] || process.env.CATVI_ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();
  const password = process.env.CATVI_ADMIN_PASSWORD;
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !password ||
    password.length < 12 ||
    Buffer.byteLength(password) > 72
  )
    throw new Error(
      "Setează CATVI_ADMIN_EMAIL și CATVI_ADMIN_PASSWORD (12–72 octeți UTF-8)\n" +
        "în catvi-backend/.env, apoi rulează admin:create și șterge-le imediat.\n" +
        "Într-un terminal poți da emailul și ca argument:\n" +
        "  npm run admin:create -- email@exemplu.md",
    );
  const db = await openStorage();
  try {
    const hash = await bcrypt.hash(password, 12);
    await db.query(
      "INSERT INTO research_admins(id,email,password_hash,created_at) VALUES($1,$2,$3,$4)",
      [randomUUID(), email, hash, new Date().toISOString()],
    );
    console.log("Administrator created. Sign in at /admin.");
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(
    error.code === "23505" || error.code?.startsWith("ERR_SQLITE")
      ? "Administrator already exists or database rejected the record."
      : error.message,
  );
  process.exitCode = 1;
});
