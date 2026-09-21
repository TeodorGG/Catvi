// Raportează ce fișiere de configurare vede build-ul și ce adresă de API a
// ajuns efectiv în bundle-ul compilat.
//
// Rulează din panoul aplicației frontend: Run script → env:check
//
// Există pentru că NEXT_PUBLIC_* se compilează definitiv în bundle, iar dacă
// valoarea nu ajunge la build nu se vede nicăieri în panou — aplicația pur și
// simplu se comportă ca și cum variabila n-ar exista.
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
console.log("Director aplicație:", root);
console.log("Director curent   :", process.cwd());
console.log("");

// --- 1. Fișierele de mediu, în ordinea de prioritate a lui Next ------------
const order = [
  ".env.production.local",
  ".env.local",
  ".env.production",
  ".env",
];

console.log("Fișiere de mediu (primul găsit câștigă pentru o cheie dată):");
let any = false;
for (const name of order) {
  const full = path.join(root, name);
  if (!fs.existsSync(full)) {
    console.log(`  ${name.padEnd(24)} lipsește`);
    continue;
  }
  any = true;
  const lines = fs
    .readFileSync(full, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  console.log(`  ${name.padEnd(24)} EXISTĂ (${lines.length} setări)`);
  for (const line of lines) {
    const eq = line.indexOf("=");
    if (eq < 0) {
      console.log(`      ??? linie fără '=': ${JSON.stringify(line)}`);
      continue;
    }
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    // NEXT_PUBLIC_* ajunge oricum în bundle-ul public, deci nu e un secret.
    const shown = key.startsWith("NEXT_PUBLIC_") ? value : "(ascuns)";
    console.log(`      ${key} = ${shown}`);
  }
}
if (!any) {
  console.log("\n  Niciun fișier de mediu. Build-ul va folosi valorile implicite.");
}

// --- 2. Ce a ajuns de fapt în bundle ---------------------------------------
console.log("\nCe este compilat în bundle-ul actual:");
const staticDir = path.join(root, ".next", "static");
if (!fs.existsSync(staticDir)) {
  console.log("  .next/static lipsește — aplicația nu a fost compilată încă.");
  process.exit(0);
}

const found = new Set();
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".js")) {
      const text = fs.readFileSync(full, "utf8");
      for (const m of text.matchAll(/https?:\/\/[a-z0-9.-]+(?::\d+)?\/api/gi))
        found.add(m[0]);
      if (/["']\/api["']/.test(text)) found.add("/api  (relativ, same-origin)");
    }
  }
};
walk(staticDir);

if (found.size) {
  for (const f of found) console.log("  " + f);
} else {
  console.log("  (nicio adresă de API identificată)");
}

const manifest = path.join(root, ".next", "routes-manifest.json");
if (fs.existsSync(manifest)) {
  try {
    const m = JSON.parse(fs.readFileSync(manifest, "utf8"));
    const rw = (m.rewrites?.afterFiles || m.rewrites || [])[0];
    if (rw) console.log("\nRewrite /api compilat:", rw.destination);
  } catch {}
}

console.log(
  "\nDacă adresa de mai sus nu este cea dorită, valoarea nu a ajuns la build:\n" +
    "pune-o în .env.production, lângă package.json, și rulează din nou deploy.",
);
