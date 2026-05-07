import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { contactEmail } from "../lib/siteConfig";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { apiBase } from "../lib/apiBase";
import { claimLeadSession } from "../lib/leadsApi";

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
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [signInErr, setSignInErr] = useState<string | null>(null);
  const [signInBusy, setSignInBusy] = useState(false);

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
        if (data.customerEmail) setEmail((prev) => (prev.trim() ? prev : data.customerEmail!));
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

  const showLeadSignIn = Boolean(sessionId && (!info || info.checkoutType === "lead_pack"));

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) return;
    setSignInErr(null);
    const digits = phone.replace(/\D/g, "");
    if (!email.includes("@")) {
      setSignInErr("Enter the email you used before checkout.");
      return;
    }
    if (digits.length < 10) {
      setSignInErr("Enter the phone number you used before checkout (at least 10 digits).");
      return;
    }
    setSignInBusy(true);
    try {
      const r = await claimLeadSession(sessionId, email.trim(), phone.trim());
      localStorage.setItem(TOKEN_KEY, r.token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setSignInErr(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setSignInBusy(false);
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

              {showLeadSignIn ? (
                <div className="section-surface" style={{ marginTop: "1.5rem", textAlign: "left" }}>
                  <h2 className="page-h1" style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>
                    Log in
                  </h2>
                  <form onSubmit={onSignIn} style={{ display: "grid", gap: "1rem" }}>
                    <label className="cp-form-grid">
                      <span className="muted-label">Email</span>
                      <input
                        type="email"
                        className="premium-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                      />
                    </label>
                    <label className="cp-form-grid">
                      <span className="muted-label">Phone</span>
                      <input
                        type="tel"
                        className="premium-input"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        autoComplete="tel"
                        required
                      />
                    </label>
                    {signInErr ? <p className="cp-alert cp-alert--error">{signInErr}</p> : null}
                    <button type="submit" className="btn btn-primary" disabled={signInBusy}>
                      {signInBusy ? "Signing in…" : "Log in & open dashboard"}
                    </button>
                  </form>
                </div>
              ) : null}

              {sessionId && info && info.checkoutType !== "lead_pack" ? (
                <p style={{ marginTop: "1.75rem" }}>
                  <Link to="/" className="btn btn-primary">
                    Back to home
                  </Link>
                </p>
              ) : null}

              {!sessionId ? (
                <p style={{ marginTop: "1.75rem" }}>
                  <Link to="/" className="btn btn-primary">
                    Back to home
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
