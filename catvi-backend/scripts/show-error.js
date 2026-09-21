// Afișează motivul pentru care aplicația nu a pornit.
//
// Rulează din panou cu: Run script → show:error
//
// Sursa principală este startup-error.log, scris de server.js lângă aplicație.
// Raportul propriu al lui Passenger din /tmp aparține altui utilizator și de
// obicei nu poate fi citit din panou (EACCES), așa că este doar o rezervă.
const fs = require("node:fs");
const path = require("node:path");

const ownLog = path.join(__dirname, "..", "startup-error.log");

if (fs.existsSync(ownLog)) {
  const text = fs.readFileSync(ownLog, "utf8").trim();
  if (text) {
    // Ultima încercare este cea care ne interesează; fișierul se adună.
    const attempts = text.split(/\n(?=\[\d{4}-)/);
    const last = attempts[attempts.length - 1];
    console.log(`Din ${ownLog}`);
    console.log(`(${attempts.length} încercări înregistrate; o arăt pe ultima)`);
    console.log("=".repeat(70));
    console.log(last);
    console.log("=".repeat(70));
    console.log(
      "Șterge fișierul înainte de următorul test, ca să nu confunzi\n" +
        "încercările vechi cu cea nouă.",
    );
    process.exit(0);
  }
}

console.log(`Nu există ${ownLog}.`);
console.log(
  "Înseamnă fie că aplicația a pornit corect, fie că versiunea de pe server\n" +
    "nu are încă acest jurnal — atunci dă Pull/Deploy și Restart App.\n",
);

// Rezervă: raportul lui Passenger, dacă se întâmplă să fie citibil.
const roots = [
  "/tmp",
  process.env.TMPDIR,
  path.join(__dirname, "..", "..", "..", "tmp"),
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
  console.log("Niciun raport Passenger găsit în:", roots.join(", "));
  process.exit(0);
}

found.sort((a, b) => b.mtime - a.mtime);

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

let shown = false;
const denied = [];

for (const report of found) {
  let html;
  try {
    html = fs.readFileSync(report.full, "utf8");
  } catch (error) {
    // Cel mai frecvent EACCES: fișierul e al altui utilizator. Trecem mai
    // departe în loc să oprim scriptul, poate unul mai vechi e citibil.
    denied.push(`${report.full} — ${error.code || error.message}`);
    continue;
  }
  const blocks = [...html.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/gi)].map(
    (m) => m[1],
  );
  const text = (
    blocks.length ? blocks.join("\n\n") : html.replace(/<[^>]*>/g, " ")
  )
    .split("\n")
    .map((l) => decode(l).trimEnd())
    .join("\n")
    .trim();
  console.log(`Raport Passenger: ${report.full}`);
  console.log(`Data            : ${new Date(report.mtime).toISOString()}`);
  console.log("=".repeat(70));
  console.log(text.slice(0, 20000) || "(fără text utilizabil)");
  shown = true;
  break;
}

if (!shown) {
  console.log(`Am găsit ${found.length} rapoarte Passenger, dar niciunul citibil:`);
  for (const d of denied.slice(0, 5)) console.log("  " + d);
  console.log(
    "\nSunt scrise de alt utilizator, deci nu le poți deschide din panou.\n" +
      "Foloseşte startup-error.log (dă Pull/Deploy şi Restart App), sau treci\n" +
      "temporar Application Mode pe development: Passenger arată atunci\n" +
      "eroarea direct în browser.",
  );
}
