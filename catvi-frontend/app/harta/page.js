"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import MoldovaMap from "@/components/MoldovaMap";
import { request, number } from "@/lib/api";
import regions from "@/lib/regions.json";
import { useLang } from "@/lib/i18n";

export default function RegionsPage() {
  const { t } = useLang();
  const [rows, setRows] = useState([]),
    [selected, setSelected] = useState("Chișinău"),
    [state, setState] = useState("loading");
  useEffect(() => {
    const abort = new AbortController();
    request("/regions", { signal: abort.signal })
      .then((data) => {
        setRows(data);
        setState("ready");
      })
      .catch(() => {
        if (!abort.signal.aborted) setState("error");
      });
    return () => abort.abort();
  }, []);
  const data = rows.find((row) => row.region === selected);
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t("mapEyebrow")}</div>
          <h1>{t("mapH1")}</h1>
          <p>{t("mapLede")}</p>
        </div>
      </div>
      {state === "error" && (
        <p className="notice error" role="alert">
          {t("mapErrorNotice")}
        </p>
      )}
      <div className="map-layout">
        <div className="surface region-map-panel">
          <MoldovaMap regions={rows} onSelect={setSelected} />
          <div className="map-legend">
            {[
              ["#e1e7dc", t("legendInsufficient")],
              ["#c9d8f6", t("legendUnder30")],
              ["#85a8ef", t("legend30to99")],
              ["#2156df", t("legend100plus")],
            ].map(([color, label]) => (
              <span key={label}>
                <i style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="surface region-detail">
          <div className="field" style={{ width: "100%" }}>
            <label htmlFor="selected-region">{t("selectRegionLabel")}</label>
            <select
              id="selected-region"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {regions.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <h2>{selected}</h2>
          {state === "loading" ? (
            <p role="status">{t("loadingMeasurements")}</p>
          ) : state === "error" ? (
            <p>{t("connectionErrorMsg")}</p>
          ) : data ? (
            <>
              <span className="index-label">{t("avgDownloadLabel")}</span>
              <div className="region-number">
                {number(data.avg_down)}
                <small>Mbps</small>
              </div>
              <p>
                {t("avgUploadTemplate").replace("{up}", number(data.avg_up))}
                <br />
                {t("sampleCountTemplate").replace("{n}", number(data.sample_count))}
              </p>
            </>
          ) : (
            <>
              <span className="badge short">{t("legendInsufficient")}</span>
              <p style={{ marginTop: 20 }}>{t("insufficientBody")}</p>
            </>
          )}
          <Link href="/" className="text-link">
            {t("contributeLink")} <span>↗</span>
          </Link>
        </div>
      </div>
      <p className="table-caption">
        {t("tableCaptionPre")}{" "}
        <a
          href="https://www.geoboundaries.org/"
          target="_blank"
          rel="noreferrer"
        >
          geoBoundaries
        </a>
        {t("tableCaptionPost")}
      </p>
      {rows.length > 0 && (
        <div className="surface table-scroll" style={{ marginTop: 30 }}>
          <table>
            <caption className="sr-only">{t("srTableCaption")}</caption>
            <thead>
              <tr>
                <th>{t("tableRegion")}</th>
                <th>{t("tableAvgDown")}</th>
                <th>{t("tableAvgUp")}</th>
                <th>{t("tableTests")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.region}>
                  <td>{row.region}</td>
                  <td>{number(row.avg_down)} Mbps</td>
                  <td>{number(row.avg_up)} Mbps</td>
                  <td>{number(row.sample_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
