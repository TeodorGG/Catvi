"use client";
import { useLang } from "@/lib/i18n";

export default function PrivacyContent() {
  const { t } = useLang();
  return (
    <main id="main" className="container page-main">
      <article className="prose">
        <div className="eyebrow">{t("privacyEyebrow")}</div>
        <h1>{t("privacyH1")}</h1>
        <p className="lede">{t("privacyLede")}</p>
        <h2>{t("privacyH2_1")}</h2>
        <p>{t("privacyP1")}</p>
        <h2>{t("privacyH2_2")}</h2>
        <p>{t("privacyP2")}</p>
        <p>{t("privacyP3")}</p>
        <h2>{t("privacyH2_3")}</h2>
        <p>{t("privacyP4")}</p>
        <h2>{t("privacyH2_4")}</h2>
        <p>{t("privacyP5")}</p>
      </article>
    </main>
  );
}
