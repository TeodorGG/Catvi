// Oprește un proces rămas care ocupă portul aplicației — tipic unul pornit
// din greșeală cu „Run script → start”, care ține 127.0.0.1:4000 și împiedică
// Passenger să pornească aplicația reală.
//
// Rulează din panou cu: Run script → kill:stale
// Alt port:             PORT=4001 înainte de rulare
//
// Nu are nevoie de lsof, ss sau fuser: citește direct /proc, deci merge și pe
// hosting partajat unde utilitarele lipsesc. Poate opri doar procesele
// utilizatorului curent, ceea ce este exact ce trebuie aici.
const fs = require("node:fs");

const PORT = Number(process.env.PORT || 4000);

// Liniile din /proc/net/tcp au adresa ca "0100007F:0FA0" — adresă și port în
// hexazecimal. Starea 0A înseamnă LISTEN.
function listeningInodes(file, port) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const inodes = [];
  for (const line of text.split("\n").slice(1)) {
    const f = line.trim().split(/\s+/);
    if (f.length < 10) continue;
    const [, local, , state] = f;
    if (state !== "0A") continue;
    const hexPort = local.split(":")[1];
    if (!hexPort || parseInt(hexPort, 16) !== port) continue;
    inodes.push(f[9]);
  }
  return inodes;
}

function pidsForInodes(inodes) {
  const wanted = new Set(inodes.map((i) => `socket:[${i}]`));
  const found = new Set();
  let pids;
  try {
    pids = fs.readdirSync("/proc").filter((d) => /^\d+$/.test(d));
  } catch {
    return [];
  }
  for (const pid of pids) {
    let fds;
    try {
      fds = fs.readdirSync(`/proc/${pid}/fd`);
    } catch {
      continue; // proces al altui utilizator, sau deja încheiat
    }
    for (const fd of fds) {
      let link;
      try {
        link = fs.readlinkSync(`/proc/${pid}/fd/${fd}`);
      } catch {
        continue;
      }
      if (wanted.has(link)) {
        found.add(Number(pid));
        break;
      }
    }
  }
  return [...found];
}

function describe(pid) {
  try {
    return fs
      .readFileSync(`/proc/${pid}/cmdline`)
      .toString()
      .replace(/\0/g, " ")
      .trim();
  } catch {
    return "(necunoscut)";
  }
}

if (!fs.existsSync("/proc/net/tcp")) {
  console.error(
    "Acest script funcționează doar pe Linux (are nevoie de /proc).\n" +
      "Pe serverul din Plesk va merge.",
  );
  process.exit(1);
}

const inodes = [
  ...listeningInodes("/proc/net/tcp", PORT),
  ...listeningInodes("/proc/net/tcp6", PORT),
];

if (!inodes.length) {
  console.log(`Portul ${PORT} este liber. Nimic de oprit.`);
  process.exit(0);
}

const pids = pidsForInodes(inodes).filter((p) => p !== process.pid);

if (!pids.length) {
  console.log(
    `Portul ${PORT} este ocupat, dar procesul aparține altui utilizator.\n` +
      "Nu îl poți opri din panou — cere-i suportului host.md să îl oprească.",
  );
  process.exit(1);
}

for (const pid of pids) {
  console.log(`PID ${pid}: ${describe(pid)}`);
  try {
    process.kill(pid, "SIGTERM");
    console.log(`  → SIGTERM trimis`);
  } catch (error) {
    console.log(`  → nu am putut opri procesul: ${error.message}`);
  }
}

setTimeout(() => {
  const remaining = pidsForInodes([
    ...listeningInodes("/proc/net/tcp", PORT),
    ...listeningInodes("/proc/net/tcp6", PORT),
  ]).filter((p) => p !== process.pid);

  for (const pid of remaining) {
    try {
      process.kill(pid, "SIGKILL");
      console.log(`PID ${pid}: nu a răspuns la SIGTERM → SIGKILL`);
    } catch {}
  }
  console.log(
    remaining.length
      ? `Portul ${PORT} a fost eliberat forțat.`
      : `Portul ${PORT} este acum liber.`,
  );
}, 2000).unref();
