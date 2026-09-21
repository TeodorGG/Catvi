export const metadata = { title: "Date și confidențialitate" };
export default function PrivacyPage() {
  return (
    <main id="main" className="container page-main">
      <article className="prose">
        <div className="eyebrow">TRANSPARENȚĂ / VERSIUNEA 2026-09-21</div>
        <h1>Tu alegi dacă participi.</h1>
        <p className="lede">
          Poți testa conexiunea fără cont și fără să trimiți rezultatul în baza
          de cercetare.
        </p>
        <h2>În timpul testului</h2>
        <p>
          Serverul primește traficul necesar măsurării. Un identificator
          aleatoriu de sesiune, contoarele de trafic și limitele anti-abuz sunt
          păstrate temporar în memorie. Adresa IP este folosită temporar pentru
          limitarea cererilor; nu este adăugată în tabelul de măsurători.
        </p>
        <h2>Dacă alegi să contribui</h2>
        <p>
          Salvăm viteza de download și upload, latența HTTP, jitter-ul, numărul
          de cereri HTTP eșuate, volumele și duratele transferurilor, ora
          testului, serverul, versiunea metodei și versiunea acordului. Salvăm
          și regiunea, furnizorul și tipul conexiunii pe care le indici.
        </p>
        <p>
          Nu cerem nume, email, coordonate GPS sau adresă exactă pentru test și
          nu stocăm IP-ul ori identificatori publicitari în înregistrarea
          măsurării. Administratorii pot consulta și exporta rezultatele
          individuale. Pe pagina publică apar numai medii pentru regiuni cu cel
          puțin 5 măsurători utilizabile.
        </p>
        <h2>În browserul tău</h2>
        <p>
          Ultimele 50 de teste sunt salvate local pentru istoricul tău. Le poți
          șterge din pagina Istoric. Nu folosim cookie-uri publicitare.
          Autentificarea administratorilor folosește un cookie de sesiune cu
          durată de 8 ore.
        </p>
        <h2>Înainte de lansarea publică</h2>
        <p>
          Aceasta este descrierea tehnică a colectării. Operatorul trebuie să
          publice identitatea și datele sale de contact, perioada de păstrare,
          procedura pentru solicitări și politica jurnalelor de infrastructură
          înainte de a deschide colectarea publică. Găzduirea sau proxy-ul pot
          avea jurnale proprii; acestea trebuie configurate și documentate
          separat.
        </p>
      </article>
    </main>
  );
}
