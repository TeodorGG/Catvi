"use client";
import Link from "next/link";
import { useLang } from "@/lib/i18n";

export default function AboutContent() {
  const { t } = useLang();
  return (
    <main id="main" className="container page-main">
      <article className="prose">
        <div className="eyebrow">{t("aboutEyebrow")}</div>
        <h1>
          {t("aboutH1a")}
          <br />
          {t("aboutH1b")}
        </h1>
        <p className="lede">{t("aboutLede")}</p>
        <h2>{t("aboutH2_1")}</h2>
        <p>{t("aboutP1")}</p>
        <p>{t("aboutP2")}</p>
        <h2>{t("aboutH2_2")}</h2>
        <p>{t("aboutP3")}</p>
        <p>{t("aboutP4")}</p>
        <h2>{t("aboutH2_3")}</h2>
        <p>{t("aboutP5")}</p>
        <p>{t("aboutP6")}</p>
        <h2>{t("aboutH2_4")}</h2>
        <p>{t("aboutP7")}</p>
        <p>
          <Link href="/confidentialitate">{t("aboutFooterPre")}</Link>{" "}
          {t("aboutFooterOr")} <Link href="/">{t("aboutFooterCta")}</Link>.
        </p>
      </article>
    </main>
  );
}
