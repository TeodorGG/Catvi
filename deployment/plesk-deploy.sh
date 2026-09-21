#!/bin/sh
# CATVI — acțiuni de deploy rulate de Plesk după fiecare "git pull".
#
# În Plesk: Git → Repository Settings → "Enable additional deployment actions",
# iar în casetă o singură linie:
#
#     sh deployment/plesk-deploy.sh
#
# Scriptul stă în repo, deci se versionează odată cu codul. Caseta din panou
# nu se mai modifică după prima configurare.
set -eu

# --- Rezolvarea versiunii de Node --------------------------------------
# Hostul catvi.md folosește nodenv. Dacă nu este selectată nicio versiune,
# shim-ul răspunde „nodenv: node: command not found” și enumeră versiunile
# instalate — deși npm pare să funcționeze. Fișierul .node-version din
# rădăcina proiectului acoperă cazul normal; NODENV_VERSION este plasa de
# siguranță când scriptul rulează din alt director.
if command -v nodenv >/dev/null 2>&1; then
  export NODENV_VERSION="${NODENV_VERSION:-22}"
fi

# Hosting cu Node propriu de Plesk, fără nodenv.
if ! command -v node >/dev/null 2>&1; then
  for dir in /opt/plesk/node/22/bin /opt/plesk/node/24/bin /opt/plesk/node/20/bin; do
    if [ -x "$dir/node" ]; then
      PATH="$dir:$PATH"
      break
    fi
  done
  export PATH
fi

# Verifică amândouă. npm poate fi în PATH fără ca `node` să se rezolve —
# exact situația care face ca scripturile postinstall să pice cu cod 127.
for bin in node npm; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "EROARE: '$bin' nu este disponibil în shell-ul de deploy." >&2
    echo "  nodenv: rulează 'nodenv versions', apoi setează NODENV_VERSION" >&2
    echo "          sau verifică fișierul .node-version din rădăcină." >&2
    echo "  Plesk:  verifică 'ls /opt/plesk/node/'." >&2
    exit 1
  fi
done

root=$(cd "$(dirname "$0")/.." && pwd)
echo "==> node $(node -v), npm $(npm -v)"
echo "==> rădăcina proiectului: $root"

# --- Backend -----------------------------------------------------------
# Fără build: Express rulează direct din sursă.
echo "==> backend: instalez dependențele de producție"
cd "$root/catvi-backend"
npm ci --omit=dev --no-audit --no-fund

# --- Frontend ----------------------------------------------------------
# devDependencies (eslint, prettier, playwright) nu sunt necesare pentru
# `next build` — verificat. Le omitem ca instalarea să fie mai mică.
echo "==> frontend: instalez dependențele de producție"
cd "$root/catvi-frontend"
npm ci --omit=dev --no-audit --no-fund

echo "==> frontend: compilez"
# Build-ul cere ~1,3 GB RAM. Dacă procesul este oprit fără mesaj, aceasta
# este cauza: vezi PLESK-RO.md, secțiunea despre limita de memorie.
npm run build

# Cache-ul Turbopack (~31 MB) nu este folosit la rulare. Îl ștergem pentru
# cota de disc; păstrează-l dacă preferi build-uri ulterioare mai rapide.
rm -rf .next/cache

# --- Repornirea aplicațiilor ------------------------------------------
# Passenger repornește aplicația când se modifică tmp/restart.txt din
# Application Root. Se face la final, după ce build-ul a reușit: dacă
# `npm run build` eșuează, `set -e` oprește scriptul aici și versiunea
# veche rămâne în funcțiune.
echo "==> repornesc aplicațiile"
for app in "$root/catvi-backend" "$root/catvi-frontend"; do
  mkdir -p "$app/tmp"
  touch "$app/tmp/restart.txt"
done

echo "==> deploy încheiat cu succes"
