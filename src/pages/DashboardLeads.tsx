import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { fetchMyPurchases, type MyPurchaseRow } from "../lib/leadsApi";
import { notifyError } from "../lib/notify";

const TOKEN_KEY = "cpai_dash_jwt";
const PAGE_SIZE = 10;

function formatPurchaseTotal(cents: number | null, currency: string | null): string {
  if (cents == null) return "—";
  const cur = (currency || "usd").toUpperCase();
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: cur });
}

function statusPillClass(orderStatus: string | undefined): string {
  const s = (orderStatus || "").toLowerCase();
  if (s === "completed") return "dash-client-status dash-client-status--done";
  if (s === "processing") return "dash-client-status dash-client-status--open";
  return "dash-client-status dash-client-status--neutral";
}

export function DashboardLeads() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [purchases, setPurchases] = useState<MyPurchaseRow[]>([]);
  const [email, setEmail] = useState("");
  const [purchasePage, setPurchasePage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasesLoaded, setPurchasesLoaded] = useState(false);

  const loadPurchases = useCallback(async (tok: string, quiet?: boolean) => {
    if (!quiet) setRefreshing(true);
    try {
      const res = await fetchMyPurchases(tok);
      setPurchases(res.purchases);
      setEmail(res.email);
    } catch {
      notifyError("Session expired — sign in again with your email and password.");
      localStorage.removeItem(TOKEN_KEY);
      setToken("");
      setPurchases([]);
      setEmail("");
    } finally {
      setPurchasesLoaded(true);
      if (!quiet) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setPurchases([]);
      setEmail("");
      setPurchasesLoaded(false);
      return;
    }
    let ok = true;
    setPurchasesLoaded(false);
    void fetchMyPurchases(token).then(
      (res) => {
        if (!ok) return;
        setPurchases(res.purchases);
        setEmail(res.email);
        setPurchasesLoaded(true);
      },
      () => {
        if (!ok) return;
        notifyError("Session expired — sign in again with your email and password.");
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setPurchasesLoaded(true);
      }
    );
    return () => {
      ok = false;
    };
  }, [token]);

  /** Ascending by order ID (e.g. CP-…), then session id for stability. */
  const purchasesSorted = useMemo(() => {
    return [...purchases].sort((a, b) => {
      const byOrder = a.orderNumber.localeCompare(b.orderNumber, undefined, { sensitivity: "base" });
      if (byOrder !== 0) return byOrder;
      return a.sessionId.localeCompare(b.sessionId);
    });
  }, [purchases]);

  const purchaseTotalPages = Math.max(1, Math.ceil(purchasesSorted.length / PAGE_SIZE));

  useEffect(() => {
    setPurchasePage((p) => Math.min(p, purchaseTotalPages));
  }, [purchaseTotalPages]);

  const paginatedPurchases = useMemo(() => {
    const start = (purchasePage - 1) * PAGE_SIZE;
    return purchasesSorted.slice(start, start + PAGE_SIZE);
  }, [purchasesSorted, purchasePage]);

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setPurchases([]);
    setPurchasePage(1);
  }

  const rangeStart = purchasesSorted.length === 0 ? 0 : (purchasePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(purchasePage * PAGE_SIZE, purchasesSorted.length);

  return (
    <>
      <SeoHead
        title="My purchases | Circle Prospecting AI"
        description="Your orders and promotion purchases for your account email."
        path="/dashboard"
        noindex
      />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main
          id="main-content"
          tabIndex={-1}
          className="page-space page-space--tight rzInterior dash-client-premium"
        >
          <div className="container dash-client-wrap">
            <header className="dash-client-hero">
              <p className="page-breadcrumb dash-client-hero__crumb">
                <Link to="/">Home</Link> / Client dashboard
              </p>
              <h1 className="page-h1 dash-client-hero__title">My account</h1>
              <p className="muted dash-client-hero__lead" style={{ maxWidth: 520, margin: "0.35rem 0 0" }}>
                Purchases and fulfillment status for your email.
              </p>
            </header>

            {!token && (
              <div className="dash-client-card dash-client-card--narrow">
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
              <div className="dash-client-card dash-client-userbar">
                <div className="dash-client-userbar__text">
                  Signed in as <strong>{email}</strong>
                </div>
                <div className="dash-client-userbar__actions">
                  <button
                    type="button"
                    className="dash-client-btn-ghost"
                    disabled={refreshing}
                    onClick={() => void loadPurchases(token)}
                  >
                    {refreshing ? "Refreshing…" : "Refresh"}
                  </button>
                  <button type="button" className="link-btn" onClick={logout}>
                    Sign out
                  </button>
                </div>
              </div>
            )}

            {token && purchasesLoaded && purchases.length === 0 && !refreshing && (
              <p className="muted dash-client-empty-hint">
                No orders are listed yet. If you just paid, wait a few seconds for the server to record your purchase,
                then tap <strong>Refresh</strong>. You can also complete <strong>Create your dashboard password</strong>{" "}
                on the thank-you page so your account is linked.
              </p>
            )}

            {token && purchases.length > 0 && (
              <section className="dash-client-purchases" aria-labelledby="dash-purchases-h">
                <h2 className="dash-client-section-title" id="dash-purchases-h">
                  Your purchases
                </h2>
                <p className="muted" style={{ fontSize: "0.88rem", lineHeight: 1.55, margin: "0 0 0.85rem", maxWidth: 640 }}>
                  <strong>Payment</strong> is recorded when Stripe completes. <strong>Processing</strong> means fulfillment is in
                  progress; <strong>Completed</strong> means your order is marked delivered in our system. Dates use your browser’s
                  timezone.
                </p>
                <div className="cp-table-wrap dash-client-table-wrap">
                  <table className="data-table dash-client-table">
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
                      {paginatedPurchases.map((p) => (
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
                          <td>
                            <span className={statusPillClass(p.orderStatus)}>{p.orderStatus ?? "Confirmed"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {purchases.length > PAGE_SIZE ? (
                  <div className="dash-client-pager">
                    <span className="muted dash-client-pager__meta">
                      Showing {rangeStart}–{rangeEnd} of {purchases.length} · Page {purchasePage} of {purchaseTotalPages}
                    </span>
                    <div className="dash-client-pager__btns">
                      <button
                        type="button"
                        className="dash-client-pager__btn"
                        disabled={purchasePage <= 1}
                        onClick={() => setPurchasePage((n) => Math.max(1, n - 1))}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="dash-client-pager__btn"
                        disabled={purchasePage >= purchaseTotalPages}
                        onClick={() => setPurchasePage((n) => Math.min(purchaseTotalPages, n + 1))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="muted dash-client-foot">{purchases.length} order{purchases.length === 1 ? "" : "s"}</p>
                )}
              </section>
            )}

            <p className="page-breadcrumb dash-client-back">
              <Link to="/">← Back to home</Link>
            </p>
          </div>
        </main>
        <SiteFooter />
      </div>
      <style>{`
        .dash-client-premium.page-space--tight {
          background: linear-gradient(185deg, rgba(232, 244, 255, 0.45) 0%, #ffffff 26%, #f6f8fc 100%);
        }
        .dash-client-wrap {
          max-width: 1040px;
          box-sizing: border-box;
          padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
        }
        .dash-client-hero {
          margin-bottom: 1.25rem;
          padding: 1.25rem 1.35rem;
          border-radius: 20px;
          border: 1px solid rgba(0, 122, 255, 0.12);
          background: linear-gradient(145deg, #ffffff 0%, #eef6ff 40%, #f8fafc 100%);
          box-shadow: 0 8px 36px rgba(0, 122, 255, 0.09), 0 2px 12px rgba(15, 23, 42, 0.04);
        }
        .dash-client-hero__crumb {
          margin: 0 0 0.65rem;
          font-size: 0.8125rem;
        }
        .dash-client-hero__title {
          margin: 0;
          font-size: clamp(1.55rem, 4vw, 1.95rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          background: linear-gradient(105deg, #0c1222 0%, #0066dd 44%, #1a9d40 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .dash-client-card {
          border-radius: 18px;
          border: 1px solid rgba(15, 23, 42, 0.07);
          background: linear-gradient(165deg, rgba(255, 255, 255, 0.98), rgba(248, 252, 255, 0.9));
          box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06);
          padding: 1.25rem 1.35rem;
        }
        .dash-client-card--narrow {
          max-width: 440px;
          margin-top: 0.5rem;
        }
        .dash-client-userbar {
          margin-top: 1rem;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.85rem;
        }
        .dash-client-userbar__text {
          color: var(--muted, #64748b);
          font-size: 0.95rem;
          flex: 1 1 auto;
          min-width: 12rem;
        }
        .dash-client-userbar__text strong {
          color: var(--text, #0f172a);
        }
        .dash-client-userbar__actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.65rem;
          margin-left: auto;
        }
        .dash-client-btn-ghost {
          padding: 0.45rem 0.95rem;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          font: inherit;
          font-size: 0.84rem;
          font-weight: 600;
          color: #0f172a;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .dash-client-btn-ghost:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(0, 122, 255, 0.1), rgba(52, 199, 89, 0.08));
          border-color: rgba(0, 122, 255, 0.28);
        }
        .dash-client-btn-ghost:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .dash-client-empty-hint {
          margin-top: 1rem;
          font-size: 0.9rem;
          max-width: 560px;
          line-height: 1.55;
        }
        .dash-client-purchases {
          margin-top: 1.5rem;
        }
        .dash-client-section-title {
          margin: 0 0 0.85rem;
          font-size: 1.12rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text, #0f172a);
        }
        .dash-client-table-wrap {
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          overflow: hidden;
          box-shadow: 0 4px 22px rgba(15, 23, 42, 0.06);
          background: #fff;
        }
        .dash-client-table thead th {
          background: linear-gradient(180deg, rgba(240, 249, 255, 0.9), rgba(255, 255, 255, 0.95));
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
        }
        .dash-client-status {
          display: inline-block;
          padding: 0.22rem 0.55rem;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .dash-client-status--done {
          background: rgba(52, 199, 89, 0.16);
          color: #0f5132;
          border: 1px solid rgba(52, 199, 89, 0.35);
        }
        .dash-client-status--open {
          background: rgba(245, 158, 11, 0.14);
          color: #92400e;
          border: 1px solid rgba(245, 158, 11, 0.32);
        }
        .dash-client-status--neutral {
          background: rgba(100, 116, 139, 0.1);
          color: #334155;
          border: 1px solid rgba(100, 116, 139, 0.2);
        }
        .dash-client-pager {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-top: 1rem;
          padding: 0.9rem 1rem;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.07);
          background: linear-gradient(165deg, rgba(255, 255, 255, 0.98), rgba(240, 249, 255, 0.45));
        }
        .dash-client-pager__meta {
          font-size: 0.88rem;
        }
        .dash-client-pager__btns {
          display: flex;
          gap: 0.5rem;
        }
        .dash-client-pager__btn {
          padding: 0.4rem 0.95rem;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          font: inherit;
          font-size: 0.84rem;
          font-weight: 600;
          color: #0f172a;
          cursor: pointer;
        }
        .dash-client-pager__btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(0, 122, 255, 0.1), rgba(52, 199, 89, 0.08));
          border-color: rgba(0, 122, 255, 0.25);
        }
        .dash-client-pager__btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .dash-client-foot {
          margin: 0.75rem 0 0;
          font-size: 0.85rem;
        }
        .dash-client-back {
          margin-top: 2rem;
        }
      `}</style>
    </>
  );
}
