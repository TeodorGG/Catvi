import Link from "next/link";
export const metadata = { title: "Metodologie" };
export default function AboutPage() {
  return (
    <main id="main" className="container page-main">
      <article className="prose">
        <div className="eyebrow">PROIECTUL CATVI / METODOLOGIE HTTP-V1</div>
        <h1>
          Înțelegem internetul
          <br />
          prin măsurători.
        </h1>
        <p className="lede">
          CATVI adună teste voluntare pentru a documenta experiența conexiunilor
          la internet din Republica Moldova.
        </p>
        <h2>Ce măsoară testul</h2>
        <p>
          Browserul transferă date către și de la serverul configurat de
          operator. Download și upload reprezintă volumul de date confirmat,
          împărțit la timpul efectiv al transferului. Folosim un singur flux
          HTTP și loturi adaptive, cu o țintă de aproximativ 5 secunde în
          fiecare direcție și o limită totală de 240 MB.
        </p>
        <p>
          Latența este media a 8 cereri HTTP după încălzirea conexiunii.
          Jitter-ul este abaterea standard a acestor timpi. Cererile eșuate sunt
          înregistrate separat; nu le prezentăm drept pierderi de pachete UDP
          sau ICMP. Măsurarea completă se oprește după cel mult 90 de secunde.
        </p>
        <h2>Un server în Moldova</h2>
        <p>
          În producție, serverul de măsurare trebuie găzduit fizic în Republica
          Moldova. Numele lui apare sub test. O instalare locală este etichetată
          ca mediu de dezvoltare, iar rezultatele ei nu intră în statisticile
          publice.
        </p>
        <p>
          Un server local măsoară conexiunea către acel server. Nu garantează că
          întregul traseu de rețea rămâne în Moldova și nu reprezintă viteza
          către toate serviciile internaționale. Peeringul și rutarea
          furnizorului influențează rezultatul.
        </p>
        <h2>Cum construim datele regionale</h2>
        <p>
          Salvarea în baza proiectului este opțională. Regiunea, furnizorul și
          tipul conexiunii sunt declarate de participant, nu detectate sau
          verificate automat. Publicăm medii doar pentru regiuni cu minimum 5
          teste utilizabile către un server configurat în Moldova.
        </p>
        <p>
          Transferurile sub 250 de milisecunde sunt marcate pentru analiză și
          excluse din mediile publice. Administratorii pot exclude rezultate
          suspecte, cu un motiv și un jurnal al acțiunii. Nu pot rescrie
          vitezele măsurate.
        </p>
        <h2>Limitele interpretării</h2>
        <p>
          Wi-Fi-ul, dispozitivul, VPN-ul, încărcarea serverului și traficul din
          aceeași rețea pot limita viteza. Testul HTTP cu un singur flux nu
          certifică viteza contractuală a unui abonament. Datele voluntare nu
          constituie un eșantion reprezentativ, iar aceeași persoană poate
          participa de mai multe ori. Valorile de timp sunt raportate de browser
          și nu sunt o dovadă criptografică a calității conexiunii.
        </p>
        <p>
          <Link href="/confidentialitate">Vezi ce date colectăm</Link> sau{" "}
          <Link href="/">începe un test</Link>.
        </p>
      </article>
    </main>
  );
}
