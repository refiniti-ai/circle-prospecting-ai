import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { fetchAdminSummary } from "../lib/leadsApi";

const KEY = "cpai_admin_key";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const showAdmin = import.meta.env.DEV || import.meta.env.VITE_SHOW_ADMIN === "1";
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [boot, setBoot] = useState(true);

  useEffect(() => {
    const saved = sessionStorage.getItem(KEY);
    if (!saved) {
      setBoot(false);
      return;
    }
    setBusy(true);
    fetchAdminSummary(saved)
      .then(() => {
        navigate("/admin", { replace: true });
      })
      .catch(() => {
        sessionStorage.removeItem(KEY);
        setAdminKeyInput("");
      })
      .finally(() => {
        setBusy(false);
        setBoot(false);
      });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr(null);
    const k = adminKeyInput.trim();
    if (!k) {
      setLoginErr("Enter the admin API key (same as server ADMIN_API_KEY).");
      return;
    }
    setBusy(true);
    try {
      await fetchAdminSummary(k);
      sessionStorage.setItem(KEY, k);
      navigate("/admin", { replace: true });
    } catch {
      setLoginErr("Invalid key or cannot reach the API. Check VITE_API_BASE_URL and that the backend is running.");
    } finally {
      setBusy(false);
    }
  }

  if (!showAdmin) {
    return (
      <>
        <SeoHead title="Admin login" description="Operations" path="/admin/login" noindex />
        <div className="app-shell rz-shell rz-app">
          <SiteHeader />
          <main id="main-content" tabIndex={-1} className="page-space rzInterior">
            <div className="container page-narrow">
              <div className="page-center-card">
                <h1 className="page-h1">Admin login</h1>
                <p className="page-lead" style={{ textAlign: "left", maxWidth: "100%" }}>
                  Set <code className="cp-kbd">VITE_SHOW_ADMIN=1</code> in <code className="cp-kbd">.env</code> and rebuild to expose admin in production.
                </p>
                <Link to="/" className="btn btn-primary" style={{ marginTop: "1rem" }}>
                  Home
                </Link>
              </div>
            </div>
          </main>
          <SiteFooter />
        </div>
      </>
    );
  }

  if (boot) {
    return (
      <>
        <SeoHead title="Admin login" description="Operations" path="/admin/login" noindex />
        <div className="app-shell rz-shell rz-app">
          <SiteHeader />
          <main className="page-space rzInterior">
            <div className="container" style={{ maxWidth: 480 }}>
              <p className="muted">Checking session…</p>
            </div>
          </main>
          <SiteFooter />
        </div>
      </>
    );
  }

  return (
    <>
      <SeoHead title="Admin login | Circle Prospecting AI" description="Operator sign-in" path="/admin/login" noindex />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space page-space--tight rzInterior">
          <div className="container page-narrow" style={{ maxWidth: 440 }}>
            <div className="page-center-card" style={{ marginTop: "1rem" }}>
              <h1 className="page-h1" style={{ fontSize: "1.65rem" }}>
                Admin sign-in
              </h1>
              <p className="muted" style={{ marginBottom: "1rem", fontSize: "0.92rem" }}>
                Use the server&apos;s <code className="cp-kbd">ADMIN_API_KEY</code>. Stored only in this tab&apos;s{" "}
                <code className="cp-kbd">sessionStorage</code>.
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
                    disabled={busy}
                  />
                </label>
                {loginErr ? <p className="cp-alert cp-alert--error">{loginErr}</p> : null}
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </button>
              </form>
              <p style={{ marginTop: "1.25rem", fontSize: "0.88rem" }}>
                <Link to="/">← Back to site</Link>
              </p>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
