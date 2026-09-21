"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import MoldovaMap from "@/components/MoldovaMap";
import { request, number } from "@/lib/api";
import regions from "@/lib/regions.json";
export default function RegionsPage() {
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
          <div className="eyebrow">DATE DESCHISE / REPUBLICA MOLDOVA</div>
          <h1>Internetul, regiune cu regiune.</h1>
          <p>
            Medii ale testelor voluntare către serverul din Moldova. Publicăm o
            medie doar după cel puțin 5 măsurători utilizabile într-o regiune.
          </p>
        </div>
      </div>
      {state === "error" && (
        <p className="notice error" role="alert">
          Datele nu sunt disponibile momentan. Harta nu afișează valori
          demonstrative.
        </p>
      )}
      <div className="map-layout">
        <div className="surface region-map-panel">
          <MoldovaMap regions={rows} onSelect={setSelected} />
          <div className="map-legend">
            {[
              ["#e1e7dc", "Date insuficiente"],
              ["#c9d8f6", "Sub 30 Mbps"],
              ["#85a8ef", "30–99 Mbps"],
              ["#2156df", "100+ Mbps"],
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
            <label htmlFor="selected-region">Selectează regiunea</label>
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
            <p role="status">Încărcăm măsurătorile…</p>
          ) : state === "error" ? (
            <p>
              Conexiunea cu baza de date nu este disponibilă. Încearcă din nou
              mai târziu.
            </p>
          ) : data ? (
            <>
              <span className="index-label">DOWNLOAD MEDIU</span>
              <div className="region-number">
                {number(data.avg_down)}
                <small>Mbps</small>
              </div>
              <p>
                Upload mediu: <strong>{number(data.avg_up)} Mbps</strong>
                <br />
                {number(data.sample_count)} măsurători utilizabile.
              </p>
            </>
          ) : (
            <>
              <span className="badge short">Date insuficiente</span>
              <p style={{ marginTop: 20 }}>
                Nu avem încă 5 măsurători utilizabile pentru această regiune.
                Absența datelor nu înseamnă absența internetului.
              </p>
            </>
          )}
          <Link href="/" className="text-link">
            Contribuie cu un test <span>↗</span>
          </Link>
        </div>
      </div>
      <p className="table-caption">
        Regiunea și furnizorul sunt declarate de participanți. Eșantionul nu
        reprezintă statistic întreaga populație. Limite administrative:{" "}
        <a
          href="https://www.geoboundaries.org/"
          target="_blank"
          rel="noreferrer"
        >
          geoBoundaries
        </a>
        , CC BY 4.0.
      </p>
      {rows.length > 0 && (
        <div className="surface table-scroll" style={{ marginTop: 30 }}>
          <table>
            <caption className="sr-only">
              Medii regionale din măsurători utilizabile
            </caption>
            <thead>
              <tr>
                <th>Regiune</th>
                <th>Download mediu</th>
                <th>Upload mediu</th>
                <th>Teste</th>
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
