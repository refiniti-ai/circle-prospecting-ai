import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { contactEmail } from "../lib/siteConfig";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { apiBase } from "../lib/apiBase";
import { clearPendingCheckoutSessionId, rememberCheckoutSessionId } from "../lib/checkoutSessionBridge";
import { setClientPasswordFromSession } from "../lib/leadsApi";

const TOKEN_KEY = "cpai_dash_jwt";

type CheckoutConfirmation = {
  orderNumber: string;
  sessionId: string;
  checkoutType: string;
  paymentStatus: string;
  customerEmail: string | null;
  currency: string;
  amountTotalCents: number | null;
  lineItems: { description: string; quantity: number }[];
};

export function OrderSuccess() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id");
  const [info, setInfo] = useState<CheckoutConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (sessionId) rememberCheckoutSessionId(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const ac = new AbortController();
    fetch(`${apiBase()}/api/checkout/confirmation?session_id=${encodeURIComponent(sessionId)}`, { signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load purchase confirmation");
        return (await r.json()) as CheckoutConfirmation;
      })
      .then((data) => {
        setInfo(data);
        setError(null);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setError("Could not load full confirmation details.");
      });
    return () => ac.abort();
  }, [sessionId]);

  const total =
    info?.amountTotalCents == null
      ? null
      : (info.amountTotalCents / 100).toLocaleString("en-US", { style: "currency", currency: (info.currency || "usd").toUpperCase() });

  const showLeadPasswordSetup = Boolean(sessionId && (!info || info.checkoutType === "lead_pack"));

  async function onCreatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) return;
    setPwErr(null);
    if (password.length < 8) {
      setPwErr("Use at least 8 characters for your password.");
      return;
    }
    if (password !== password2) {
      setPwErr("Passwords do not match.");
      return;
    }
    setPwBusy(true);
    try {
      const r = await setClientPasswordFromSession(sessionId, password);
      localStorage.setItem(TOKEN_KEY, r.token);
      clearPendingCheckoutSessionId();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : "Could not save password.");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <>
      <SeoHead
        title="Thank you | Circle Prospecting AI"
        description="Your prospecting order was received."
        path="/order/success"
        noindex
      />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space rzInterior">
          <div className="container page-narrow">
            <div className="page-center-card">
              <h1 className="page-h1 page-h1--gradient">Thanks for your purchase</h1>
              <p className="page-lead" style={{ maxWidth: "100%" }}>
                Your payment went through.
                {info?.orderNumber ? (
                  <>
                    {" "}
                    Your order ID: <code className="cp-kbd">{info.orderNumber}</code>
                  </>
                ) : sessionId ? (
                  <>
                    {" "}
                    Order reference: <code className="cp-kbd">{sessionId}</code>
                  </>
                ) : null}
                . Save your order ID for your records. Need help?{" "}
                <a href={`mailto:${contactEmail()}`} style={{ color: "var(--accent-cyan)" }}>
                  {contactEmail()}
                </a>
                .
              </p>

              <div style={{ marginTop: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
                <Link to="/login" className="btn btn-primary">
                  Log in
                </Link>
                <Link to="/" className="btn btn-ghost">
                  Back to home
                </Link>
              </div>

              {info ? (
                <details className="section-surface" style={{ marginTop: "1rem", textAlign: "left" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--muted)" }}>Receipt details</summary>
                  <div style={{ marginTop: "0.75rem" }}>
                    <p style={{ margin: "0 0 0.35rem" }}>
                      <strong>Status:</strong> {info.paymentStatus}
                    </p>
                    {info.customerEmail ? (
                      <p style={{ margin: "0 0 0.35rem" }}>
                        <strong>Email:</strong> {info.customerEmail}
                      </p>
                    ) : null}
                    {total ? (
                      <p style={{ margin: "0 0 0.65rem" }}>
                        <strong>Total:</strong> {total}
                      </p>
                    ) : null}
                    <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                      {info.lineItems.map((line, idx) => (
                        <li key={`${line.description}-${idx}`}>
                          {line.description} x{line.quantity}
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              ) : null}
              {error ? <p className="cp-alert cp-alert--warn">{error}</p> : null}

              {showLeadPasswordSetup ? (
                <div className="section-surface" style={{ marginTop: "1.5rem", textAlign: "left" }}>
                  <h2 className="page-h1" style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
                    Create your dashboard password
                  </h2>
                  <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.9rem", lineHeight: 1.5 }}>
                    Choose a password you will use on the <strong>Log in</strong> page (with your email) to open your
                    dashboard from any device.
                  </p>
                  <form onSubmit={onCreatePassword} style={{ display: "grid", gap: "1rem" }}>
                    <label className="cp-form-grid">
                      <span className="muted-label">Password</span>
                      <input
                        type="password"
                        className="premium-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                    </label>
                    <label className="cp-form-grid">
                      <span className="muted-label">Confirm password</span>
                      <input
                        type="password"
                        className="premium-input"
                        value={password2}
                        onChange={(e) => setPassword2(e.target.value)}
                        placeholder="Repeat password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                    </label>
                    {pwErr ? <p className="cp-alert cp-alert--error">{pwErr}</p> : null}
                    <button type="submit" className="btn btn-primary" disabled={pwBusy}>
                      {pwBusy ? "Saving…" : "Save password & open dashboard"}
                    </button>
                  </form>
                </div>
              ) : null}

              {!sessionId ? (
                <p style={{ marginTop: "1.75rem" }}>
                  <Link to="/login" className="btn btn-primary">
                    Log in
                  </Link>
                </p>
              ) : null}
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
