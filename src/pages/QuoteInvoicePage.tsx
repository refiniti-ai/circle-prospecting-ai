import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import { SeoHead } from "../components/SeoHead";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { formatMoneyUsd } from "../lib/leadPricing";
import { fetchInvoiceDocument, fetchQuoteDocument, type CampaignDocument } from "../lib/documentsApi";
import "./quote-invoice.css";

type Mode = "quote" | "invoice";

function useDocumentMode(pathname: string): Mode {
  return pathname.startsWith("/invoice") ? "invoice" : "quote";
}

function formatIssued(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function QuoteInvoicePage() {
  const { pathname } = useLocation();
  const mode = useDocumentMode(pathname);
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id");
  const search = useLocation().search;

  const [doc, setDoc] = useState<CampaignDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const title = mode === "invoice" ? "Invoice" : "Quote";

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        if (mode === "invoice") {
          if (!sessionId) {
            setError("Missing session_id — open this page from your payment confirmation link.");
            setDoc(null);
            return;
          }
          setDoc(await fetchInvoiceDocument(sessionId, ac.signal));
        } else {
          if (!search || search === "?") {
            setError("Add custom fields to the URL (order, mls, homes, serviceLine, leadTier, campaign, etc.).");
            setDoc(null);
            return;
          }
          setDoc(await fetchQuoteDocument(search, ac.signal));
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Could not load document.");
        setDoc(null);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [mode, sessionId, search]);

  const lineRows = useMemo(() => {
    if (!doc) return [];
    return [
      ...doc.summaryLines,
      { label: "Quantity", value: `${doc.homes.toLocaleString()} homeowners` },
      { label: "Unit price", value: formatMoneyUsd(doc.perHomeUsd) },
    ];
  }, [doc]);

  return (
    <>
      <SeoHead
        title={`${title} | Circle Prospecting AI`}
        description={`${title} for your circle prospecting campaign.`}
        path={mode === "invoice" ? "/invoice" : "/quote"}
        noindex
      />
      <div className="app-shell rz-shell rz-app quote-invoice-page">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space page-space--tight rzInterior">
          <div className="container">
            <p className="page-breadcrumb qi-print-hide">
              <Link to="/">Home</Link> / {title}
            </p>

            {loading ? (
              <div className="page-center-card">
                <p className="cp-loading-line">Building {title.toLowerCase()}…</p>
              </div>
            ) : error ? (
              <div className="cp-alert cp-alert--warn" role="alert">
                <p style={{ margin: 0 }}>{error}</p>
                <p className="muted" style={{ margin: "0.75rem 0 0", fontSize: "0.88rem" }}>
                  Example quote:{" "}
                  <Link to="/quote?order=948&radius=h1&homes=739&serviceLine=live_callers&leadTier=growth&campaign=just_listed">
                    /quote?order=948&radius=h1&homes=739…
                  </Link>
                </p>
              </div>
            ) : doc ? (
              <article className="qi-sheet">
                <header className="qi-head">
                  <div className="qi-brand">
                    <BrandLogo variant="header" />
                    <p className="qi-doc-type">{mode === "invoice" ? "Invoice" : "Quote"}</p>
                    <p className="qi-doc-meta">
                      <strong>{doc.documentNumber}</strong>
                      <br />
                      Issued {formatIssued(doc.issuedAt)}
                    </p>
                    <span className={`qi-status${doc.kind === "invoice" && doc.paymentStatus === "paid" ? " qi-status--paid" : ""}`}>
                      {doc.statusLabel}
                    </span>
                  </div>
                </header>

                <div className="qi-grid-2">
                  <div className="qi-block">
                    <h3>Bill to</h3>
                    <p>
                      <strong>{doc.billTo.name}</strong>
                    </p>
                    {doc.billTo.email ? <p>{doc.billTo.email}</p> : null}
                    {doc.billTo.phone ? <p>{doc.billTo.phone}</p> : null}
                    {doc.billTo.brokerage ? <p>{doc.billTo.brokerage}</p> : null}
                  </div>
                  <div className="qi-block">
                    <h3>Campaign summary</h3>
                    <p>
                      <strong>{doc.campaignType}</strong>
                    </p>
                    <p>Target: {doc.targetRing}</p>
                    <p>Service: {doc.serviceLine}</p>
                    <p>Plan: {doc.planBand}</p>
                  </div>
                </div>

                {doc.listing ? (
                  <div className="qi-listing-card">
                    <span className="qi-listing-mls">{doc.listing.mls}</span>
                    <p style={{ margin: "0.35rem 0 0", fontWeight: 700 }}>
                      {doc.listing.address}, {doc.listing.cityStateZip}
                    </p>
                    <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.88rem" }}>
                      {doc.listing.county} · List {doc.listing.listPrice}
                    </p>
                  </div>
                ) : null}

                <table className="qi-table">
                  <thead>
                    <tr>
                      <th scope="col">Description</th>
                      <th scope="col">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineRows.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                    <tr className="qi-total-row">
                      <td>Total due</td>
                      <td className="qi-total-amount">{formatMoneyUsd(doc.totalUsd)}</td>
                    </tr>
                  </tbody>
                </table>

                {!doc.tierBandOk && doc.kind === "quote" ? (
                  <p className="cp-alert cp-alert--warn" role="status" style={{ fontSize: "0.88rem" }}>
                    Home count does not match the selected plan band — adjust homes or plan before checkout.
                  </p>
                ) : null}

                {doc.customFields.length > 0 ? (
                  <div className="qi-custom">
                    <h3>Custom fields</h3>
                    <table className="qi-table">
                      <tbody>
                        {doc.customFields.map((row) => (
                          <tr key={`${row.label}-${row.value}`}>
                            <td>{row.label}</td>
                            <td>{row.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                <div className="qi-actions qi-print-hide">
                  {doc.kind === "quote" && doc.checkoutUrl ? (
                    <a href={doc.checkoutUrl} className="btn btn-primary">
                      Continue to checkout
                    </a>
                  ) : null}
                  {doc.buyLeadsUrl && doc.kind === "quote" ? (
                    <a href={doc.buyLeadsUrl} className="btn btn-ghost">
                      Open buy leads
                    </a>
                  ) : null}
                  <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
                    Print / save PDF
                  </button>
                  {doc.kind === "invoice" ? (
                    <Link to="/dashboard" className="btn btn-ghost">
                      Dashboard
                    </Link>
                  ) : null}
                </div>
              </article>
            ) : null}
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
