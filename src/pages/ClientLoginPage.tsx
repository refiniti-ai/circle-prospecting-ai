import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { claimLeadSession } from "../lib/leadsApi";

const TOKEN_KEY = "cpai_dash_jwt";

/**
 * Sign in with Stripe Checkout session id + same email and phone used before paying.
 */
export function ClientLoginPage() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = sessionId.trim();
    if (id.length < 10) return;
    setErr(null);
    const digits = phone.replace(/\D/g, "");
    if (!email.includes("@")) {
      setErr("Enter your email.");
      return;
    }
    if (digits.length < 10) {
      setErr("Enter your phone number (at least 10 digits).");
      return;
    }
    setBusy(true);
    try {
      const r = await claimLeadSession(id, email.trim(), phone.trim());
      localStorage.setItem(TOKEN_KEY, r.token);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SeoHead
        title="Client login | Circle Prospecting AI"
        description="Access your promotion delivery after checkout."
        path="/login"
        noindex
      />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space page-space--tight rzInterior">
          <div className="container page-narrow" style={{ maxWidth: 480 }}>
            <header className="page-hero">
              <p className="page-breadcrumb">
                <Link to="/">Home</Link> / Client login
              </p>
              <h1 className="page-h1">Client login</h1>
              <p className="page-lead" style={{ maxWidth: "100%" }}>
                After payment, use the <strong>session id</strong> from your Stripe receipt or success page (starts with <code className="cp-kbd">cs_</code>),
                plus the <strong>same email and phone</strong> you entered before checkout.
              </p>
            </header>

            <form onSubmit={onSubmit} className="section-surface" style={{ padding: "1.25rem", display: "grid", gap: "1rem" }}>
              <label className="cp-form-grid">
                <span className="muted-label">Stripe Checkout session id</span>
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
              {err ? <p className="cp-alert cp-alert--error">{err}</p> : null}
              <button type="submit" className="btn btn-primary" disabled={busy || sessionId.trim().length < 10}>
                {busy ? "Signing in…" : "Open dashboard"}
              </button>
            </form>

            <div style={{ marginTop: "1.25rem", display: "grid", gap: "0.65rem", fontSize: "0.92rem" }}>
              <Link to="/dashboard" className="link-btn" style={{ width: "fit-content" }}>
                Already signed in — open dashboard
              </Link>
              <Link to="/buy-leads" className="link-btn" style={{ width: "fit-content" }}>
                Start a new campaign
              </Link>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
