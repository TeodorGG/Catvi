# Instalare CATVI pe Plesk, fără acces SSH

Procedura concretă pentru serverul `217.26.150.25`, unde panoul este **Plesk**
și accesul SSH este **„Forbidden”**. Tot ce urmează se face din panou.

Pentru contextul general și mesajul de trimis către suportul host.md, vezi
[`HOST-MD-RO.md`](HOST-MD-RO.md). Pentru un VPS cu acces complet, vezi
[`README.md`](README.md) și [`nginx.conf`](nginx.conf).

---

## 0. Structura pe server

Codul stă într-un director **privat**, lângă `httpdocs`, nu în el:

```
/var/www/vhosts/DOMENIU/
├── httpdocs/          ← public; rămâne GOL
├── catvi/             ← privat; aici stă codul
│   ├── catvi-backend/
│   ├── catvi-frontend/
│   └── deployment/
├── logs/
└── tmp/
```

`httpdocs` este directorul public al domeniului: orice ajunge acolo poate fi
descărcat de oricine, inclusiv `.git/` (cu care se clonează tot istoricul) și
`catvi-backend/.env` în momentul în care ar fi creat acolo — adică parola de
PostgreSQL și `JWT_SECRET`. Plesk blochează implicit fișierele care încep cu
punct, dar asta nu acoperă restul surselor și nu e o garanție pe care merită
să te bazezi pentru secrete.

Aplicațiile nu au nevoie să fie publice ca să ruleze — vezi secțiunea 3, care
explică de ce nu se copiază nimic în `httpdocs`.

**De făcut, dacă primul deploy a mers în `httpdocs`:** golește-l și schimbă
calea din *Git → Repository Settings → Deployment path* în `catvi`. Altfel
următorul `git push` îl reumple și mutarea manuală se pierde.

> Nimic sensibil nu a ajuns pe GitHub: în repo sunt urmărite doar fișierele
> `.env.example`. `.env`, `*.db` și `*.db-wal` sunt acoperite de `.gitignore`.

---

## 1. Ce a fost verificat deja

Testat pe Node.js **22.23.2** — exact versiunea oferită de panoul tău:

| Verificare | Rezultat |
| --- | --- |
| `npm test` (backend) | 9/9 teste trec |
| `npm run build` (frontend) | compilează curat, 9 rute |
| Arhiva `release/catvi-upload.zip` extrasă curat, `npm ci --omit=dev`, pornire | toate rutele răspund |

Proiectul declara `"node": ">=24.0.0"` în `catvi-backend/package.json`. Era o
supra-declarație: nicio dependență nu cere 24 (`next` ≥20.9, `pg` ≥16,
`helmet` ≥18). Am corectat-o la `>=22.0.0`, altfel `npm ci` ar fi afișat
avertismentul `EBADENGINE` la fiecare instalare.

`node:sqlite` este încărcat leneș, doar când lipsește `DATABASE_URL`, deci în
producție cu PostgreSQL nu se atinge deloc.

---

## 2. Precondiții de confirmat în panou

1. **Websites & Domains → Node.js** există. Dacă nu, cere activarea extensiei.
2. Poți înregistra **două** aplicații Node.js: frontend și backend.
3. Poți adăuga **Additional nginx directives** pentru domeniu.
4. Ai datele de conectare la PostgreSQL.

Dacă 1 sau 2 nu sunt posibile pe planul curent, restul procedurii nu se poate
aplica — mesajul din `HOST-MD-RO.md` §4 cere exact aceste confirmări.

---

## 3. Nu se copiază nimic în `httpdocs`

Aceasta nu este o aplicație care „se compilează și se pune în directorul
public”. Nu există pas de copiere către `httpdocs`, și nici nu trebuie să
existe.

`npm run build` **nu** produce un site static. Produce `.next/`, un bundle de
server care rulează în Node. În tot proiectul nu există niciun `index.html`:
fiecare pagină este generată de proces, la cerere. Dacă ai pune `.next` în
`httpdocs`, browserul ar primi fișiere JavaScript de server, nu un site.

Passenger pornește aplicația ca **proces**, iar Nginx îi trimite cererile
direct. Fișierele din `httpdocs` nu intră în ecuație. De aceea codul are voie
să stea într-un director privat: nu este servit ca fișiere, ci executat.

Traseul unei cereri:

```
browser → Nginx (Plesk) → Passenger → procesul Node (server.js) → răspuns
                                       ↑
                    codul din catvi/, niciodată din httpdocs
```

Singurul director servit ca fișiere este `catvi-frontend/public/`, cu cele
cinci resurse statice (favicon, iconițe, `sw.js`, GeoJSON-ul hărții). Next.js
le servește oricum singur; dacă vrei să le preia Nginx direct, pune
`Document Root` pe el, conform tabelului de mai jos.

### Cele două câmpuri din Plesk

| Câmp | Ce înseamnă | Valoare pentru frontend |
| --- | --- | --- |
| **Application Root** | unde stă codul pe care îl execută Passenger | `catvi/catvi-frontend` |
| **Document Root** | ce servește Nginx ca fișiere, înainte de aplicație | `catvi/catvi-frontend/public` |

`<application root>/public` este convenția Passenger, deci configurația de
mai sus este cea standard. `httpdocs` rămâne **gol** și nefolosit.

### De făcut acum

1. **Golește `httpdocs`** de codul copiat acolo de primul deploy.
2. **Schimbă calea de deploy** în *Git → Repository Settings → Deployment
   path*, din `httpdocs` în `catvi`. Altfel următorul `git push` reumple
   `httpdocs` cu tot repozitoriul, iar mutarea manuală se pierde.
3. Verifică din browser că dau 404: `https://DOMENIU/README.md`,
   `https://DOMENIU/catvi-backend/package.json`, `https://DOMENIU/.git/config`.

---

## 4. Topologia

Un singur origin public, ca browserul să nu facă cereri cross-origin în timpul
măsurătorii (un preflight CORS ar distorsiona latența măsurată):

- `https://DOMENIU/` → aplicația Node.js **frontend** (Next.js)
- `https://DOMENIU/api/` → Nginx trimite direct către **backend**, fără să
  treacă prin Next.js
- backend-ul rulează ca aplicație Node.js pe subdomeniul `api.DOMENIU.md`,
  folosit doar intern, ca țintă a proxy-ului

Backend-ul își păstrează rutele `/api/*`, deci proxy-ul către
`https://api.DOMENIU.md` livrează calea neschimbată. Nu monta aplicația
backend pe *Application URL* `/api`: Passenger ar tăia prefixul și rutele
Express nu s-ar mai potrivi.

---

## 5. Încărcarea codului

### Varianta A — extensia Git din Plesk (deploy automatizat)

*Git → Add Repository* → `https://github.com/TeodorGG/Catvi.git`, deployment
path **`catvi`** (nu `httpdocs`).

#### Deploy folosind doar comenzi npm

Dacă panoul permite numai rularea de scripturi npm, nu și comenzi de shell,
totul este deja împachetat în scriptul `deploy` din fiecare proiect. În
*Run script* scrii un singur cuvânt:

| Aplicație | Run script | Ce execută |
| --- | --- | --- |
| Backend | `deploy` | `npm ci --omit=dev` + `tmp/restart.txt` |
| Frontend | `deploy` | `npm ci --omit=dev` + build + curățare cache + `tmp/restart.txt` |

Un script npm este oricum o comandă de shell, deci limitarea panoului nu
împiedică nimic. Rulează-l întâi pe backend, apoi pe frontend.

Nu este nevoie să apeși separat **NPM install**: `deploy` conține deja
`npm ci --omit=dev`, care este garantat, spre deosebire de butonul din panou
— acela rulează `npm install` și instalează și `devDependencies`, dacă
`NODE_ENV=production` nu este setat.

#### Deploy automat la fiecare push (dacă shell-ul este permis)

*Repository Settings → Enable additional deployment actions*, iar în casetă:

```sh
sh deployment/plesk-deploy.sh
```

[`plesk-deploy.sh`](plesk-deploy.sh) face același lucru pentru ambele proiecte
dintr-o singură rulare, după fiecare `git pull`. Dacă acțiunile de deploy nu
sunt disponibile pe planul tău, folosește tabelul de mai sus.

Detalii care contează:

- **Versiunea de Node trebuie selectată explicit.** Hostul `catvi.md`
  folosește `nodenv`, cu versiunile 16, 18, 20, 21 și 22 instalate. Dacă
  niciuna nu e selectată, shim-ul răspunde `nodenv: node: command not found`
  și le enumeră — deși `npm` pare să meargă. Fișierele `.node-version`
  (valoarea `22`) din rădăcină și din fiecare proiect rezolvă asta, iar
  scriptul mai setează și `NODENV_VERSION=22` ca plasă de siguranță.
  Scriptul verifică `node` **și** `npm`, nu doar `npm`.
- **`devDependencies` nu sunt necesare** pentru `next build` — verificat.
  `--omit=dev` scurtează instalarea.
- **Repornirea e la final**, după build. Passenger repornește la atingerea
  lui `tmp/restart.txt`. Dacă build-ul eșuează, `set -e` oprește scriptul
  înainte de repornire și versiunea veche rămâne în funcțiune.
- **`.env` nu vine din git** (este în `.gitignore`). Configurația backend-ului
  stă în *Custom environment variables* din panou, secțiunea 6, și supraviețuiește
  deploy-urilor.
- **Nu crea `.env.local`** în frontend. `NEXT_PUBLIC_API_BASE` are valoarea
  implicită `/api`, exact ce trebuie pentru același origin. O valoare pusă
  acolo s-ar compila permanent în build.

#### Bundler și memorie

Scriptul `build` este `next build --webpack`, **nu** Turbopack. Serverul are
glibc mai vechi de 2.29, deci binding-urile native SWC nu se încarcă, iar
Turbopack nu funcționează fără ele — vezi secțiunea 12.

Efect secundar util: webpack a consumat **545 MB RSS** la măsurare, față de
1,3 GB cu Turbopack. Încape mult mai confortabil în limitele unui plan
partajat.

Atenție însă: pe server SWC rulează prin **WASM**, sensibil mai lent decât
varianta nativă de pe Mac. Build-ul de 1,8 s local poate dura minute acolo, cu
risc de timeout în acțiunile de deploy. Dacă se întâmplă, varianta B rezolvă
definitiv: aduce `.next` deja compilat și elimină build-ul de pe server.

Spațiu ocupat după deploy: `node_modules` frontend ~345 MB, backend ~6,6 MB,
`.next` ~7 MB. Verifică să încapă în cota de disc.

### Varianta B — arhiva pregătită (ocolește build-ul pe server)

`release/catvi-upload.zip` (2 MB) conține sursele **și** `.next` deja
compilat pe Node 22. Pe server rămâne doar `npm ci --omit=dev`.

Regenerare, după orice modificare de cod:

```sh
sh deployment/make-release.sh
```

Încarc-o prin *File Manager* în directorul privat `catvi` și extrage-o acolo.
Arhiva nu conține `.env`, baze de date, `node_modules`, `.git` sau build-uri
de dezvoltare; scriptul se oprește cu eroare dacă un secret ar rămâne în ea.

---

## 6. Backend — aplicație Node.js

*Websites & Domains → `api.DOMENIU.md` → Node.js*

| Câmp | Valoare |
| --- | --- |
| Node.js version | 22.23.2 |
| Application Root | `catvi/catvi-backend` |
| Application Startup File | `server.js` |
| Application Mode | `production` |

`server.js` apelează `listen()`, deci Passenger îl poate porni direct.

Apasă **NPM install**. Apoi, la *Custom environment variables*:

```
NODE_ENV=production
HOST=127.0.0.1
PORT=4000
DATABASE_URL=postgres://catvi:PAROLA_URL_ENCODED@127.0.0.1:5432/catvi
JWT_SECRET=<48 de octeți aleatori, hex>
ALLOWED_ORIGINS=https://DOMENIU
SERVER_ID=md-chisinau-01
SERVER_NAME=Chișinău · CATVI 01
SERVER_COUNTRY=MD
TRUST_PROXY=1
```

Reguli pe care `config.js` le impune la pornire — dacă una lipsește, procesul
refuză să pornească, intenționat:

- `JWT_SECRET` minimum 32 de caractere și fără cuvintele `change`/`example`;
- `ALLOWED_ORIGINS` doar origini `https://` explicite, niciodată `*`;
- `SERVER_COUNTRY` exact `MD`;
- `DATABASE_URL` obligatoriu.

`SERVER_NAME` și `SERVER_ID` trebuie să descrie locația fizică reală a
serverului, nu una dorită.

`TRUST_PROXY=1` înseamnă „exact un proxy de încredere în față”. Pe un server
cu panou lanțul poate fi mai lung; dacă limitarea de rată începe să vadă toți
vizitatorii ca un singur IP, valoarea e greșită și trebuie ajustată după
topologia reală.

---

## 7. Frontend — aplicație Node.js

*Websites & Domains → `DOMENIU` → Node.js*

| Câmp | Valoare |
| --- | --- |
| Node.js version | 22.23.2 |
| Application Root | `catvi/catvi-frontend` |
| Application Startup File | `server.js` |
| Application Mode | `production` |

`catvi-frontend/server.js` a fost adăugat pentru Plesk: `next start` este o
comandă CLI și nu poate fi folosită ca punct de pornire de către Passenger,
care are nevoie de un fișier care apelează el însuși `listen()`. Scriptul
`npm start` a rămas neschimbat, pentru Docker și rulare locală.

### Ordinea contează

**1. Întâi variabilele de mediu**, la *Custom environment variables*:

```
NODE_ENV=production
PORT=3000
```

**2. Apoi:** *Run script* → `deploy`

Atât. Scriptul face instalarea, build-ul și repornirea, într-o singură
rulare.

Dacă preferi pașii separați, sau vrei doar să recompilezi după o modificare:

| Run script | Ce face |
| --- | --- |
| `deploy` | instalare + build + curățare + repornire |
| `build` | doar `next build --webpack` |

**Nu apăsa butonul NPM install** decât dacă `NODE_ENV=production` este deja
setat. Butonul rulează `npm install`, care instalează și `devDependencies`,
iar `unrs-resolver` pică atunci cu `code 127` — vezi secțiunea 12. Cu
`NODE_ENV=production` setat, npm omite singur `devDependencies` și butonul
devine sigur. Scriptul `deploy` nu depinde de asta: folosește explicit
`npm ci --omit=dev`.

Build-ul scrie în `.next/`, în directorul aplicației — niciodată în
`httpdocs`.

---

## 8. Directive Nginx

*Websites & Domains → DOMENIU → Apache & nginx Settings → Additional nginx
directives.* Conținutul este în [`plesk-nginx.conf`](plesk-nginx.conf);
înlocuiește `api.DOMENIU.md` cu subdomeniul real.

Partea critică, fără de care **toate măsurătorile ies greșite**:

```nginx
proxy_buffering off;
proxy_request_buffering off;
proxy_cache off;
gzip off;
```

Nginx-ul implicit din Plesk comprimă și tamponează răspunsurile. Un răspuns
comprimat face ca browserul să numere alți octeți decât cei transferați
efectiv, iar tamponarea deformează momentul sosirii lor. Dacă instalarea are
Brotli activ global, dezactivează-l explicit și în blocul `/api/`.

`client_max_body_size 17m;` acoperă transferul maxim de 16 MiB per cerere.

După salvare, verifică în browser că `https://DOMENIU/api/health` răspunde
`{"ok":true,...}` și că antetul `content-encoding` **lipsește** pe
`https://DOMENIU/api/speedtest/download?size=1000000`.

---

## 9. PostgreSQL

Creează o bază și un rol dedicate. Nu folosi superutilizatorul.

La prima pornire, backend-ul aplică singur schema inițială și scrie versiunea
`1` în `schema_migrations`. Verificare:

*Run script* → `db:check` (echivalentul lui `npm run db:check`).

> **De rezolvat separat:** portul `5432` al serverului a acceptat o conexiune
> de pe internet în timpul verificărilor. Dacă nu este intenționat, cere
> restricționarea la conexiuni locale **înainte** să intre date reale în bază.

---

## 10. Administratorul

Nu există înregistrare publică și nici promovare automată după email. Contul
se creează explicit, din panou:

1. Adaugă temporar variabila de mediu `CATVI_ADMIN_PASSWORD` la aplicația
   backend — între 12 și 72 de octeți UTF-8.
2. *Run script* → `admin:create`, cu argumentul `email@DOMENIU.md`.
3. **Șterge imediat variabila `CATVI_ADMIN_PASSWORD`** și repornește aplicația.

Autentificarea se face la `https://DOMENIU/admin`. Cookie-ul este HttpOnly,
SameSite=Strict, Secure în producție, și expiră după 8 ore. Dezactivarea unui
admin se face cu `research_admins.active=0`; permisiunea este verificată la
fiecare cerere. Rotirea lui `JWT_SECRET` invalidează toate sesiunile.

---

## 11. Verificare finală

1. `https://DOMENIU/` se încarcă.
2. `https://DOMENIU/api/health` răspunde `{"ok":true,...}`.
3. `https://DOMENIU/api/server` arată `SERVER_COUNTRY: "MD"` și identitatea reală.
4. Un test complet, rulat **de pe o conexiune din afara serverului**.
5. Salvarea cu bifa de acord funcționează; fără bifă nu se scrie nimic în bază.
6. `/admin` permite login, filtrare, export CSV, excludere, logout.
7. `https://DOMENIU/.git/config` și `https://DOMENIU/README.md` dau 404.
8. Pe `/api/speedtest/download` nu apare `content-encoding`.

Mediile regionale publice apar doar după minimum 5 teste utilizabile pe un
server marcat `MD`. Până atunci harta arată gri — este comportamentul corect,
nu o eroare. Nu există măsurători demonstrative preîncărcate.

Înainte de colectare publică, completează pe `/confidentialitate` identitatea
și contactul operatorului, perioada de păstrare și politica privind logurile
de infrastructură.

---

## 12. Erori întâlnite și cauza lor

### `npm error code 127` la `unrs-resolver`

```
npm error path .../catvi-frontend/node_modules/unrs-resolver
npm error command sh -c node postinstall.js
npm error nodenv: node: command not found
```

Două cauze suprapuse:

1. **S-a rulat `npm install`, nu `npm ci --omit=dev`.** `unrs-resolver` este
   `dev: true` — vine din `eslint-config-next` → `eslint-import-resolver-typescript`
   — și are script de instalare. Cu `--omit=dev` nu se instalează deloc.
   Arborele de producție are **zero** pachete cu script de instalare, deci
   această clasă de erori dispare complet.
2. **`node` nu se rezolva** în shell-ul de deploy, din lipsa unei versiuni
   nodenv selectate. Rezolvat cu `.node-version` și `NODENV_VERSION`.

Nu instala niciodată `devDependencies` pe server: nu sunt necesare nici pentru
`next build`, nici pentru rulare.

### `Turbopack is not supported on this platform`

```
⚠ Attempted to load @next/swc-linux-x64-gnu, but an error occurred:
  /lib64/libm.so.6: version `GLIBC_2.29' not found
Error: Turbopack is not supported on this platform (linux/x64) because
native bindings are not available.
```

Serverul are glibc mai veche decât 2.29 (CentOS/CloudLinux 7 sau similar),
iar binding-urile native SWC din Next 16 cer cel puțin 2.28. Next revine
automat pe WASM, dar documentația proprie spune explicit: WASM suportă
compilarea și minificarea, **nu** și Turbopack.

Rezolvat: scriptul `build` este acum `next build --webpack`. Webpack este
calea oficială pentru platformele fără binding-uri native și, în plus,
consumă mai puțină memorie — 545 MB față de 1,3 GB.

Nu încerca să actualizezi glibc pe un hosting partajat. Dacă vrei totuși
Turbopack, ai nevoie de un server cu distribuție mai nouă.

### `exit code 9` la „Collecting page data”

Build-ul compilează cu succes, apoi moare imediat:

```
✓ Compiled successfully in 15.0s
  Running TypeScript ... Finished
  Collecting page data using 7 workers ...
⚠ Attempted to load @next/swc-linux-x64-gnu ... GLIBC_2.29 not found
Process exited with non-zero exit code '9'
```

Next pornește câte un worker per CPU — șapte pe acea mașină — și fiecare
încarcă separat SWC prin WASM, pentru că varianta nativă nu se poate încărca.
Consumul se înmulțește cu șapte și depășește limita de memorie a contului,
iar procesele sunt ucise.

Rezolvat în `next.config.mjs`:

```js
experimental: {
  cpus: Number(process.env.NEXT_BUILD_WORKERS || 1),
  webpackMemoryOptimizations: true,
},
enablePrerenderSourceMaps: false,
productionBrowserSourceMaps: false,
```

`experimental.cpus` este singura opțiune pe care Next o tratează ca override
explicit al numărului de workeri. Cu un singur worker, mesajul devine
„Collecting page data using 1 worker”, iar consumul rămâne mărginit. Pentru
cele 9 pagini ale proiectului, diferența de timp este neglijabilă.

Dacă build-ul tot cade după aceste setări, serverul pur și simplu nu are
memorie suficientă pentru SWC-WASM. Treci la varianta B: arhiva conține
`.next` deja compilat și nu se mai compilează nimic pe server.

### Curățare după o instalare eșuată

O instalare picată lasă `node_modules` într-o stare incompletă. Înainte de a
reîncerca, șterge-l — `npm ci` oricum îl recreează de la zero:

```sh
rm -rf catvi-frontend/node_modules catvi-backend/node_modules
```

---

## 13. Ce nu a putut fi verificat de aici

Fără acces la panou, următoarele rămân de confirmat la prima instalare:

- Că Plesk permite **două** aplicații Node.js pe abonamentul tău.
- Comportamentul exact al Passenger cu `server.js` din fiecare proiect.
  Ambele fișiere apelează `listen()`, cerința documentată a Passenger, dar
  integrarea nu a putut fi testată local.
- Dacă *Run script* este disponibil — de el depind `admin:create` și `db:check`.
- Dacă limita de memorie permite `next build` pe server (varianta A).
- Ce alte proxy-uri există în fața aplicației, de care depinde `TRUST_PROXY`.

Un singur proces backend la început: sesiunile de test și limitele de rată sunt
ținute în memoria procesului. Pentru mai multe procese e nevoie întâi de un
depozit comun (de exemplu Redis).
