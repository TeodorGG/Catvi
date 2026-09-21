"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { request, number, providers, saveLocalResult } from "@/lib/api";
import regions from "@/lib/regions.json";
import { runMeasurement } from "@/lib/speedtestEngine";
import MoldovaMap from "./MoldovaMap";
const phases = {
  idle: "Pregătit de măsurare",
  ping: "Măsurăm latența",
  download: "Măsurăm descărcarea",
  upload: "Măsurăm încărcarea",
  done: "Măsurare încheiată",
  error: "Testul nu s-a încheiat",
};
export default function SpeedTest() {
  const [server, setServer] = useState(null),
    [serverError, setServerError] = useState(false);
  const [phase, setPhase] = useState("idle"),
    [live, setLive] = useState(null),
    [samples, setSamples] = useState([]);
  const [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("");
  const [region, setRegion] = useState(""),
    [provider, setProvider] = useState(""),
    [connectionType, setConnection] = useState("unknown");
  const [consent, setConsent] = useState(false);
  const controller = useRef(null),
    busyRef = useRef(false),
    mounted = useRef(true);
  const busy = ["ping", "download", "upload"].includes(phase);
  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    request("/server", { signal: abort.signal })
      .then(setServer)
      .catch(() => {
        if (!abort.signal.aborted) setServerError(true);
      });
    return () => {
      mounted.current = false;
      abort.abort();
      controller.current?.abort();
    };
  }, []);
  async function start() {
    if (busyRef.current) return;
    busyRef.current = true;
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 90000);
    setError("");
    setSaved("");
    setResult(null);
    setSamples([]);
    setLive(null);
    setPhase("ping");
    try {
      const measurement = await runMeasurement({
        signal: abort.signal,
        onPhase: (value) => {
          if (mounted.current) {
            setPhase(value);
            setSamples([]);
            setLive(null);
          }
        },
        onProgress: (side, value) => {
          if (mounted.current) {
            setLive(value);
            setSamples((old) => [...old.slice(-59), value]);
          }
        },
      });
      if (!mounted.current || abort.signal.aborted) return;
      setServer(measurement.server);
      setServerError(false);
      const localResult = {
        ...measurement,
        region: region || null,
        provider: provider || null,
        connectionType,
      };
      delete localResult.token;
      const stored = saveLocalResult(localResult);
      setResult(localResult);
      setPhase("done");
      if (consent) {
        try {
          await request("/speedtest/result", {
            method: "POST",
            headers: { "X-Test-Token": measurement.token },
            body: {
              ...localResult,
              consent: true,
              consentVersion: "2026-09-21",
            },
            signal: abort.signal,
          });
          if (mounted.current)
            setSaved(
              "Măsurarea a fost adăugată la datele proiectului. Mulțumim.",
            );
        } catch {
          if (mounted.current)
            setSaved(
              stored
                ? "Rezultat salvat în acest browser. Trimiterea către proiect a eșuat."
                : "Trimiterea și salvarea locală au eșuat. Rezultatul rămâne vizibil aici.",
            );
          request("/speedtest/session", {
            method: "DELETE",
            headers: { "X-Test-Token": measurement.token },
          }).catch(() => {});
        }
      } else {
        request("/speedtest/session", {
          method: "DELETE",
          headers: { "X-Test-Token": measurement.token },
        }).catch(() => {});
        setSaved(
          stored
            ? "Rezultat salvat doar în acest browser. Nu a fost trimis în baza de cercetare."
            : "Rezultatul nu a fost salvat. Stocarea în browser nu este disponibilă.",
        );
      }
    } catch (err) {
      if (mounted.current) {
        setPhase("error");
        setError(
          abort.signal.aborted
            ? "Test oprit. Poți începe o nouă măsurare."
            : err.message === "compressed_response"
              ? "Serverul comprimă traficul de test. Măsurarea a fost oprită pentru a evita un rezultat incorect."
              : "Nu am putut termina măsurarea. Verifică conexiunea și încearcă din nou.",
        );
      }
    } finally {
      clearTimeout(timeout);
      busyRef.current = false;
    }
  }
  const max = Math.max(10, ...samples);
  const trace = samples
    .map(
      (value, i) =>
        `${(i / Math.max(1, samples.length - 1)) * 400},${64 - (value / max) * 52}`,
    )
    .join(" ");
  return (
    <main id="main" className="container home-main">
      <section className="home-intro">
        <div>
          <div className="eyebrow">
            <span className="blue-square" /> OBSERVATORUL INTERNETULUI DIN
            MOLDOVA
          </div>
          <h1>
            Cât de rapid e<br />
            internetul <span className="serif-word">tău?</span>
          </h1>
        </div>
        <div className="intro-aside">
          <span className="index-label">O CONEXIUNE. O MĂSURARE.</span>
          <p>
            Vezi viteza reală a conexiunii tale. <br />
            Ajută-ne să înțelegem internetul
            <br className="desktop-break" /> din Republica Moldova.
          </p>
          <a href="#measurement" className="text-link">
            Începe aici <span>↙</span>
          </a>
        </div>
      </section>
      <section
        className="test-panel"
        id="measurement"
        aria-label="Test de viteză"
      >
        <div className="test-panel-top">
          <span>
            <span
              className={`status-dot ${serverError ? "offline" : server ? "" : "pending"}`}
            />
            {serverError
              ? "Server indisponibil"
              : server
                ? "Conexiune cu serverul disponibilă"
                : "Verificăm serverul…"}
          </span>
          <span className="mono">
            HTTP / {server?.country === "MD" ? "MOLDOVA" : "MEDIU LOCAL"}
          </span>
        </div>
        <div className="test-body">
          <div className="instrument">
            <div className="instrument-caption">
              <span>01 — TESTUL TĂU</span>
              <span aria-live="polite">{phases[phase]}</span>
            </div>
            <div className="dial">
              <svg viewBox="0 0 360 205" aria-hidden="true">
                <path
                  d="M 30 175 A 150 150 0 0 1 330 175"
                  className="dial-track"
                />
                {Array.from({ length: 41 }, (_, i) => {
                  const angle = Math.PI + (i / 40) * Math.PI;
                  const big = i % 10 === 0;
                  return (
                    <line
                      key={i}
                      x1={(180 + Math.cos(angle) * 140).toFixed(3)}
                      y1={(175 + Math.sin(angle) * 140).toFixed(3)}
                      x2={(180 + Math.cos(angle) * (big ? 127 : 133)).toFixed(
                        3,
                      )}
                      y2={(175 + Math.sin(angle) * (big ? 127 : 133)).toFixed(
                        3,
                      )}
                      className={
                        busy &&
                        i <
                          Math.min(
                            40,
                            (live || 0) <= 100
                              ? (live || 0) / 5
                              : 20 + ((live || 0) - 100) / 45,
                          )
                          ? "lit"
                          : ""
                      }
                    />
                  );
                })}
                <text x="24" y="199">
                  0
                </text>
                <text x="167" y="13">
                  100
                </text>
                <text x="314" y="199">
                  1G+
                </text>
              </svg>
              <div className="dial-value">
                <span>{number(phase === "done" ? result?.down : live)}</span>
                <small>Mbps{phase === "upload" ? " · upload" : ""}</small>
              </div>
            </div>
            <div className="start-row">
              <button
                className="button primary start-button"
                onClick={start}
                disabled={busy}
              >
                {busy
                  ? "Test în curs…"
                  : result
                    ? "Testează din nou"
                    : "Începe testul"}
                <span aria-hidden="true">↗</span>
              </button>
              {busy && (
                <button
                  className="text-link"
                  onClick={() => controller.current?.abort()}
                >
                  Oprește
                </button>
              )}
            </div>
            <p className="test-footnote">
              Fără cont. Aproximativ 15 secunde.
              <br />
              Consum de date: până la 240 MB per test.
            </p>
            <div className="trace">
              <svg
                viewBox="0 0 400 70"
                preserveAspectRatio="none"
                aria-label={
                  samples.length
                    ? "Viteza observată în timpul transferului"
                    : "Graficul va apărea în timpul testului"
                }
              >
                <path
                  d="M0 17H400 M0 40H400 M0 64H400"
                  className="trace-grid"
                />
                {samples.length > 1 && <polyline points={trace} />}
              </svg>
              <div>
                <span>
                  {samples.length ? "TRAFIC MĂSURAT" : "ÎN AȘTEPTAREA DATELOR"}
                </span>
                <span>Mbps</span>
              </div>
            </div>
          </div>
          <div className="test-context">
            <div className="index-label">02 — CONTEXTUL CONEXIUNII</div>
            <h2>
              Fiecare test spune
              <br />o parte din poveste.
            </h2>
            <p>
              Adaugă câteva detalii pentru o imagine mai clară a conexiunii
              tale.
            </p>
            <fieldset disabled={busy}>
              <legend className="sr-only">
                Detalii opționale despre conexiune
              </legend>
              <div className="field">
                <label htmlFor="region">
                  Raion / municipiu <span>opțional</span>
                </label>
                <select
                  id="region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  <option value="">Alege regiunea</option>
                  {regions.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="provider">
                  Furnizor <span>opțional</span>
                </label>
                <select
                  id="provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                >
                  <option value="">Alege furnizorul</option>
                  {providers.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="connection">Tip de conexiune</label>
                <select
                  id="connection"
                  value={connectionType}
                  onChange={(e) => setConnection(e.target.value)}
                >
                  <option value="unknown">Nu știu / prefer să nu indic</option>
                  <option value="ethernet">Cablu Ethernet</option>
                  <option value="wifi">Wi-Fi</option>
                  <option value="mobile">Date mobile</option>
                </select>
              </div>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  Contribui cu rezultatul la datele proiectului.
                  <small>
                    Opțional. Fără IP sau locație exactă în baza de măsurători.{" "}
                    <Link href="/confidentialitate">Ce date colectăm ↗</Link>
                  </small>
                </span>
              </label>
            </fieldset>
          </div>
        </div>
        <div className="server-strip">
          <span>
            <span className="server-icon" aria-hidden="true">
              ▤
            </span>{" "}
            SERVER DE MĂSURARE
          </span>
          <strong>{server?.name || "În curs de verificare"}</strong>
          <span>
            {server?.country === "MD"
              ? "Republica Moldova"
              : "Locație Moldova neconfigurată"}
          </span>
        </div>
      </section>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="notice" role="status">
          {saved}
        </p>
      )}
      <section className="results-strip" aria-label="Rezultatele testului">
        {[
          [
            "↓",
            "Download",
            result?.down,
            "Mbps",
            "Cât de repede primești date",
          ],
          ["↑", "Upload", result?.up, "Mbps", "Cât de repede trimiți date"],
          [
            "↔",
            "Latență HTTP",
            result?.ping,
            "ms",
            "Timpul de răspuns al serverului",
          ],
          ["≈", "Jitter", result?.jitter, "ms", "Variația timpului de răspuns"],
        ].map(([icon, label, value, unit, help]) => (
          <div key={label} className="result-metric">
            <div>
              <span>{icon}</span>
              {label}
            </div>
            <strong>
              {number(value)}
              <small>{unit}</small>
            </strong>
            <p>{help}</p>
          </div>
        ))}
      </section>
      {result && (
        <p className="muted result-detail">
          {result.httpFailures} cereri HTTP eșuate din {result.httpSamples}.
          Acest test nu măsoară pierderile de pachete UDP.{" "}
          {(result.downloadMs < 250 || result.uploadMs < 250) &&
            "Transfer prea scurt: rezultatul este păstrat pentru analiză, dar exclus din mediile publice."}
        </p>
      )}
      <section className="project-section">
        <div className="project-copy">
          <div className="eyebrow">MAI MULT DECÂT UN NUMĂR</div>
          <h2>
            O țară conectată.
            <br />O imagine <em>mai clară.</em>
          </h2>
          <p>
            De la Chișinău la cel mai mic sat, experiența online nu e aceeași.
            Adunăm măsurători voluntare pentru a vedea diferențele, regiune cu
            regiune.
          </p>
          <Link href="/harta" className="text-link">
            Explorează datele regionale <span>↗</span>
          </Link>
          <div className="project-note">
            <span>37</span>
            <p>
              regiuni pe hartă.
              <br />
              Date reale, construite împreună.
            </p>
          </div>
        </div>
        <div className="home-map">
          <span className="map-coordinate">48° N / 29° E</span>
          <MoldovaMap decorative />
          <span className="map-credit">
            Republica Moldova · geoBoundaries / CC BY 4.0
          </span>
        </div>
      </section>
      <section className="before-test">
        <div className="eyebrow">PENTRU O MĂSURARE MAI BUNĂ</div>
        <div>
          {[
            [
              "01",
              "Închide transferurile",
              "Pune pe pauză descărcările, actualizările și streamingul.",
            ],
            [
              "02",
              "Apropie-te de conexiune",
              "Folosește cablul Ethernet sau stai aproape de router.",
            ],
            [
              "03",
              "Privește rezultatul în context",
              "Wi-Fi, VPN-ul și dispozitivul pot influența viteza măsurată.",
            ],
          ].map(([n, title, body]) => (
            <article key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
