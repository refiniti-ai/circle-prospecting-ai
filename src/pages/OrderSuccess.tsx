import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { contactEmail } from "../lib/siteConfig";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { apiBase } from "../lib/apiBase";
import { clearPendingCheckoutSessionId, rememberCheckoutSessionId } from "../lib/checkoutSessionBridge";
import { setClientPasswordFromSession, syncPaidCheckoutSession } from "../lib/leadsApi";
import { notifyError, notifyWarning } from "../lib/notify";

const TOKEN_KEY = "cpai_dash_jwt";

type CheckoutConfirmation = {
  orderNumber: string;
  sessionId: string;
  checkoutType: string;
  paymentStatus: string;
  customerEmail: string | null;
  /** True when this checkout email already has a dashboard password (repeat buyer). */
  dashboardAccountExists?: boolean;
  currency: string;
  amountTotalCents: number | null;
  lineItems: { description: string; quantity: number }[];
};

export function OrderSuccess() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id");
  const [info, setInfo] = useState<CheckoutConfirmation | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(Boolean(sessionId));
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const syncWarnedRef = useRef(false);

  useEffect(() => {
    if (sessionId) rememberCheckoutSessionId(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setConfirmLoading(false);
      return;
    }
    setConfirmLoading(true);
    const ac = new AbortController();
    fetch(`${apiBase()}/api/checkout/confirmation?session_id=${encodeURIComponent(sessionId)}`, { signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load purchase confirmation");
        return (await r.json()) as CheckoutConfirmation;
      })
      .then((data) => {
        setInfo(data);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "AbortError") return;
        notifyWarning("Could not load full confirmation details.", { id: "order-success-confirm" });
      })
      .finally(() => {
        if (!ac.signal.aborted) setConfirmLoading(false);
      });
    return () => ac.abort();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !info || info.paymentStatus !== "paid") return;
    const storageKey = `cpai_sync_paid_${sessionId}`;
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(storageKey)) return;
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(storageKey, "1");
    } catch {
      /* private mode — still attempt sync (idempotent) */
    }
    syncPaidCheckoutSession(sessionId).catch((err) => {
      try {
        if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      if (!syncWarnedRef.current) {
        syncWarnedRef.current = true;
        const detail = err instanceof Error ? err.message : "Network or server error";
        notifyWarning(
          `Could not confirm your order on the server (${detail}). Refresh this page or open the dashboard after logging in. If it still missing, contact support with your order ID.`,
          { id: "order-success-sync" }
        );
      }
    });
  }, [sessionId, info]);

  const total =
    info?.amountTotalCents == null
      ? null
      : (info.amountTotalCents / 100).toLocaleString("en-US", { style: "currency", currency: (info.currency || "usd").toUpperCase() });

  const showLeadPasswordSetup = Boolean(
    sessionId &&
      info &&
      info.checkoutType === "lead_pack" &&
      !info.dashboardAccountExists
  );

  async function onCreatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) return;
    if (password.length < 8) {
      notifyError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== password2) {
      notifyError("Passwords do not match.");
      return;
    }
    setPwBusy(true);
    try {
      const r = await setClientPasswordFromSession(sessionId, password);
      localStorage.setItem(TOKEN_KEY, r.token);
      clearPendingCheckoutSessionId();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Could not save password.");
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
                <Link to="/dashboard" className="btn btn-ghost">
                  Open dashboard
                </Link>
                <Link to="/" className="btn btn-ghost">
                  Back to home
                </Link>
              </div>

              {sessionId &&
              info?.checkoutType === "lead_pack" &&
              info.dashboardAccountExists &&
              !confirmLoading ? (
                <p className="muted" style={{ marginTop: "1rem", fontSize: "0.9rem", lineHeight: 1.5, textAlign: "left" }}>
                  You already have a dashboard for <strong>{info.customerEmail || "this email"}</strong>.{" "}
                  <strong>Log in</strong> with your existing password to see this order — no need to create a new one.
                </p>
              ) : null}

              {sessionId && info?.paymentStatus === "paid" ? (
                <p style={{ marginTop: "1rem" }}>
                  <Link to={`/invoice?session_id=${encodeURIComponent(sessionId)}`} className="btn btn-ghost">
                    View invoice
                  </Link>
                </p>
              ) : null}

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
              {sessionId && confirmLoading ? (
                <p className="muted" style={{ marginTop: "1.25rem", fontSize: "0.9rem" }}>
                  Loading order details…
                </p>
              ) : null}

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
