"use client";
import { useCallback, useEffect, useState } from "react";
import { API_BASE, request, number, providers } from "@/lib/api";
import regions from "@/lib/regions.json";
const qualityLabel = {
  usable: "Durată suficientă",
  short: "Transfer scurt",
  excluded: "Exclus",
};
export default function AdminPage() {
  const [user, setUser] = useState(undefined),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null),
    [data, setData] = useState(null),
    [audit, setAudit] = useState([]);
  const [filters, setFilters] = useState({
      region: "",
      provider: "",
      quality: "",
      from: "",
      to: "",
    }),
    [page, setPage] = useState(1);
  const [review, setReview] = useState(null),
    [reason, setReason] = useState("");
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  ).toString();
  useEffect(() => {
    request("/auth/me")
      .then(setUser)
      .catch((err) => {
        setUser(null);
        if (err.status !== 401)
          setError(
            "Serverul nu este disponibil. Pornește API-ul sau verifică conexiunea.",
          );
      });
  }, []);
  const refresh = useCallback(
    async (signal) => {
      try {
        const [summary, list, actions] = await Promise.all([
          request("/admin/stats", { signal }),
          request(`/admin/measurements?${query}&page=${page}`, { signal }),
          request("/admin/audit", { signal }),
        ]);
        setStats(summary);
        setData(list);
        setAudit(actions);
      } catch (err) {
        if (!signal?.aborted) {
          if (err.status === 401) setUser(null);
          else setError("Nu am putut încărca datele. Încearcă din nou.");
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [query, page],
  );
  useEffect(() => {
    if (!user) return;
    const abort = new AbortController();
    const timer = setTimeout(() => refresh(abort.signal), 0);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [user, refresh]);
  async function login(event) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const admin = await request("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setPassword("");
      setLoading(true);
      setUser(admin);
    } catch (err) {
      setError(
        err.status === 429
          ? "Prea multe încercări. Revino în 15 minute."
          : err.status === 401
            ? "Email sau parolă incorectă."
            : "Autentificarea nu este disponibilă momentan.",
      );
    } finally {
      setWorking(false);
    }
  }
  async function logout() {
    try {
      await request("/auth/logout", { method: "POST" });
      setUser(null);
      setData(null);
      setStats(null);
      setAudit([]);
    } catch {
      setError("Deconectarea a eșuat. Încearcă din nou.");
    }
  }
  async function exportData() {
    setWorking(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/admin/export?${query}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (response.status === 401) {
        setUser(null);
        return;
      }
      if (!response.ok) {
        const body = await response.json();
        throw new Error(
          body.error === "narrow_export_filters"
            ? "Exportul este limitat la 10.000 de rânduri. Restrânge intervalul sau filtrele."
            : "Exportul a eșuat.",
        );
      }
      const url = URL.createObjectURL(await response.blob()),
        link = document.createElement("a");
      link.href = url;
      link.download = "catvi-measurements.csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }
  async function exclude(event) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      await request("/admin/measurements/" + review, {
        method: "PATCH",
        body: { reason },
      });
      setReview(null);
      setReason("");
      await refresh();
    } catch (err) {
      if (err.status === 401) setUser(null);
      else setError("Excluderea nu a fost salvată. Încearcă din nou.");
    } finally {
      setWorking(false);
    }
  }
  function filter(key, value) {
    setLoading(true);
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  }
  if (user === undefined)
    return (
      <main id="main" className="container page-main">
        <p role="status">Verificăm sesiunea…</p>
      </main>
    );
  if (!user)
    return (
      <main id="main" className="container page-main">
        <section className="surface login-box">
          <span className="eyebrow">CATVI / ADMINISTRARE</span>
          <h1>Acces la datele proiectului.</h1>
          <p>
            Autentificare pentru administratorii autorizați. Participanții pot
            rula teste fără cont.
          </p>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <form onSubmit={login}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Parolă</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="button primary" disabled={working}>
              {working ? "Autentificare…" : "Intră în panou"} <span>↗</span>
            </button>
          </form>
        </section>
      </main>
    );
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CATVI / ADMINISTRARE</div>
          <h1>Datele din spatele conexiunilor.</h1>
          <p>
            Monitorizează colectarea, verifică rezultatele și exportă datele
            pentru analiză.
          </p>
        </div>
        <div className="admin-actions">
          <button className="text-link" onClick={logout}>
            Ieși din cont ↗
          </button>
        </div>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-stats">
        {[
          ["MĂSURĂTORI", stats?.total, "Toate rezultatele cu acord"],
          ["ASTĂZI · UTC", stats?.today, "Măsurători noi"],
          [
            "DOWNLOAD MEDIU",
            stats?.down,
            "Mbps · teste utilizabile, server MD",
          ],
          ["REGIUNI CU DATE", stats?.regions, "Teste utilizabile, server MD"],
        ].map(([label, value, help]) => (
          <div className="surface stat-card" key={label}>
            <span>{label}</span>
            <strong>{number(value)}</strong>
            <small>{help}</small>
          </div>
        ))}
      </div>
      <div className="admin-info">
        <span>
          {user.email} · {stats?.database || "…"} · {stats?.server?.name || "…"}
        </span>
        <span>
          {number(stats?.short || 0)} transferuri scurte ·{" "}
          {number(stats?.excluded || 0)} excluse
        </span>
      </div>
      <section className="surface">
        <div className="filter-bar">
          {[
            ["region", "Regiune", regions],
            ["provider", "Furnizor", providers],
            ["quality", "Calitate", Object.keys(qualityLabel)],
          ].map(([key, label, options]) => (
            <div className="field" key={key}>
              <label htmlFor={"filter-" + key}>{label}</label>
              <select
                id={"filter-" + key}
                value={filters[key]}
                onChange={(e) => filter(key, e.target.value)}
              >
                <option value="">Toate</option>
                {options.map((value) => (
                  <option key={value} value={value}>
                    {key === "quality" ? qualityLabel[value] : value}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {[
            ["from", "Din data · UTC"],
            ["to", "Până la · UTC"],
          ].map(([key, label]) => (
            <div className="field" key={key}>
              <label htmlFor={key}>{label}</label>
              <input
                id={key}
                type="date"
                value={filters[key]}
                onChange={(e) => filter(key, e.target.value)}
              />
            </div>
          ))}
          <button
            className="button"
            onClick={exportData}
            disabled={working || loading}
          >
            Export CSV ↓
          </button>
          <button
            className="button"
            onClick={() => {
              setLoading(true);
              refresh();
            }}
            disabled={loading}
          >
            Actualizează
          </button>
        </div>
        {review && (
          <form className="review-form" onSubmit={exclude}>
            <label htmlFor="reason">Motivul excluderii</label>
            <input
              id="reason"
              minLength={5}
              maxLength={500}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="De ce acest rezultat nu trebuie inclus în statistici?"
            />
            <button className="button primary" disabled={working}>
              Exclude și înregistrează
            </button>
            <button
              type="button"
              className="button"
              onClick={() => setReview(null)}
            >
              Anulează
            </button>
          </form>
        )}
        {loading ? (
          <div className="empty-state" role="status">
            <p>Încărcăm măsurătorile…</p>
          </div>
        ) : !data?.rows.length ? (
          <div className="empty-state">
            <h2>Nicio măsurare în această selecție.</h2>
            <p>
              Rezultatele apar aici când un participant finalizează testul și
              acceptă contribuția la proiect.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">
                Măsurători colectate cu acordul participanților
              </caption>
              <thead>
                <tr>
                  <th>Data · locală</th>
                  <th>Regiune / furnizor</th>
                  <th>↓ Mbps</th>
                  <th>↑ Mbps</th>
                  <th>Latență · ms</th>
                  <th>Server</th>
                  <th>Calitate</th>
                  <th>Revizuire</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {new Date(row.created_at).toLocaleString("ro-MD", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td>
                      {row.region || "Nedeclarată"}
                      <br />
                      <small className="muted">
                        {row.provider || "Nedeclarat"} · {row.connection_type}
                      </small>
                    </td>
                    <td>{number(row.down)}</td>
                    <td>{number(row.up)}</td>
                    <td>{number(row.ping)}</td>
                    <td>
                      {row.server_id}
                      <br />
                      <small className="muted">{row.server_country}</small>
                    </td>
                    <td>
                      <span className={"badge " + row.quality}>
                        {qualityLabel[row.quality]}
                      </span>
                    </td>
                    <td>
                      {row.quality === "excluded" ? (
                        <span title={row.excluded_reason}>Exclus ⓘ</span>
                      ) : (
                        <button
                          className="text-link"
                          onClick={() => {
                            setReview(row.id);
                            setReason("");
                          }}
                        >
                          Exclude
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span>
            {data?.total || 0} rezultate · pagina {page}
          </span>
          <div>
            <button
              className="button"
              disabled={page === 1 || loading}
              onClick={() => {
                setLoading(true);
                setPage((p) => p - 1);
              }}
            >
              ← Înapoi
            </button>
            <button
              className="button"
              disabled={loading || !data || page * 25 >= data.total}
              onClick={() => {
                setLoading(true);
                setPage((p) => p + 1);
              }}
            >
              Înainte →
            </button>
          </div>
        </div>
      </section>
      <p className="table-caption">
        Timpii sunt raportați de browser; regiunea și furnizorul sunt declarate
        de participant. Testele locale, excluse și transferurile scurte nu intră
        în mediile publice. Export: maximum 10.000 de rânduri per selecție.
      </p>
      <details className="audit">
        <summary>Jurnal de administrare · ultimele 100 de acțiuni</summary>
        <div className="surface table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Administrator</th>
                <th>Acțiune</th>
                <th>Motiv / filtre</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString("ro-MD")}</td>
                  <td>{row.email}</td>
                  <td>{row.action}</td>
                  <td>{row.reason}</td>
                </tr>
              ))}
              {!audit.length && (
                <tr>
                  <td colSpan={4}>Nicio acțiune înregistrată.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </main>
  );
}
