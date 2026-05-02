import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { claimLeadSession, downloadMyLeadsCsv, fetchMyLeads, type PurchasedLead } from "../lib/leadsApi";

const TOKEN_KEY = "cpai_dash_jwt";

export function DashboardLeads() {
  const [sp, setSp] = useSearchParams();
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [leads, setLeads] = useState<PurchasedLead[]>([]);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);

  useEffect(() => {
    const sessionId = sp.get("session_id");
    const shouldClaim = sp.get("claim") === "1";
    if (shouldClaim && sessionId) {
      setClaimBusy(true);
      setErr(null);
      claimLeadSession(sessionId)
        .then((r) => {
          localStorage.setItem(TOKEN_KEY, r.token);
          setToken(r.token);
          setEmail(r.email);
          setSp(new URLSearchParams());
        })
        .catch((e) => setErr(e instanceof Error ? e.message : "Could not claim session"))
        .finally(() => setClaimBusy(false));
    }
  }, [sp, setSp]);

  useEffect(() => {
    if (!token) {
      setLeads([]);
      return;
    }
    let ok = true;
    fetchMyLeads(token)
      .then((r) => {
        if (ok) {
          setLeads(r.leads);
          setEmail(r.email);
        }
      })
      .catch(() => {
        if (ok) {
          setErr("Session expired — complete a lead purchase to sign in again.");
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
  }

  return (
    <>
      <SeoHead title="My leads | Circle Prospecting AI" description="Purchased real estate leads" path="/dashboard" noindex />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space page-space--tight rzInterior">
          <div className="container" style={{ maxWidth: 1000 }}>
            <header className="page-hero">
              <p className="page-breadcrumb">
                <Link to="/">Home</Link> / Client dashboard
              </p>
              <h1 className="page-h1">My lead delivery</h1>
              <p className="page-lead" style={{ maxWidth: 720 }}>
                After a successful Stripe test payment, you are redirected here to claim your session. We assign the first available rows
                from the admin inventory to your account.
              </p>
            </header>

            {claimBusy && <p className="cp-loading-line">Confirming your payment…</p>}
            {err && <p className="cp-alert cp-alert--error">{err}</p>}

            {!token && !claimBusy && (
              <div className="section-surface" style={{ maxWidth: 420, marginTop: "0.5rem" }}>
                <p className="page-lead" style={{ marginBottom: "1rem" }}>
                  Purchase a lead pack to receive a session link and access your delivery here.
                </p>
                <Link to="/buy-leads" className="btn btn-primary">
                  Buy a lead pack
                </Link>
              </div>
            )}

            {token && email && (
              <div className="section-surface" style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ color: "var(--muted)" }}>
                  Signed in as <strong style={{ color: "var(--text)" }}>{email}</strong>
                </span>
                <button type="button" className="link-btn" onClick={logout}>
                  Sign out
                </button>
                <button type="button" className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={() => downloadMyLeadsCsv(token)}>
                  Download CSV
                </button>
              </div>
            )}

            {token && leads.length === 0 && !err && !claimBusy && (
              <p className="cp-alert cp-alert--info" style={{ marginTop: "1rem" }}>
                No leads yet — ask an admin to upload inventory.
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
