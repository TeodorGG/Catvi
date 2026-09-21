import Link from "next/link";
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <Link className="footer-brand" href="/">
            catvi.
          </Link>
          <span>Internetul Moldovei, măsurat împreună.</span>
        </div>
        <div>
          <Link href="/despre">Metodologie</Link>
          <Link href="/confidentialitate">Date & confidențialitate</Link>
          <Link href="/admin">Administrare ↗</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} CATVI</span>
        <span>Republica Moldova · Date din teste voluntare</span>
      </div>
    </footer>
  );
}
