"use client";
import Link from "next/link";
import { useLang } from "@/lib/i18n";

export default function SiteFooter() {
  const { t } = useLang();
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <Link className="footer-brand" href="/">
            catvi.
          </Link>
          <span>{t("footerTagline")}</span>
        </div>
        <div>
          <Link href="/despre">{t("footerMethodology")}</Link>
          <Link href="/confidentialitate">{t("footerPrivacy")}</Link>
          <Link href="/admin">{t("footerAdmin")}</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} CATVI</span>
        <span>{t("footerCountry")}</span>
      </div>
    </footer>
  );
}
