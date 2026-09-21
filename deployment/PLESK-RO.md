# Instalare CATVI pe Plesk, fără acces SSH

Procedura concretă pentru serverul `217.26.150.25`, unde panoul este **Plesk**
și accesul SSH este **„Forbidden”**. Tot ce urmează se face din panou.

Pentru contextul general și mesajul de trimis către suportul host.md, vezi
[`HOST-MD-RO.md`](HOST-MD-RO.md). Pentru un VPS cu acces complet, vezi
[`README.md`](README.md) și [`nginx.conf`](nginx.conf).

---

## 0. Urgent: codul nu are voie să stea în `httpdocs`

Repozitoriul a fost adus în `httpdocs`. `httpdocs` este directorul public al
domeniului: tot ce se află acolo poate fi descărcat de oricine, ca fișier.
Concret, sunt expuse sau vor fi expuse:

- codul sursă complet, inclusiv `deployment/` și structura bazei de date;
- directorul `.git/` — cu el, oricine poate clona întreg istoricul;
- `catvi-backend/.env`, **în momentul în care îl vei crea acolo** — adică
  parola de PostgreSQL și `JWT_SECRET`;
- eventualele `research.db` / `catvi.db` generate de aplicație.

Plesk blochează implicit fișierele care încep cu punct, dar asta acoperă doar
`.env` și `.git`, nu și restul surselor, și nu este o garanție pe care merită
să te bazezi pentru secrete.

**Corecția:** codul trebuie mutat lângă `httpdocs`, nu în el. În Plesk,
directorul rădăcină al abonamentului conține `httpdocs`, `logs`, `tmp` etc.
Creează acolo un director `catvi` și mută repozitoriul în el:

```
/var/www/vhosts/DOMENIU/
├── httpdocs/          ← public; rămâne gol sau doar cu fișiere statice
├── catvi/             ← privat; aici stă codul
│   ├── catvi-backend/
│   ├── catvi-frontend/
│   └── deployment/
├── logs/
└── tmp/
```

Aplicațiile Node.js din Plesk **nu** trebuie să ruleze din `httpdocs`.
Passenger servește aplicația prin proces, nu prin fișiere publice: codul poate
sta într-un director privat, iar `Document Root` rămâne separat de
`Application Root`.

Dacă ai folosit extensia **Git** din Plesk, schimbă calea din
*Git → Repository Settings → Deployment path* din `httpdocs` în `catvi` și
rulează un deploy nou. Apoi șterge manual din `httpdocs` ce a rămas.

După mutare, verifică din browser că nu mai răspunde nimic la:
`https://DOMENIU/.git/config`, `https://DOMENIU/catvi-backend/package.json`,
`https://DOMENIU/README.md`. Toate trebuie să dea 404.

> Nimic nu a ajuns pe GitHub: în repo sunt urmărite doar fișierele
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

## 3. Topologia

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

## 4. Încărcarea codului

### Varianta A — extensia Git din Plesk (recomandată, ai deja repo)

*Git → Add Repository* → `https://github.com/TeodorGG/Catvi.git`,
deployment path **`catvi`** (nu `httpdocs`), deploy manual.

Atenție: `.next` este în `.gitignore`, deci prin Git **nu** primești build-ul.
Va trebui compilat pe server (secțiunea 6, varianta „build pe server”), ceea ce
pe hosting partajat poate fi oprit de limita de memorie. Dacă se întâmplă,
treci la varianta B.

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

## 5. Backend — aplicație Node.js

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

## 6. Frontend — aplicație Node.js

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

Variabile de mediu:

```
NODE_ENV=production
PORT=3000
```

Apoi **NPM install**.

**Build pe server** (doar dacă ai folosit varianta A, Git): *Run script* →
`build`. Dacă procesul este oprit fără mesaj clar, este limita de memorie;
folosește varianta B, cu `.next` deja compilat.

---

## 7. Directive Nginx

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

## 8. PostgreSQL

Creează o bază și un rol dedicate. Nu folosi superutilizatorul.

La prima pornire, backend-ul aplică singur schema inițială și scrie versiunea
`1` în `schema_migrations`. Verificare:

*Run script* → `db:check` (echivalentul lui `npm run db:check`).

> **De rezolvat separat:** portul `5432` al serverului a acceptat o conexiune
> de pe internet în timpul verificărilor. Dacă nu este intenționat, cere
> restricționarea la conexiuni locale **înainte** să intre date reale în bază.

---

## 9. Administratorul

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

## 10. Verificare finală

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

## 11. Ce nu a putut fi verificat de aici

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
