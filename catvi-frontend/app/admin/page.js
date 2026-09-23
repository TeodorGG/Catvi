"use client";
import { useCallback, useEffect, useState } from "react";
import { API_BASE, request, number, providers } from "@/lib/api";
import regions from "@/lib/regions.json";
import { useLang } from "@/lib/i18n";

export default function AdminPage() {
  const { t } = useLang();
  const qualityLabel = {
    usable: t("qualityUsable"),
    short: t("qualityShort"),
    excluded: t("qualityExcluded"),
  };
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
        if (err.status !== 401) setError(t("adminServerUnavailable"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          else setError(t("refreshLoadError"));
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
          ? t("loginErrorRateLimit")
          : err.status === 401
            ? t("loginErrorBadCreds")
            : t("loginErrorUnavailable"),
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
      setError(t("logoutError"));
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
            ? t("exportLimitError")
            : t("exportGenericError"),
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
      else setError(t("reviewSaveError"));
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
        <p role="status">{t("adminSessionChecking")}</p>
      </main>
    );
  if (!user)
    return (
      <main id="main" className="container page-main">
        <section className="surface login-box">
          <span className="eyebrow">{t("loginEyebrow")}</span>
          <h1>{t("loginH1")}</h1>
          <p>{t("loginP")}</p>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <form onSubmit={login}>
            <div className="field">
              <label htmlFor="email">{t("loginEmailLabel")}</label>
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
              <label htmlFor="password">{t("loginPasswordLabel")}</label>
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
              {working ? t("loginBtnWorking") : t("loginBtnIdle")} <span>↗</span>
            </button>
          </form>
        </section>
      </main>
    );
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t("adminEyebrow")}</div>
          <h1>{t("adminH1")}</h1>
          <p>{t("adminP")}</p>
        </div>
        <div className="admin-actions">
          <button className="text-link" onClick={logout}>
            {t("logoutBtn")}
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
          [t("statMeasurements"), stats?.total, t("statMeasurementsHelp")],
          [t("statToday"), stats?.today, t("statTodayHelp")],
          [t("statAvgDown"), stats?.down, t("statAvgDownHelp")],
          [t("statRegionsWithData"), stats?.regions, t("statRegionsWithDataHelp")],
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
          {t("adminInfoTemplate")
            .replace("{short}", number(stats?.short || 0))
            .replace("{excluded}", number(stats?.excluded || 0))}
        </span>
      </div>
      <section className="surface">
        <div className="filter-bar">
          {[
            ["region", t("filterRegion"), regions],
            ["provider", t("filterProvider"), providers],
            ["quality", t("filterQuality"), Object.keys(qualityLabel)],
          ].map(([key, label, options]) => (
            <div className="field" key={key}>
              <label htmlFor={"filter-" + key}>{label}</label>
              <select
                id={"filter-" + key}
                value={filters[key]}
                onChange={(e) => filter(key, e.target.value)}
              >
                <option value="">{t("filterAll")}</option>
                {options.map((value) => (
                  <option key={value} value={value}>
                    {key === "quality" ? qualityLabel[value] : value}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {[
            ["from", t("filterFrom")],
            ["to", t("filterTo")],
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
            {t("exportBtn")}
          </button>
          <button
            className="button"
            onClick={() => {
              setLoading(true);
              refresh();
            }}
            disabled={loading}
          >
            {t("refreshBtn")}
          </button>
        </div>
        {review && (
          <form className="review-form" onSubmit={exclude}>
            <label htmlFor="reason">{t("reviewReasonLabel")}</label>
            <input
              id="reason"
              minLength={5}
              maxLength={500}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reviewReasonPlaceholder")}
            />
            <button className="button primary" disabled={working}>
              {t("reviewExcludeBtn")}
            </button>
            <button
              type="button"
              className="button"
              onClick={() => setReview(null)}
            >
              {t("reviewCancelBtn")}
            </button>
          </form>
        )}
        {loading ? (
          <div className="empty-state" role="status">
            <p>{t("loadingMeasurementsAdmin")}</p>
          </div>
        ) : !data?.rows.length ? (
          <div className="empty-state">
            <h2>{t("emptySelectionTitle")}</h2>
            <p>{t("emptySelectionP")}</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">{t("srMeasurementsCaption")}</caption>
              <thead>
                <tr>
                  <th>{t("colDate")}</th>
                  <th>{t("colRegionProvider")}</th>
                  <th>{t("colDown")}</th>
                  <th>{t("colUp")}</th>
                  <th>{t("colLatency")}</th>
                  <th>{t("colServer")}</th>
                  <th>{t("colQuality")}</th>
                  <th>{t("colReview")}</th>
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
                      {row.region || t("undeclaredRegion")}
                      <br />
                      <small className="muted">
                        {row.provider || t("undeclaredProvider")} · {row.connection_type}
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
                        <span title={row.excluded_reason}>{t("excludedTag")}</span>
                      ) : (
                        <button
                          className="text-link"
                          onClick={() => {
                            setReview(row.id);
                            setReason("");
                          }}
                        >
                          {t("excludeBtn")}
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
            {t("paginationTemplate")
              .replace("{total}", data?.total || 0)
              .replace("{page}", page)}
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
              {t("prevBtn")}
            </button>
            <button
              className="button"
              disabled={loading || !data || page * 25 >= data.total}
              onClick={() => {
                setLoading(true);
                setPage((p) => p + 1);
              }}
            >
              {t("nextBtn")}
            </button>
          </div>
        </div>
      </section>
      <p className="table-caption">{t("tableCaptionAdmin")}</p>
      <details className="audit">
        <summary>{t("auditSummary")}</summary>
        <div className="surface table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("auditColDate")}</th>
                <th>{t("auditColAdmin")}</th>
                <th>{t("auditColAction")}</th>
                <th>{t("auditColReason")}</th>
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
                  <td colSpan={4}>{t("auditEmpty")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </main>
  );
}
