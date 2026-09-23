"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { number } from "@/lib/api";
import { useLang } from "@/lib/i18n";

const LOCALE = { ro: "ro-MD", ru: "ru-RU", en: "en-GB" };

export default function HistoryPage() {
  const { t, lang } = useLang();
  const [rows, setRows] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    const load = () => {
      try {
        const data = JSON.parse(
          localStorage.getItem("catvi-history-v2") || "[]",
        );
        setRows(Array.isArray(data) ? data : []);
      } catch {
        setRows([]);
        setError(t("histReadError"));
      }
    };
    const timer = setTimeout(load, 0);
    window.addEventListener("storage", load);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", load);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function clear() {
    try {
      localStorage.removeItem("catvi-history-v2");
      setRows([]);
    } catch {
      setError(t("histClearError"));
    }
  }
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t("histEyebrow")}</div>
          <h1>{t("histH1")}</h1>
          <p>{t("histLede")}</p>
        </div>
        {rows?.length > 0 && (
          <button className="button" onClick={clear}>
            {t("histClearBtn")}
          </button>
        )}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {rows === null ? (
        <p role="status">{t("histLoading")}</p>
      ) : rows.length === 0 ? (
        <div className="surface empty-state">
          <h2>{t("histEmptyTitle")}</h2>
          <p>{t("histEmptyP")}</p>
          <Link href="/" className="button primary">
            {t("histEmptyBtn")}
          </Link>
        </div>
      ) : (
        <div className="surface table-scroll">
          <table>
            <caption className="sr-only">{t("histSrCaption")}</caption>
            <thead>
              <tr>
                <th>{t("histDate")}</th>
                <th>{t("histDownload")}</th>
                <th>{t("histUpload")}</th>
                <th>{t("histLatency")}</th>
                <th>{t("histServer")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>{new Date(row.created_at).toLocaleString(LOCALE[lang] || "ro-MD")}</td>
                  <td>{number(row.down)} Mbps</td>
                  <td>{number(row.up)} Mbps</td>
                  <td>{number(row.ping)} ms</td>
                  <td>{row.server?.name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
