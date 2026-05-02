import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { contactEmail } from "../lib/siteConfig";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { apiBase } from "../lib/apiBase";

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
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id");
  const next = sp.get("next");
  const claim = sp.get("claim");
  const [info, setInfo] = useState<CheckoutConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <>
      <SeoHead
        title="Payment success | Circle Prospecting AI"
        description="Your prospecting order was created."
        path="/order/success"
        noindex
      />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space rzInterior">
          <div className="container page-narrow">
            <div className="page-center-card">
              <h1 className="page-h1 page-h1--gradient">Payment received</h1>
              <p className="page-lead" style={{ maxWidth: "100%" }}>
                Thank you for your purchase.
                {info?.orderNumber ? (
                  <>
                    {" "}
                    Your order number is <code className="cp-kbd">{info.orderNumber}</code>.
                  </>
                ) : sessionId ? (
                  <>
                    {" "}
                    (session <code className="cp-kbd">{sessionId}</code>).
                  </>
                ) : (
                  "."
                )}{" "}
                Confirmation emails are sent to you and our team. For questions, contact{" "}
                <a href={`mailto:${contactEmail()}`} style={{ color: "var(--accent-cyan)" }}>
                  {contactEmail()}
                </a>
                .
              </p>
              {info ? (
                <div className="section-surface" style={{ marginTop: "1rem", textAlign: "left" }}>
                  <p className="muted" style={{ margin: "0 0 0.5rem" }}>
                    Purchase details
                  </p>
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
              ) : null}
              {error ? <p className="cp-alert cp-alert--warn">{error}</p> : null}
              <p style={{ marginTop: "1.75rem" }}>
                {next === "dashboard" && sessionId ? (
                  <Link to={`/dashboard?session_id=${encodeURIComponent(sessionId)}${claim === "1" ? "&claim=1" : ""}`} className="btn btn-primary">
                    Continue to dashboard
                  </Link>
                ) : (
                  <Link to="/" className="btn btn-primary">
                    Back to home
                  </Link>
                )}
              </p>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
