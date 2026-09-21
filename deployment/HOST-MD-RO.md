# Instalare CATVI pe host.md — ce pregătim înainte de configurare

Aplicația conține două servicii Node.js (Next.js și Express), plus PostgreSQL. Codul încărcat prin File Manager trebuie apoi instalat, compilat și pornit ca aplicație Node.js.

## 1. Identifică serviciul și panoul

> **Constatat pe serverul 217.26.150.25:** panoul este **Plesk** (porturile 8443/8880 deschise, redirect către `/login.php`; porturile cPanel 2082–2087 sunt închise), iar în panou accesul SSH apare ca **„Forbidden”**. Porturile 22 și 2222 nu răspund. Procedura concretă de instalare fără SSH este în [`PLESK-RO.md`](PLESK-RO.md); secțiunile de mai jos rămân valabile pentru context și pentru cazul unui VPS cu acces complet.

În contul de client, verifică numele exact al serviciului cumpărat, IP-ul VPS-ului, accesul SSH și sistemul de operare. Verifică dacă panoul este cPanel, WHM sau Plesk. Site-ul public host.md descrie Plesk pentru shared hosting, ceea ce nu confirmă panoul de pe VPS-ul tău.

În cPanel caută `Application Manager`, `Setup Node.js App` sau, în versiunile noi, `Websites`. În Plesk caută `Websites & Domains` → domeniu → `Node.js`. Aceste funcții apar numai dacă furnizorul le-a activat. Cere host.md activarea suportului dacă lipsește.

Configurația Nginx din proiect este un model pentru un VPS administrat direct. Nu o instala peste configurația generată de cPanel/Plesk. Serverul web și SSL trebuie configurate prin mecanismul suportat de panoul existent.

## 2. Fișierele

Arhiva `release/catvi-upload.zip` conține sursele, fișierele package-lock și exemplele de configurare. Nu conține parole, `.env`, baze de date locale, `node_modules` sau build-uri de pe Mac.

Extrage aplicația într-un director privat al contului, de exemplu `/home/UTILIZATOR/apps/catvi`, nu într-un director care publică toate sursele ca fișiere descărcabile. Înregistrează apoi aplicațiile prin panou sau configurează procese persistente prin SSH, în funcție de accesul disponibil.

Dacă panoul permite numai extragerea inițială în document root, folosește SFTP/SSH sau cere suportului încărcarea în directorul privat. Fișierele `.env` și baza de date nu trebuie publicate.

## 3. Configurația dorită

- `https://DOMENIU/` → frontend Next.js.
- `https://DOMENIU/api/` → backend Express, direct, fără a trece prin Next.js.
- Backend-ul → baza PostgreSQL existentă.
- Un singur proces backend inițial; sesiunile de test și limitele sunt în memorie.

Pe VPS cu acces SSH se pot rula separat frontend-ul și backend-ul, cu restart automat. Panoul/furnizorul configurează rutarea domeniului și a `/api/`. Dacă se folosește Passenger/Application Manager, trebuie adaptată pornirea aplicațiilor la configurația concretă a panoului; proiectul actual nu include o instalare Passenger confirmată.

## 4. Cerințe pentru suportul host.md

Mesaj de trimis în ticket, completând domeniul:

> Doresc să instalez CATVI pe domeniul DOMENIU. Proiectul are frontend Next.js 16 și backend Express, cu PostgreSQL existent. Rulează pe Node.js 22 sau mai nou (testat pe 22.23.2). În panoul Plesk accesul SSH apare ca „Forbidden”, deci instalarea trebuie făcută integral din panou.
>
> Vă rog să confirmați:
>
> 1. Extensia **Node.js** este activată pentru contul meu și pot înregistra **două** aplicații Node.js (frontend și backend) pe același domeniu sau pe domeniu plus subdomeniu.
> 2. Pot rula `npm ci` și pot seta variabile de mediu din panou, fără SSH.
> 3. Pot adăuga **directive Nginx adiționale** pentru domeniu. Am nevoie ca `/api/` să ajungă direct la backend, fără buffering, fără comprimare (gzip și Brotli) și fără cache. Endpoint-urile de măsurare transferă până la 16 MiB per cerere și aproximativ 240 MB per test; fără aceste setări rezultatele măsurătorilor sunt eronate.
> 4. `client_max_body_size` poate fi ridicat la 17 MB pentru domeniu.
> 5. Datele de conectare la PostgreSQL existent și dacă portul 5432 este accesibil din internet. Dacă da, vă rog să îl restricționați la conexiuni locale.
> 6. VPS-ul este fizic în Moldova, viteza portului, limita de trafic și că utilizarea pentru speed-test este permisă.
> 7. Certificatul SSL este deja cumpărat; vă rog să indicați instalarea lui în panou, inclusiv lanțul intermediar.
>
> Dacă rularea a două aplicații Node.js persistente nu este posibilă pe acest plan, vă rog să îmi indicați planul sau serviciul care o permite.

Mesajul nu a fost trimis automat.

## 5. Ordinea instalării după confirmarea accesului

1. Domeniul/DNS trebuie să indice IP-ul VPS-ului. Păstrează înregistrările de email existente.
2. Înregistrează domeniul în panou și instalează certificatul SSL, cheia privată corespunzătoare CSR-ului și CA bundle.
3. Încarcă arhiva în directorul privat și instalează dependențele pe server cu `npm ci` în fiecare proiect.
4. Configurează `.env` pentru backend conform `catvi-backend/.env.example`, folosind datele PostgreSQL existente, domeniul HTTPS și identitatea reală a serverului. Nu trimite parolele sau cheia privată în chat.
5. Rulează `npm run build` în frontend. Pornește ambele servicii prin mecanismul persistent oferit de panou/VPS; simpla pornire într-o sesiune SSH nu este suficientă pentru operare permanentă.
6. Configurează ruta directă `/api/`, limitele de upload, lipsa cache-ului/comprimării/bufferingului și numărul corect de proxy-uri de încredere. Valoarea `TRUST_PROXY` depinde de topologia reală; nu presupune că există un singur proxy pe un server cu panou.
7. Creează administratorul cu `npm run admin:create`, folosind parola în variabila de mediu, conform README-ului principal.
8. Verifică HTTPS, `/api/health`, un test de pe o conexiune externă VPS-ului, salvarea cu acord și accesul admin. Publică informațiile operatorului și politica de păstrare înainte de colectarea publică.

## Referințe

- host.md: https://host.md/
- cPanel Application Manager: https://docs.cpanel.net/cpanel/software/application-manager/
- Documentația proiectului: `README.md` și `deployment/README.md`.
