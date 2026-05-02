import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import {
  fetchAdminPurchases,
  fetchAdminSummary,
  uploadLeadsCsv,
  type AdminPurchaseRow,
} from "../lib/leadsApi";

const KEY = "cpai_admin_key";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "purchases", label: "Purchases" },
  { id: "inventory", label: "Lead inventory" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function formatMoney(cents: number | null, currency: string | null) {
  if (cents == null) return "—";
  const cur = (currency || "usd").toUpperCase();
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: cur });
}

function slugLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  return raw.replace(/_/g, " ");
}

export function AdminDashboard() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "overview";

  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const [summary, setSummary] = useState<{
    total: number;
    available: number;
    sold: number;
    updatedAt?: string;
  } | null>(null);
  const [purchases, setPurchases] = useState<AdminPurchaseRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const loadDashboard = useCallback(async (key: string) => {
    setLoadErr(null);
    const [s, p] = await Promise.all([fetchAdminSummary(key), fetchAdminPurchases(key)]);
    setSummary(s.inventory);
    setPurchases(p.purchases);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(KEY);
    if (!saved) {
      setAuthChecking(false);
      return;
    }
    setAdminKeyInput(saved);
    loadDashboard(saved)
      .then(() => {
        setActiveKey(saved);
        setAuthenticated(true);
        setLoginErr(null);
      })
      .catch(() => {
        sessionStorage.removeItem(KEY);
        setAdminKeyInput("");
        setLoginErr("Saved admin session is invalid or API unreachable.");
      })
      .finally(() => setAuthChecking(false));
  }, [loadDashboard]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr(null);
    const k = adminKeyInput.trim();
    if (!k) {
      setLoginErr("Enter the admin API key (same as server ADMIN_API_KEY).");
      return;
    }
    try {
      await loadDashboard(k);
      sessionStorage.setItem(KEY, k);
      setActiveKey(k);
      setAuthenticated(true);
    } catch {
      setLoginErr("Invalid key or cannot reach the API. Check VITE_API_BASE_URL and that the backend is running.");
    }
  }

  function logout() {
    sessionStorage.removeItem(KEY);
    setAdminKeyInput("");
    setActiveKey(null);
    setAuthenticated(false);
    setSummary(null);
    setPurchases(null);
    setUploadMsg(null);
    setUploadErr(null);
  }

  async function refresh() {
    if (!activeKey) return;
    try {
      await loadDashboard(activeKey);
    } catch {
      setLoadErr("Could not refresh data.");
    }
  }

  async function onUpload() {
    if (!file || !activeKey) {
      setUploadErr("Choose a CSV file first.");
      return;
    }
    setUploadBusy(true);
    setUploadErr(null);
    setUploadMsg(null);
    try {
      const r = await uploadLeadsCsv(file, activeKey);
      setUploadMsg(`Imported ${r.rows} rows. Available: ${r.summary.available}, total: ${r.summary.total}.`);
      setSummary(r.summary);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  const revenueCents = useMemo(() => {
    if (!purchases?.length) return 0;
    return purchases.reduce((acc, p) => acc + (p.amountTotalCents ?? 0), 0);
  }, [purchases]);

  const showAdmin = import.meta.env.DEV || import.meta.env.VITE_SHOW_ADMIN === "1";

  if (!showAdmin) {
    return (
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space rzInterior">
          <div className="container page-narrow">
            <div className="page-center-card">
              <h1 className="page-h1">Admin dashboard</h1>
              <p className="page-lead" style={{ textAlign: "left", maxWidth: "100%" }}>
                Set <code className="cp-kbd">VITE_SHOW_ADMIN=1</code> in <code className="cp-kbd">.env</code> and rebuild to expose admin routes in production.
              </p>
              <Link to="/" className="btn btn-primary" style={{ marginTop: "1rem" }}>
                Home
              </Link>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (authChecking) {
    return (
      <>
        <SeoHead title="Admin | Dashboard" description="Operations" path="/admin" noindex />
        <div className="app-shell rz-shell rz-app">
          <SiteHeader />
          <main className="page-space rzInterior">
            <div className="container" style={{ maxWidth: 720 }}>
              <p className="muted">Loading…</p>
            </div>
          </main>
          <SiteFooter />
        </div>
      </>
    );
  }

  return (
    <>
      <SeoHead title="Admin | Dashboard" description="Purchases and inventory" path="/admin" noindex />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space page-space--tight rzInterior">
          <div className="container" style={{ maxWidth: 1100 }}>
            {!authenticated ? (
              <div className="page-center-card" style={{ maxWidth: 440, margin: "2rem auto" }}>
                <h1 className="page-h1" style={{ fontSize: "1.65rem" }}>
                  Admin sign-in
                </h1>
                <p className="muted" style={{ marginBottom: "1rem", fontSize: "0.92rem" }}>
                  Use the server&apos;s <code className="cp-kbd">ADMIN_API_KEY</code>. Your browser stores it only for this tab session (
                  <code className="cp-kbd">sessionStorage</code>), not on our servers.
                </p>
                <form onSubmit={handleLogin} className="section-surface" style={{ padding: "1.25rem", display: "grid", gap: "1rem" }}>
                  <label className="cp-form-grid">
                    <span className="muted-label">Admin API key</span>
                    <input
                      type="password"
                      className="premium-input"
                      autoComplete="off"
                      value={adminKeyInput}
                      onChange={(e) => setAdminKeyInput(e.target.value)}
                      placeholder="Paste ADMIN_API_KEY"
                    />
                  </label>
                  {loginErr ? <p className="cp-alert cp-alert--error">{loginErr}</p> : null}
                  <button type="submit" className="btn btn-primary">
                    Sign in
                  </button>
                </form>
                <p style={{ marginTop: "1.25rem", fontSize: "0.88rem" }}>
                  <Link to="/">← Back to site</Link>
                </p>
              </div>
            ) : (
              <>
                <header className="page-hero" style={{ marginBottom: "1rem" }}>
                  <p className="page-breadcrumb">
                    <Link to="/">Home</Link> / Admin dashboard
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                    <h1 className="page-h1" style={{ marginBottom: 0 }}>
                      Admin dashboard
                    </h1>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                      <button type="button" className="btn btn-ghost" onClick={() => void refresh()}>
                        Refresh data
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={logout}>
                        Sign out
                      </button>
                    </div>
                  </div>
                  <p className="page-lead" style={{ maxWidth: "100%", marginTop: "0.5rem" }}>
                    Purchases sync when Stripe fires <code className="cp-kbd">checkout.session.completed</code> to your webhook. New lead orders store plan + targeting when metadata is present.
                  </p>
                </header>

                {loadErr ? <p className="cp-alert cp-alert--warn">{loadErr}</p> : null}

                <nav className="admin-dash-tabs" aria-label="Admin sections" style={{ marginBottom: "1.25rem" }}>
                  {TABS.map((t) => (
                    <Link
                      key={t.id}
                      to={`/admin?tab=${t.id}`}
                      className={`btn ${tab === t.id ? "btn-primary" : "btn-ghost"}`}
                      style={{ borderRadius: 999 }}
                    >
                      {t.label}
                    </Link>
                  ))}
                </nav>

                {tab === "overview" && (
                  <section className="admin-dash-overview">
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                        gap: "0.75rem",
                        marginBottom: "1.5rem",
                      }}
                    >
                      <div className="section-surface" style={{ padding: "1rem" }}>
                        <span className="muted-label">Inventory available</span>
                        <strong style={{ fontSize: "1.35rem", display: "block" }}>{summary?.available ?? "—"}</strong>
                      </div>
                      <div className="section-surface" style={{ padding: "1rem" }}>
                        <span className="muted-label">Total leads on file</span>
                        <strong style={{ fontSize: "1.35rem", display: "block" }}>{summary?.total ?? "—"}</strong>
                      </div>
                      <div className="section-surface" style={{ padding: "1rem" }}>
                        <span className="muted-label">Sold / allocated</span>
                        <strong style={{ fontSize: "1.35rem", display: "block" }}>{summary?.sold ?? "—"}</strong>
                      </div>
                      <div className="section-surface" style={{ padding: "1rem" }}>
                        <span className="muted-label">Recorded purchases</span>
                        <strong style={{ fontSize: "1.35rem", display: "block" }}>{purchases?.length ?? "—"}</strong>
                      </div>
                      <div className="section-surface" style={{ padding: "1rem" }}>
                        <span className="muted-label">Recorded revenue (sum)</span>
                        <strong style={{ fontSize: "1.35rem", display: "block" }}>
                          {(revenueCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                        </strong>
                      </div>
                    </div>
                    {summary?.updatedAt && (
                      <p className="muted" style={{ fontSize: "0.85rem" }}>
                        Inventory updated {new Date(summary.updatedAt).toLocaleString()}
                      </p>
                    )}
                    <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                      <Link to="/admin?tab=purchases" className="btn btn-primary">
                        View purchases
                      </Link>
                      <Link to="/admin?tab=inventory" className="btn btn-ghost">
                        Upload CSV
                      </Link>
                    </div>
                  </section>
                )}

                {tab === "purchases" && (
                  <section>
                    {!purchases?.length ? (
                      <p className="muted">No recorded purchases yet. Run a test checkout with webhook forwarding (Stripe CLI) or deploy webhook URL.</p>
                    ) : (
                      <div className="section-surface" style={{ overflowX: "auto" }}>
                        <table className="rezora-data-table" style={{ width: "100%", minWidth: 920 }}>
                          <thead>
                            <tr>
                              <th scope="col">Order</th>
                              <th scope="col">When</th>
                              <th scope="col">Type</th>
                              <th scope="col">Customer</th>
                              <th scope="col">Total</th>
                              <th scope="col">Lead details</th>
                              <th scope="col">Line items</th>
                            </tr>
                          </thead>
                          <tbody>
                            {purchases.map((p) => (
                              <tr key={p.sessionId}>
                                <td>
                                  <code className="cp-kbd">{p.orderNumber}</code>
                                  <div className="muted" style={{ fontSize: "0.72rem", marginTop: 4, wordBreak: "break-all" }}>
                                    {p.sessionId}
                                  </div>
                                </td>
                                <td style={{ whiteSpace: "nowrap", fontSize: "0.88rem" }}>
                                  {new Date(p.notifiedAt).toLocaleString()}
                                </td>
                                <td>{p.checkoutType}</td>
                                <td>{p.customerEmail || "—"}</td>
                                <td>{formatMoney(p.amountTotalCents, p.currency)}</td>
                                <td style={{ fontSize: "0.86rem", maxWidth: 220 }}>
                                  {p.checkoutType === "lead_pack" ? (
                                    <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                                      <li>Service: {slugLabel(p.leadServiceLine)}</li>
                                      <li>Plan: {slugLabel(p.leadTier)}</li>
                                      <li>Qty: {p.requestedLeads ?? "—"}</li>
                                      <li>Area: {p.targetingSummary || "—"}</li>
                                    </ul>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td>
                                  <ul style={{ margin: 0, paddingLeft: "1rem", fontSize: "0.82rem" }}>
                                    {p.lineItems.map((line) => (
                                      <li key={line}>{line}</li>
                                    ))}
                                  </ul>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}

                {tab === "inventory" && (
                  <section className="section-surface" style={{ padding: "1.25rem", display: "grid", gap: "1rem", maxWidth: 720 }}>
                    <p className="muted" style={{ fontSize: "0.9rem", margin: 0 }}>
                      POST <code className="cp-kbd">/api/admin/leads/csv</code> — columns{" "}
                      <code className="cp-kbd">address</code>, <code className="cp-kbd">city</code>, <code className="cp-kbd">state</code>,{" "}
                      <code className="cp-kbd">zip</code>; optional mls, listPrice, phone, email, type.
                    </p>
                    {summary && (
                      <div className="cp-stat-pills" aria-label="Inventory summary">
                        <span className="cp-stat-pill">{summary.available} available</span>
                        <span className="cp-stat-pill">{summary.total} total</span>
                        <span className="cp-stat-pill">{summary.sold} sold</span>
                      </div>
                    )}
                    <label className="cp-form-grid">
                      <span className="muted-label">CSV file</span>
                      <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                    </label>
                    {uploadMsg ? <p className="cp-alert cp-alert--success">{uploadMsg}</p> : null}
                    {uploadErr ? <p className="cp-alert cp-alert--error">{uploadErr}</p> : null}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
                      <button type="button" className="btn btn-primary" disabled={uploadBusy} onClick={() => void onUpload()}>
                        {uploadBusy ? "Uploading…" : "Upload to inventory"}
                      </button>
                      <a className="btn btn-ghost" href="/csv/lead-template.csv" download>
                        Sample CSV
                      </a>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
