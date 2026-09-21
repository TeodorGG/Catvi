#!/bin/sh
# Construiește release/catvi-upload.zip pentru instalarea pe host fără SSH.
#
# Frontend-ul este compilat aici, pe mașina de dezvoltare, iar directorul
# .next intră în arhivă: pe hosting partajat `next build` este frecvent oprit
# de limita de memorie. Pe server rămâne doar `npm ci --omit=dev`.
#
# Rulează din rădăcina proiectului:  sh deployment/make-release.sh
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
out="$root/release/catvi-upload.zip"
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

echo "Node: $(node -v)"

echo "==> Compilez frontend-ul (build curat)"
# .next poate conține resturi din `next dev` (directorul dev/, devtools,
# pachete scoase între timp din dependențe). Pornim de la zero ca arhiva să
# conțină exact build-ul de producție curent.
rm -rf catvi-frontend/.next
( cd catvi-frontend && npm run build >/dev/null )

echo "==> Pregătesc arhiva"
mkdir -p "$stage/catvi"
for item in README.md catvi-backend catvi-frontend deployment; do
  cp -R "$item" "$stage/catvi/"
done

# Nimic din ce urmează nu are voie să ajungă pe server: secrete, baze de date
# locale, dependențe compilate pe Mac, istoricul git.
cd "$stage/catvi"
rm -rf catvi-backend/node_modules catvi-frontend/node_modules
rm -rf catvi-frontend/.next-e2e catvi-frontend/.next-preview
# Cache-ul de build Turbopack nu este folosit la rulare și ocupă ~170 MB.
rm -rf catvi-frontend/.next/cache
rm -rf catvi-frontend/test-results catvi-frontend/playwright-report
rm -rf release .git
find . -name '.env' -delete
find . -name '.env.local' -delete
find . -name '.env.local.bak' -delete
find . -name '*.db' -delete
find . -name '*.db-shm' -delete
find . -name '*.db-wal' -delete
find . -name '.DS_Store' -delete

# Verificare de siguranță: oprește-te dacă a rămas un secret în stage.
if find . \( -name '.env' -o -name '*.db' \) | grep -q .; then
  echo "EROARE: au rămas fișiere sensibile în arhivă" >&2
  exit 1
fi

mkdir -p "$root/release"
rm -f "$out"
cd "$stage"
zip -qr "$out" catvi
echo "==> Gata: $out ($(du -h "$out" | cut -f1))"
echo "    .next inclus: $(unzip -l "$out" | grep -c 'catvi/catvi-frontend/.next/') fișiere"
