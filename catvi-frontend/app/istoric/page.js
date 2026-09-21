"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { number } from "@/lib/api";
export default function HistoryPage() {
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
        setError("Istoricul local nu poate fi citit în acest browser.");
      }
    };
    const timer = setTimeout(load, 0);
    window.addEventListener("storage", load);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", load);
    };
  }, []);
  function clear() {
    try {
      localStorage.removeItem("catvi-history-v2");
      setRows([]);
    } catch {
      setError("Istoricul nu a putut fi șters.");
    }
  }
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DOAR PE ACEST DISPOZITIV</div>
          <h1>Conexiunea ta, în timp.</h1>
          <p>
            Ultimele 50 de rezultate sunt păstrate în acest browser. Nu ai
            nevoie de cont. Ștergerea istoricului local nu șterge măsurătorile
            deja trimise proiectului.
          </p>
        </div>
        {rows?.length > 0 && (
          <button className="button" onClick={clear}>
            Șterge istoricul local
          </button>
        )}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {rows === null ? (
        <p role="status">Încărcăm istoricul…</p>
      ) : rows.length === 0 ? (
        <div className="surface empty-state">
          <h2>Prima măsurare începe aici.</h2>
          <p>
            După un test, vei putea compara viteza conexiunii tale de la o
            măsurare la alta.
          </p>
          <Link href="/" className="button primary">
            Testează conexiunea ↗
          </Link>
        </div>
      ) : (
        <div className="surface table-scroll">
          <table>
            <caption className="sr-only">
              Istoricul local al măsurătorilor
            </caption>
            <thead>
              <tr>
                <th>Data</th>
                <th>Download</th>
                <th>Upload</th>
                <th>Latență HTTP</th>
                <th>Server</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>{new Date(row.created_at).toLocaleString("ro-MD")}</td>
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
