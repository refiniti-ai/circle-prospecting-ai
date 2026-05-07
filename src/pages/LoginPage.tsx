import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { claimLeadSession, fetchAdminSummary } from "../lib/leadsApi";

const TOKEN_KEY = "cpai_dash_jwt";
const ADMIN_KEY = "cpai_admin_key";

type Tab = "client" | "admin";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "admin" ? "admin" : "client";

  const [sessionId, setSessionId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [clientErr, setClientErr] = useState<string | null>(null);
  const [clientBusy, setClientBusy] = useState(false);

  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [adminErr, setAdminErr] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminBoot, setAdminBoot] = useState(true);

  useEffect(() => {
    const fromUrl = searchParams.get("session_id")?.trim();
    if (fromUrl) setSessionId(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    if (tab !== "admin") {
      setAdminBoot(false);
      return;
    }
    const saved = sessionStorage.getItem(ADMIN_KEY);
    if (!saved) {
      setAdminBoot(false);
      return;
    }
    setAdminBusy(true);
    fetchAdminSummary(saved)
      .then(() => navigate("/admin", { replace: true }))
      .catch(() => {
        sessionStorage.removeItem(ADMIN_KEY);
        setAdminKeyInput("");
      })
      .finally(() => {
        setAdminBusy(false);
        setAdminBoot(false);
      });
  }, [tab, navigate]);

  function setTab(next: Tab) {
    const sid = searchParams.get("session_id");
    const p = new URLSearchParams();
    if (next === "admin") {
      p.set("tab", "admin");
      if (sid) p.set("session_id", sid);
    } else if (sid) {
      p.set("session_id", sid);
    }
    setSearchParams(p, { replace: true });
  }

  async function onClientSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = sessionId.trim();
    if (id.length < 10) return;
    setClientErr(null);
    const digits = phone.replace(/\D/g, "");
    if (!email.includes("@")) {
      setClientErr("Enter your email.");
      return;
    }
    if (digits.length < 10) {
      setClientErr("Enter your phone number (at least 10 digits).");
      return;
    }
    setClientBusy(true);
    try {
      const r = await claimLeadSession(id, email.trim(), phone.trim());
      localStorage.setItem(TOKEN_KEY, r.token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setClientErr(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setClientBusy(false);
    }
  }

  async function onAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAdminErr(null);
    const k = adminKeyInput.trim();
    if (!k) {
      setAdminErr("Enter the admin API key (same as server ADMIN_API_KEY).");
      return;
    }
    setAdminBusy(true);
    try {
      await fetchAdminSummary(k);
      sessionStorage.setItem(ADMIN_KEY, k);
      navigate("/admin", { replace: true });
    } catch {
      setAdminErr("Invalid key or cannot reach the API. Check that the API is running and CORS allows this site.");
    } finally {
      setAdminBusy(false);
    }
  }

  return (
    <>
      <SeoHead
        title="Log in | Circle Prospecting AI"
        description="Client dashboard or admin sign-in."
        path="/login"
        noindex
      />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space page-space--tight rzInterior">
          <div className="container page-narrow" style={{ maxWidth: 520 }}>
            <header className="page-hero">
              <p className="page-breadcrumb">
                <Link to="/">Home</Link> / Log in
              </p>
              <h1 className="page-h1">Log in</h1>
              <p className="page-lead" style={{ maxWidth: "100%" }}>
                <strong>Client</strong>: checkout session id, email, and phone from your order.{" "}
                <strong>Admin</strong>: server <code className="cp-kbd">ADMIN_API_KEY</code>.
              </p>
            </header>

            <div className="login-tab-bar" role="tablist" aria-label="Login type">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "client"}
                className={`login-tab${tab === "client" ? " is-active" : ""}`}
                onClick={() => setTab("client")}
              >
                Client
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "admin"}
                className={`login-tab${tab === "admin" ? " is-active" : ""}`}
                onClick={() => setTab("admin")}
              >
                Admin
              </button>
            </div>

            {tab === "client" && (
              <div role="tabpanel" aria-label="Client login">
                <form
                  onSubmit={onClientSubmit}
                  className="section-surface"
                  style={{ padding: "1.25rem", display: "grid", gap: "1rem", marginTop: "0.75rem" }}
                >
                  <label className="cp-form-grid">
                    <span className="muted-label">Checkout session id (starts with cs_)</span>
                    <input
                      type="text"
                      className="premium-input"
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      placeholder="cs_test_… or cs_live_…"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                  <label className="cp-form-grid">
                    <span className="muted-label">Email</span>
                    <input
                      type="email"
                      className="premium-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </label>
                  <label className="cp-form-grid">
                    <span className="muted-label">Phone</span>
                    <input type="tel" className="premium-input" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                  </label>
                  {clientErr ? <p className="cp-alert cp-alert--error">{clientErr}</p> : null}
                  <button type="submit" className="btn btn-primary" disabled={clientBusy || sessionId.trim().length < 10}>
                    {clientBusy ? "Signing in…" : "Open my dashboard"}
                  </button>
                </form>
                <div style={{ marginTop: "1rem", display: "grid", gap: "0.5rem", fontSize: "0.92rem" }}>
                  <Link to="/dashboard" className="link-btn" style={{ width: "fit-content" }}>
                    Already signed in — open dashboard
                  </Link>
                  <Link to="/buy-leads" className="link-btn" style={{ width: "fit-content" }}>
                    Start prospecting
                  </Link>
                </div>
              </div>
            )}

            {tab === "admin" && (
              <div role="tabpanel" aria-label="Admin login">
                {adminBoot ? (
                  <p className="muted" style={{ marginTop: "1rem" }}>
                    Checking session…
                  </p>
                ) : (
                  <form
                    onSubmit={onAdminSubmit}
                    className="section-surface"
                    style={{ padding: "1.25rem", display: "grid", gap: "1rem", marginTop: "0.75rem" }}
                  >
                    <p className="muted" style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.45 }}>
                      Key is stored only in this browser tab (<code className="cp-kbd">sessionStorage</code>). It must match{" "}
                      <code className="cp-kbd">ADMIN_API_KEY</code> on your API.
                    </p>
                    <label className="cp-form-grid">
                      <span className="muted-label">Admin API key</span>
                      <input
                        type="password"
                        className="premium-input"
                        autoComplete="off"
                        value={adminKeyInput}
                        onChange={(e) => setAdminKeyInput(e.target.value)}
                        placeholder="Paste ADMIN_API_KEY"
                        disabled={adminBusy}
                      />
                    </label>
                    {adminErr ? <p className="cp-alert cp-alert--error">{adminErr}</p> : null}
                    <button type="submit" className="btn btn-primary" disabled={adminBusy}>
                      {adminBusy ? "Signing in…" : "Open admin dashboard"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </main>
        <SiteFooter />
      </div>
      <style>{`
        .login-tab-bar {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        .login-tab {
          text-align: center;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          border: 2px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          cursor: pointer;
          font: inherit;
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--muted);
          transition: border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
        }
        .login-tab:hover {
          border-color: rgba(0, 122, 255, 0.35);
          color: var(--text);
        }
        .login-tab.is-active {
          border-color: rgba(0, 122, 255, 0.55);
          color: var(--cp-blue, #007aff);
          box-shadow: 0 0 0 1px rgba(0, 122, 255, 0.12);
        }
      `}</style>
    </>
  );
}
