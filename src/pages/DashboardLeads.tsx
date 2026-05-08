import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { downloadMyLeadsCsv, fetchMyLeads, fetchMyPurchases, type MyPurchaseRow, type PurchasedLead } from "../lib/leadsApi";

const TOKEN_KEY = "cpai_dash_jwt";

function formatPurchaseTotal(cents: number | null, currency: string | null): string {
  if (cents == null) return "—";
  const cur = (currency || "usd").toUpperCase();
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: cur });
}

export function DashboardLeads() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [leads, setLeads] = useState<PurchasedLead[]>([]);
  const [purchases, setPurchases] = useState<MyPurchaseRow[]>([]);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLeads([]);
      setPurchases([]);
      return;
    }
    let ok = true;
    Promise.all([fetchMyLeads(token), fetchMyPurchases(token)])
      .then(([leadsRes, purchRes]) => {
        if (!ok) return;
        setLeads(leadsRes.leads);
        setPurchases(purchRes.purchases);
        setEmail(leadsRes.email);
      })
      .catch(() => {
        if (ok) {
          setErr("Session expired — sign in again with your email and password.");
          localStorage.removeItem(TOKEN_KEY);
          setToken("");
        }
      });
    return () => {
      ok = false;
    };
  }, [token]);

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setLeads([]);
    setPurchases([]);
  }

  return (
    <>
      <SeoHead
        title="My purchases & delivery | Circle Prospecting AI"
        description="Your orders and promotion delivery for your account email."
        path="/dashboard"
        noindex
      />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space page-space--tight rzInterior">
          <div className="container" style={{ maxWidth: 1000 }}>
            <header className="page-hero">
              <p className="page-breadcrumb">
                <Link to="/">Home</Link> / Client dashboard
              </p>
              <h1 className="page-h1">My account</h1>
            </header>

            {err && <p className="cp-alert cp-alert--error">{err}</p>}

            {!token && (
              <div className="section-surface" style={{ maxWidth: 420, marginTop: "0.5rem" }}>
                <p className="page-lead" style={{ marginBottom: "1rem" }}>
                  You are not signed in. Use <strong>Log in</strong> with the email and password you set on the thank-you
                  page after checkout.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
                  <Link to="/login" className="btn btn-primary">
                    Log in
                  </Link>
                  <Link to="/buy-leads" className="btn btn-ghost">
                    Start prospecting
                  </Link>
                </div>
              </div>
            )}

            {token && email && (
              <div
                className="section-surface"
                style={{
                  marginTop: "1rem",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  columnGap: "1rem",
                }}
              >
                <span style={{ color: "var(--muted)", flex: "1 1 auto", minWidth: "12rem" }}>
                  Signed in as <strong style={{ color: "var(--text)" }}>{email}</strong>
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.65rem", marginLeft: "auto" }}>
                  <button type="button" className="link-btn" onClick={logout}>
                    Sign out
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => downloadMyLeadsCsv(token)}>
                    Download lead CSV
                  </button>
                </div>
              </div>
            )}

            {token && purchases.length === 0 && !err && (
              <p className="muted" style={{ marginTop: "1rem", fontSize: "0.9rem", maxWidth: 560 }}>
                No orders are listed yet. If you just paid, wait a few seconds for the server to record your purchase,
                then refresh. You can also complete <strong>Create your dashboard password</strong> on the thank-you
                page so your account is linked.
              </p>
            )}

            {token && purchases.length > 0 && (
              <section style={{ marginTop: "1.75rem" }} aria-labelledby="dash-purchases-h">
                <h2 className="premium-h2" id="dash-purchases-h" style={{ fontSize: "1.15rem", marginBottom: "0.75rem" }}>
                  Your purchases
                </h2>
                <div className="cp-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Summary</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map((p) => (
                        <tr key={p.sessionId}>
                          <td>
                            <code className="cp-kbd">{p.orderNumber}</code>
                          </td>
                          <td>{p.notifiedAt ? new Date(p.notifiedAt).toLocaleString() : "—"}</td>
                          <td>{p.checkoutType === "lead_pack" ? "Lead pack" : p.checkoutType}</td>
                          <td>
                            <span style={{ display: "block", maxWidth: 320 }}>
                              {p.lineItems.length ? p.lineItems.join(" · ") : "—"}
                              {p.targetingSummary ? (
                                <span className="muted" style={{ display: "block", fontSize: "0.82rem", marginTop: "0.25rem" }}>
                                  {p.targetingSummary}
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td>{formatPurchaseTotal(p.amountTotalCents, p.currency)}</td>
                          <td>{p.paymentStatus ?? "Paid"}</td>
                          <td>{p.orderStatus ?? "Confirmed"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {token && (
              <section style={{ marginTop: "2rem" }} aria-labelledby="dash-leads-h">
                <h2 className="premium-h2" id="dash-leads-h" style={{ fontSize: "1.15rem", marginBottom: "0.35rem" }}>
                  Delivery (assigned leads)
                </h2>
                <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.88rem", maxWidth: 640 }}>
                  Rows are saved to <strong>Firestore</strong> when your server is connected, and merged with local inventory so they still show
                  here after checkout.
                </p>
              </section>
            )}

            {token && leads.length === 0 && !err && (
              <p className="cp-alert cp-alert--info" style={{ marginTop: "0.25rem" }}>
                No delivery rows yet — ask an admin to upload inventory or complete checkout.
              </p>
            )}

            {leads.length > 0 && (
              <div className="cp-table-wrap" style={{ marginTop: "1.25rem" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Address</th>
                      <th>City / ST</th>
                      <th>Price</th>
                      <th>MLS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => (
                      <tr key={l.id}>
                        <td>{l.address}</td>
                        <td>
                          {l.city}, {l.state} {l.zip}
                        </td>
                        <td>{l.listPrice}</td>
                        <td>{l.mls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p style={{ marginTop: "2.25rem" }} className="page-breadcrumb">
              <Link to="/">← Back to home</Link>
            </p>
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
