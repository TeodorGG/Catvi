// Găsește și afișează ultimul raport de eroare lăsat de Passenger.
//
// Rulează din panou cu: Run script → show:error
//
// Logul domeniului spune doar „The application process exited prematurely” și
// trimite la un fișier /tmp/passenger-error-XXXX.html. Sub Plesk, acel /tmp
// este de obicei cel al abonamentului (chroot), greu de deschis din panou.
// Scriptul caută în toate locurile plauzibile și scoate partea utilă: ce a
// scris procesul pe stdout și stderr înainte să moară.
const fs = require("node:fs");
const path = require("node:path");

const roots = [
  "/tmp",
  process.env.TMPDIR,
  path.join(__dirname, "..", "..", "..", "tmp"), // tmp-ul abonamentului
  path.join(__dirname, "..", "tmp"),
].filter(Boolean);

const found = [];
for (const dir of roots) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    continue;
  }
  for (const name of entries) {
    if (!/^passenger-error.*\.html$/.test(name)) continue;
    const full = path.join(dir, name);
    try {
      found.push({ full, mtime: fs.statSync(full).mtimeMs });
    } catch {}
  }
}

if (!found.length) {
  console.log("Niciun raport passenger-error găsit. Am căutat în:");
  for (const r of roots) console.log("  " + r);
  console.log(
    "\nDacă aplicația nu a mai încercat să pornească de la ultima repornire,\n" +
      "dă întâi Restart App, apoi rulează din nou acest script.",
  );
  process.exit(0);
}

found.sort((a, b) => b.mtime - a.mtime);
const latest = found[0];
console.log(`Raport: ${latest.full}`);
console.log(`Data  : ${new Date(latest.mtime).toISOString()}`);
console.log("=".repeat(70));

const html = fs.readFileSync(latest.full, "utf8");

// Passenger pune ieșirea procesului în blocuri <pre>. Dacă nu găsim, curățăm
// tot documentul de etichete și afișăm ce a rămas.
const blocks = [...html.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/gi)].map((m) =>
  m[1],
);
const decode = (s) =>
  s
    // Diacriticele româneşti apar ca entităţi numerice (&#537; = ș), deci
    // decodarea doar a celor numite ar lăsa mesajul ciuruit.
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

const text = (blocks.length ? blocks.join("\n\n") : html.replace(/<[^>]*>/g, " "))
  .split("\n")
  .map((l) => decode(l).trimEnd())
  .filter((l, i, a) => l.trim() || (a[i - 1] || "").trim())
  .join("\n")
  .trim();

console.log(text.slice(0, 20000) || "(raportul nu conține text utilizabil)");
