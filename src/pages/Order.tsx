import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { ListingMap } from "../components/ListingMap";
import { getLocalDemoOrder, type ListingPayload, type RadiusId } from "../lib/listingData";
import { usePricingTiers } from "../context/PricingTiersContext";
import {
  formatCurrency,
  getTierLabelWithTiers,
  getUnitPriceWithTiers,
  planDescription,
  planLabel,
  type PlanId,
} from "../lib/pricing";
import { fetchOrderById, startCheckout } from "../lib/apiClient";

const RADIUS_ORDER: RadiusId[] = ["subdivision", "q1", "h1", "m1", "zip"];
const LISTING_PREVIEW =
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=86";

type LoadState =
  | { status: "loading" }
  | { status: "error"; code: "not_found" | "other"; message: string }
  | { status: "ready"; listing: ListingPayload; offline: boolean };

export function Order() {
  const { tiers: pricingTiers } = usePricingTiers();
  const { id } = useParams();
  const [sp] = useSearchParams();
  const canceled = sp.get("canceled");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [radius, setRadius] = useState<RadiusId>("h1");
  const [plan, setPlan] = useState<PlanId>("pro");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [unconfigured, setUnconfigured] = useState<{
    message: string;
    amountCents: number;
  } | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      if (!id) {
        setState({ status: "error", code: "other", message: "Missing order id" });
        return;
      }
      setState({ status: "loading" });
      setUnconfigured(null);
      setCheckoutError(null);
      try {
        const listing = await fetchOrderById(id, ac.signal);
        setState({ status: "ready", listing, offline: false });
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        if (e instanceof Error && e.message === "not_found") {
          setState({ status: "error", code: "not_found", message: "We could not find that order." });
          return;
        }
        const demo = getLocalDemoOrder(id);
        if (demo) {
          setState({ status: "ready", listing: demo, offline: true });
        } else {
          setState({
            status: "error",
            code: "other",
            message: "Could not load this order. Check your connection and try again.",
          });
        }
      }
    })();
    return () => ac.abort();
  }, [id]);

  const listing = state.status === "ready" ? state.listing : null;
  const homeCount = listing ? listing.radii[radius].count : 0;
  const unit = getUnitPriceWithTiers(pricingTiers, homeCount, plan);
  const total = homeCount * unit;
  const tier = getTierLabelWithTiers(pricingTiers, homeCount);

  async function onCheckout() {
    if (!id || !listing) return;
    setCheckoutBusy(true);
    setCheckoutError(null);
    setUnconfigured(null);
    try {
      const r = await startCheckout({ orderId: String(listing.id), plan, radius });
      if (r.ok) {
        window.location.assign(r.url);
        return;
      }
      if (r.unconfigured) {
        setUnconfigured({ message: r.message, amountCents: r.amountCents });
      }
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setCheckoutBusy(false);
    }
  }

  if (state.status === "loading") {
    return (
      <div className="app-shell rz-shell rz-app">
        <SeoHead title="Loading order | Circle Prospecting AI" description="Loading your campaign order." noindex />
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space rzInterior">
          <div className="container page-narrow">
            <div className="page-center-card" style={{ display: "flex", justifyContent: "center" }}>
              <p className="cp-loading-line">Loading order…</p>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (state.status === "error" && state.code === "not_found") {
    return (
      <div className="app-shell rz-shell rz-app">
        <SeoHead title="Order not found | Circle Prospecting AI" description="We could not load this order." path="/order" noindex />
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space rzInterior">
          <div className="container page-narrow">
            <div className="page-center-card">
              <h1 className="page-h1">Order not found</h1>
              <p className="page-lead" style={{ maxWidth: "100%" }}>
                Try the demo:{" "}
                <Link to="/order/948" style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                  /order/948
                </Link>
              </p>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="app-shell rz-shell rz-app">
        <SeoHead title="Error | Circle Prospecting AI" description="…" noindex />
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space rzInterior">
          <div className="container page-narrow">
            <div className="page-center-card">
              <h1 className="page-h1">Something went wrong</h1>
              <p className="cp-alert cp-alert--error" style={{ textAlign: "left" }}>
                {state.message}
              </p>
              <p style={{ marginTop: "1.25rem" }}>
                <Link to="/" className="btn btn-primary">
                  Home
                </Link>
              </p>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const { listing: l, offline } = state;
  if (!l) return null;
  const savings = Math.max(0, (l.radii[radius].count * 0.85) - total);

  return (
    <>
      <SeoHead
        title={`Order #${l.internalId} | Circle Prospecting AI`}
        description="Select your campaign radius, plan, and review pricing before launch."
        path={`/order/${l.id}`}
        noindex
      />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space page-space--tight rzInterior">
          <div className="container order-premium-wrap">
            {offline && (
              <p className="cp-alert cp-alert--warn" role="status" style={{ marginBottom: "1rem" }}>
                <strong>Offline mode:</strong> The API is unreachable — showing the built-in demo for this id. In production, ensure the API
                is running and <code className="cp-kbd">npm run dev</code> includes the server, or set <code className="cp-kbd">ORDER_UPSTREAM_URL</code>.
              </p>
            )}
            {canceled && <p className="cp-alert cp-alert--info" style={{ marginBottom: "1rem" }}>Checkout was canceled. You can adjust options and try again.</p>}

            <div className="order-stepper">
              {[
                "Select Targeting",
                "Choose Plan",
                "Review & Price",
                "Checkout",
              ].map((step, idx) => (
                <div key={step} className={`order-step ${idx <= 2 ? "is-active" : ""}`}>
                  <span className="order-step-n">{idx + 1}</span>
                  <span className="order-step-t">{step}</span>
                </div>
              ))}
            </div>

            <header className="page-hero" style={{ marginBottom: "1.1rem" }}>
              <p className="page-breadcrumb">
                <Link to="/">Home</Link> / Order
              </p>
              <h1 className="page-h1">Launch your listing campaign</h1>
              <p className="page-lead" style={{ maxWidth: 640 }}>
                Target nearby homeowners and generate more leads for this listing.
              </p>
            </header>

            <section className="section-surface order-listing-card">
              <div className="order-listing-media">
                <img src={LISTING_PREVIEW} alt="Listing preview" />
              </div>
              <div>
                <div className="order-listing-head">
                  <h2 style={{ margin: 0, fontSize: "1.5rem" }}>{l.address}</h2>
                  <span className="order-id-chip">Internal ID: {l.internalId}</span>
                </div>
                <p className="muted" style={{ marginTop: "0.4rem" }}>{l.cityStateZip} • {l.county}</p>
                <div className="order-listing-meta">
                  <div><span>List price</span><strong>{l.listPrice}</strong></div>
                  <div><span>MLS #</span><strong>{l.mls}</strong></div>
                  <div><span>Created</span><strong>{l.createdAt ? new Date(l.createdAt).toLocaleString() : "—"}</strong></div>
                  <div><span>Agent</span><strong>{l.agentName}</strong></div>
                  <div><span>Email</span><strong>{l.email}</strong></div>
                  <div><span>Phone</span><strong>{l.phone || "—"}</strong></div>
                </div>
              </div>
            </section>

            <section className="section-surface" style={{ marginTop: "1rem" }}>
              <h2 className="premium-h2" style={{ fontSize: "1.05rem" }}>Step 1: Select your target area</h2>
              <p className="muted" style={{ marginBottom: "0.9rem" }}>Choose how far from this listing you want to target homeowners.</p>
              <div className="order-radius-grid">
                {RADIUS_ORDER.map((r) => {
                  const { label, count } = l.radii[r];
                  const active = r === radius;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRadius(r)}
                      className={`order-pick-card ${active ? "is-active" : ""}`}
                    >
                      <span className="order-pick-l">{label}</span>
                      <span className="order-pick-v">{count.toLocaleString()}</span>
                      <span className="order-pick-s">homes</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="section-surface" style={{ marginTop: "1rem" }}>
              <h2 className="premium-h2" style={{ fontSize: "1.05rem" }}>Step 2: Choose your plan</h2>
              <div className="order-plan-grid">
                {(["ai", "live", "pro"] as const).map((p) => {
                  const active = p === plan;
                  const rate = getUnitPriceWithTiers(pricingTiers, homeCount, p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlan(p)}
                      className={`order-plan-card ${active ? "is-active" : ""}`}
                    >
                      <span className="order-plan-name">{planLabel(p)} Plan</span>
                      <span className="order-plan-rate">{formatCurrency(rate)}</span>
                      <span className="order-plan-unit">per home</span>
                      <span className="order-plan-desc">{planDescription(p)}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="section-surface order-summary" style={{ marginTop: "1rem" }}>
              <h2 className="premium-h2" style={{ fontSize: "1.05rem", marginBottom: "0.8rem" }}>Order summary</h2>
              <div className="order-summary-grid">
                <div><span>Target area</span><strong>{l.radii[radius].label}</strong></div>
                <div><span>Homes</span><strong>{homeCount.toLocaleString()}</strong></div>
                <div><span>Plan selected</span><strong>{planLabel(plan)}</strong></div>
                <div><span>Rate / home</span><strong>{formatCurrency(unit)}</strong></div>
                <div><span>Tier</span><strong>{tier}</strong></div>
                <div><span>Total</span><strong className="gradient-text">{formatCurrency(total)}</strong></div>
              </div>
              <p className="muted" style={{ marginTop: "0.8rem", fontSize: "0.9rem" }}>
                Example from your requirement: 739 × {formatCurrency(getUnitPriceWithTiers(pricingTiers, 739, "pro"))} ={" "}
                {formatCurrency(739 * getUnitPriceWithTiers(pricingTiers, 739, "pro"))}
              </p>
              <p className="order-saving">You’re saving {formatCurrency(savings)} with tier pricing.</p>
            </section>

            <section className="section-surface" style={{ marginTop: "1rem" }}>
              <h3 style={{ marginTop: 0, marginBottom: "0.7rem" }}>What happens next?</h3>
              <div className="order-next-grid">
                <div>1. We target {homeCount.toLocaleString()} homeowners in your radius</div>
                <div>2. AI + live outreach starts for your listing</div>
                <div>3. Track responses in your dashboard</div>
                <div>4. Export and close more deals</div>
              </div>
              {unconfigured && (
                <p className="cp-alert cp-alert--info" style={{ marginTop: "0.85rem" }}>
                  {unconfigured.message} Amount: {(unconfigured.amountCents / 100).toFixed(2)} USD (set <code className="cp-kbd">STRIPE_SECRET_KEY</code> on
                  the API to enable live checkout).
                </p>
              )}
              {checkoutError && <p className="cp-alert cp-alert--error" style={{ marginTop: "0.85rem" }}>{checkoutError}</p>}
              <div className="order-cta-row">
                <div className="order-cta-meta">Secure checkout • Cancel anytime</div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ minWidth: 260 }}
                  disabled={homeCount <= 0 || checkoutBusy}
                  onClick={onCheckout}
                >
                  {checkoutBusy ? "Redirecting…" : "Continue to checkout"}
                </button>
              </div>
            </section>

            <div style={{ marginTop: "1rem" }}>
              <ListingMap lat={l.lat} lng={l.lng} radius={radius} />
            </div>
            <style>{`
              .order-premium-wrap { max-width: 1180px; }
              .order-stepper {
                display: grid;
                grid-template-columns: repeat(4,minmax(0,1fr));
                gap: 0.6rem;
                margin-bottom: 1rem;
              }
              .order-step {
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 0.55rem 0.7rem;
                background: #fff;
                display: flex;
                align-items: center;
                gap: 0.45rem;
              }
              .order-step.is-active { border-color: rgba(0,122,255,0.45); box-shadow: 0 0 0 1px rgba(0,122,255,0.14) inset; }
              .order-step-n {
                width: 22px; height: 22px; border-radius: 50%;
                display: inline-flex; align-items: center; justify-content: center;
                font-size: 0.78rem; font-weight: 700;
                background: rgba(0,122,255,0.12); color: #005ecf;
              }
              .order-step-t { font-size: 0.8rem; color: var(--muted); font-weight: 600; }
              .order-listing-card {
                display: grid;
                grid-template-columns: 260px 1fr;
                gap: 1rem;
                align-items: center;
              }
              .order-listing-media img {
                width: 100%; height: 170px; object-fit: cover;
                border-radius: 14px; border: 1px solid var(--border);
              }
              .order-listing-head { display: flex; justify-content: space-between; gap: 0.75rem; align-items: start; }
              .order-id-chip {
                border: 1px solid var(--border);
                background: rgba(0, 122, 255, 0.08);
                color: #145289;
                border-radius: 999px;
                padding: 0.35rem 0.65rem;
                font-size: 0.78rem;
                white-space: nowrap;
              }
              .order-listing-meta {
                margin-top: 0.85rem;
                display: grid;
                grid-template-columns: repeat(3, minmax(0,1fr));
                gap: 0.65rem;
              }
              .order-listing-meta div span { display:block; color: var(--muted); font-size: 0.75rem; }
              .order-listing-meta div strong { display:block; font-size: 0.92rem; margin-top: 0.15rem; }
              .order-radius-grid {
                display: grid;
                grid-template-columns: repeat(5,minmax(0,1fr));
                gap: 0.65rem;
              }
              .order-pick-card {
                border: 1px solid var(--border);
                background: #fff;
                border-radius: 14px;
                padding: 0.9rem 0.7rem;
                color: var(--text);
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.2rem;
              }
              .order-pick-card.is-active {
                border-color: rgba(0,122,255,0.55);
                box-shadow: 0 0 0 1px rgba(0,122,255,0.12) inset, 0 10px 35px rgba(0,122,255,0.12);
              }
              .order-pick-l { font-size: 0.82rem; color: var(--muted); }
              .order-pick-v { font-size: 1.7rem; font-weight: 800; line-height: 1.05; }
              .order-pick-s { font-size: 0.8rem; color: var(--muted); }
              .order-plan-grid {
                display: grid;
                grid-template-columns: repeat(3,minmax(0,1fr));
                gap: 0.8rem;
              }
              .order-plan-card {
                border: 1px solid var(--border);
                background: #fff;
                border-radius: 14px;
                padding: 1rem;
                text-align: left;
                display: grid;
                gap: 0.18rem;
                cursor: pointer;
              }
              .order-plan-card.is-active {
                border-color: rgba(0,122,255,0.55);
                box-shadow: 0 0 0 1px rgba(0,122,255,0.12) inset, 0 12px 35px rgba(0,122,255,0.12);
              }
              .order-plan-name { font-size: 1.12rem; font-weight: 700; }
              .order-plan-rate { font-size: 2rem; font-weight: 800; line-height: 1.05; margin-top: 0.15rem; }
              .order-plan-unit { font-size: 0.82rem; color: var(--muted); margin-bottom: 0.35rem; }
              .order-plan-desc { font-size: 0.86rem; color: var(--muted); line-height: 1.5; }
              .order-summary-grid {
                display: grid;
                grid-template-columns: repeat(3,minmax(0,1fr));
                gap: 0.65rem;
              }
              .order-summary-grid div {
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 0.65rem 0.75rem;
                background: #fff;
                display: grid;
                gap: 0.2rem;
              }
              .order-summary-grid span { color: var(--muted); font-size: 0.78rem; }
              .order-summary-grid strong { font-size: 0.96rem; }
              .order-saving {
                margin-top: 0.8rem;
                background: rgba(162,215,41,0.14);
                border: 1px solid rgba(143,184,32,0.32);
                color: #325500;
                border-radius: 10px;
                padding: 0.55rem 0.7rem;
                font-size: 0.88rem;
              }
              .order-next-grid {
                display: grid;
                grid-template-columns: repeat(4,minmax(0,1fr));
                gap: 0.6rem;
              }
              .order-next-grid div {
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 0.65rem 0.7rem;
                background: #fff;
                color: var(--muted);
                font-size: 0.84rem;
                line-height: 1.5;
              }
              .order-cta-row {
                margin-top: 0.9rem;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.9rem;
                flex-wrap: wrap;
              }
              .order-cta-meta { color: var(--muted); font-size: 0.85rem; }
              @media (max-width: 1080px) {
                .order-radius-grid { grid-template-columns: repeat(3,minmax(0,1fr)); }
                .order-plan-grid { grid-template-columns: 1fr; }
                .order-summary-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
                .order-next-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
              }
              @media (max-width: 860px) {
                .order-stepper { grid-template-columns: repeat(2,minmax(0,1fr)); }
                .order-listing-card { grid-template-columns: 1fr; }
                .order-listing-media img { height: 210px; }
                .order-listing-meta { grid-template-columns: repeat(2,minmax(0,1fr)); }
              }
              @media (max-width: 560px) {
                .order-radius-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
                .order-summary-grid { grid-template-columns: 1fr; }
                .order-next-grid { grid-template-columns: 1fr; }
                .order-listing-meta { grid-template-columns: 1fr; }
                .order-stepper { grid-template-columns: 1fr; }
              }
            `}</style>
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
