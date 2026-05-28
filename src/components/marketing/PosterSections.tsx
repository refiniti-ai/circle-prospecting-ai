import { Link } from "react-router-dom";
import { MarketingBrandMark } from "./MarketingBrandMark";
import { contactEmail } from "../../lib/siteConfig";
import { formatCurrency, type CampaignTier } from "../../lib/pricing";
import { usePricingTiers } from "../../context/PricingTiersContext";
import { TargetingRadiusStrip } from "./TargetingRadiusStrip";
import {
  LISTING_SALES_PROCESS_STEPS,
  OPPORTUNITY_COUNT_DEMO,
  POSTER_DATA_PER_HOME_FALLBACK,
  POSTER_PILLARS,
  POSTER_SHEET_BENEFITS,
  POSTER_SHEET_PROMISE,
  POSTER_SHEET_QUOTE,
  POSTER_TESTIMONIALS_HEADLINE,
  PROCESS_FOOTER_CHANNELS,
  PROCESS_SUMMARY_POINTS,
  TESTIMONIALS,
  VOLUME_PACKAGE_LABELS,
} from "./marketingData";

function tierHomesLabel(t: CampaignTier): string {
  if (t.max === Number.POSITIVE_INFINITY) return `${t.min.toLocaleString()}+ homes`;
  return `${t.min.toLocaleString()}–${t.max.toLocaleString()} homes`;
}

function PosterPillarIcon({ kind }: { kind: "ai" | "live" | "leads" }) {
  const common = { width: 28, height: 28, viewBox: "0 0 24 24" as const, fill: "none" as const, stroke: "currentColor", strokeWidth: 1.65, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  switch (kind) {
    case "ai":
      return (
        <svg {...common}>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 8.5l1.2-2.2M14.8 15.7L16 17.5M7.2 8.3L8.5 6.5M15.5 12h2.2M6.3 12H4" opacity="0.45" />
        </svg>
      );
    case "live":
      return (
        <svg {...common}>
          <path d="M9 18v-7a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v7" />
          <path d="M5 18h14" />
          <path d="M10 8V6a2 2 0 1 1 4 0v2" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.2" />
        </svg>
      );
  }
}

function ProcessRibbonIcon({ id }: { id: "bolt" | "db" | "target" | "megaphone" }) {
  const a = { width: 22, height: 22, viewBox: "0 0 24 24" as const, fill: "none" as const, stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  switch (id) {
    case "bolt":
      return (
        <svg {...a}>
          <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
        </svg>
      );
    case "db":
      return (
        <svg {...a}>
          <ellipse cx="12" cy="6" rx="7" ry="3" />
          <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
          <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
        </svg>
      );
    case "target":
      return (
        <svg {...a}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg {...a}>
          <path d="M3 11v4a1 1 0 0 0 1 1h3l4 4V6l-4 4H4a1 1 0 0 0-1 1z" />
          <path d="M16 9a5 5 0 0 1 0 6" opacity="0.55" />
          <path d="M19 6a9 9 0 0 1 0 12" opacity="0.35" />
        </svg>
      );
  }
}

function ListingListingVisual() {
  return (
    <div className="rz-poster-listing-visual" aria-hidden>
      <div className="rz-poster-listing-visual-bg" />
      <span className="rz-poster-listing-ribbon">Just listed</span>
      <div className="rz-poster-listing-house">
        <svg viewBox="0 0 64 48" width="72" height="54" aria-hidden>
          <path
            fill="rgba(255,255,255,0.92)"
            d="M32 6L8 26h6v16h12V34h12v8h12V26h6L32 6z"
          />
          <rect x="26" y="30" width="12" height="12" rx="1" fill="rgba(15,23,42,0.25)" />
        </svg>
      </div>
      <p className="rz-poster-listing-caption">The moment a listing goes live — we activate.</p>
    </div>
  );
}

function RadarBackdrop() {
  return (
    <div className="rz-poster-radar" aria-hidden>
      <span className="rz-poster-radar-ring rz-poster-radar-ring--1" />
      <span className="rz-poster-radar-ring rz-poster-radar-ring--2" />
      <span className="rz-poster-radar-ring rz-poster-radar-ring--3" />
      <span className="rz-poster-radar-dot" />
    </div>
  );
}

/** Dark “agent sales sheet” pricing grid — mirrors print one-pager layout. */
export function PricingProductSheetSection({ showTestimonialStrip = true }: { showTestimonialStrip?: boolean }) {
  const { tiers, loading, error } = usePricingTiers();

  const columns = [
    {
      key: "live" as const,
      title: "Live callers",
      accent: "var(--rz-poster-live)",
      blurb: "U.S.-based reps for dialogue and qualification.",
    },
    {
      key: "ai" as const,
      title: "AI outreach",
      accent: "var(--rz-poster-ai)",
      blurb: "Scaled touches — calls, voicemail & SMS where configured.",
    },
    {
      key: "pro" as const,
      title: "Hybrid",
      accent: "var(--rz-poster-hybrid)",
      blurb: "AI coverage plus live follow-up in one lane.",
    },
    {
      key: "data" as const,
      title: "Data / export",
      accent: "var(--rz-poster-data)",
      blurb: "List intelligence for your own outreach (availability varies).",
    },
  ];

  const sheetTestimonials = TESTIMONIALS.slice(0, 3);

  return (
    <section className="rz-sales-poster rz-sales-poster--pricing" aria-labelledby="rz-poster-pricing-h">
      <div className="container rz-sales-poster-inner">
        <div className="rz-poster-brand-bar">
          <div className="rz-poster-brand-lockup">
            <MarketingBrandMark size={44} className="rz-poster-brand-mark" />
            <div>
              <p className="rz-poster-brand-name">Circle Prospecting AI</p>
              <p className="rz-poster-brand-tag">Automated prospecting for modern real estate</p>
            </div>
          </div>
          <p className="rz-poster-brand-promise">More conversations · More listings · Built for agents</p>
        </div>

        <header className="rz-poster-head">
          <div>
            <p className="rz-poster-eyebrow">Campaign pricing</p>
            <h2 id="rz-poster-pricing-h" className="rz-poster-title">
              Agent sales sheet
            </h2>
            <p className="rz-poster-sub">
              Per-homeowner pricing by volume band. Checkout is always the source of truth — this layout matches how teams print and share the
              offer.
            </p>
          </div>
          <div className="rz-poster-callout">
            <p className="rz-poster-callout-lead">More conversations. More listings.</p>
            <p className="rz-poster-callout-sub">Built for agents who want execution — not another DIY dialer.</p>
          </div>
        </header>

        <TargetingRadiusStrip />

        <ul className="rz-poster-pillars" aria-label="What powers the program">
          {POSTER_PILLARS.map((p) => (
            <li key={p.title} className="rz-poster-pillar">
              <span className={`rz-poster-pillar-icon rz-poster-pillar-icon--${p.icon}`}>
                <PosterPillarIcon kind={p.icon} />
              </span>
              <span className="rz-poster-pillar-title">{p.title}</span>
              <span className="rz-poster-pillar-d">{p.d}</span>
            </li>
          ))}
        </ul>

        <div className="rz-poster-pricing-grid">
          {columns.map((col) => (
            <div
              key={col.key}
              className="rz-poster-pricing-col"
              style={{ ["--rz-poster-accent" as string]: col.accent }}
            >
              <div className="rz-poster-pricing-col-head">
                <h3 className="rz-poster-pricing-col-title">{col.title}</h3>
                <p className="rz-poster-pricing-col-blurb">{col.blurb}</p>
              </div>
              <div className="rz-poster-mini-table-wrap">
                <table className="rz-poster-mini-table">
                  <thead>
                    <tr>
                      <th scope="col">Package</th>
                      <th scope="col">Homes</th>
                      <th scope="col" className="rz-poster-mini-th-num">
                        / home
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((tier, i) => {
                      const pkg = VOLUME_PACKAGE_LABELS[i] ?? `Band ${i + 1}`;
                      const homes = tierHomesLabel(tier);
                      const rate =
                        col.key === "data"
                          ? POSTER_DATA_PER_HOME_FALLBACK[Math.min(i, POSTER_DATA_PER_HOME_FALLBACK.length - 1)]!
                          : tier.rates[col.key as "ai" | "live" | "pro"];
                      return (
                        <tr key={`${col.key}-${tier.min}`}>
                          <td>{pkg}</td>
                          <td>{homes}</td>
                          <td className="rz-poster-mini-num">{formatCurrency(rate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <p className="rz-poster-data-note">
          Data / export column shows typical list-only planning rates — confirm lane availability and final price before purchase. Live, AI, and
          hybrid columns sync to your live tier grid when the pricing API is connected.
        </p>

        <div className="rz-poster-value-row" aria-label="Why agents use this">
          <div className="rz-poster-value-col rz-poster-value-col--list">
            <h3 className="rz-poster-value-h">Core benefits</h3>
            <ul className="rz-poster-value-checks">
              {POSTER_SHEET_BENEFITS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <blockquote className="rz-poster-value-quote">
            <p>{POSTER_SHEET_QUOTE.body}</p>
            <p className="rz-poster-value-quote-em">{POSTER_SHEET_QUOTE.emphasis}</p>
          </blockquote>
          <div className="rz-poster-value-col rz-poster-value-col--promise">
            <span className="rz-poster-promise-glyph" aria-hidden>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M4 19V5" strokeLinecap="round" />
                <path d="M4 15l4-3 3 3 5-6 4 4" strokeLinejoin="round" />
                <path d="M18 10v9H4" strokeLinejoin="round" />
              </svg>
            </span>
            <h3 className="rz-poster-value-h">Our promise</h3>
            <p className="rz-poster-value-promise-text">{POSTER_SHEET_PROMISE}</p>
          </div>
        </div>

        {showTestimonialStrip ? (
          <div className="rz-poster-testimonials">
            <h3 className="rz-poster-testimonials-h">{POSTER_TESTIMONIALS_HEADLINE}</h3>
            <div className="rz-poster-testimonial-cards">
              {sheetTestimonials.map((t) => (
                <figure key={t.name} className="rz-poster-t-card">
                  <div className="rz-poster-t-stars" aria-label="5 out of 5">
                    {"★★★★★"}
                  </div>
                  <blockquote className="rz-poster-t-quote">{t.quote}</blockquote>
                  <figcaption className="rz-poster-t-cap">
                    <span className="rz-poster-t-avatar" aria-hidden />
                    <span>
                      <span className="rz-poster-t-name">{t.name}</span>
                      <span className="rz-poster-t-role">{t.role}</span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ) : null}

        <footer className="rz-poster-footer-cta">
          <div className="rz-poster-footer-left">
            <span className="rz-poster-footer-icon" aria-hidden />
            <div>
              <p className="rz-poster-footer-tag">Ready to work a neighborhood?</p>
              <p className="rz-poster-footer-copy">Launch a campaign with clear per-home pricing — we handle the outreach motion.</p>
            </div>
          </div>
          <div className="rz-poster-footer-mid">
            <a href={`mailto:${contactEmail()}`} className="rz-poster-footer-link">
              {contactEmail()}
            </a>
          </div>
          <div className="rz-poster-footer-right">
            <Link to="/buy-leads" className="btn btn-primary rz-poster-footer-btn">
              Start prospecting your area
            </Link>
            <p className="rz-poster-footer-tagline">Built for agents · Backed by data · Powered by people</p>
          </div>
        </footer>

        {loading && !error ? (
          <p className="rz-poster-status" aria-live="polite">
            Refreshing live rates…
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** Horizontal “listing → neighborhood” process graphic for How it works. */
export function SalesProcessInfographicSection() {
  const ribbon = [
    { id: "bolt" as const, label: "Listing live" },
    { id: "db" as const, label: "We capture data" },
    { id: "target" as const, label: "We map the ring" },
    { id: "megaphone" as const, label: "We promote you" },
  ];

  return (
    <section className="rz-sales-poster rz-sales-poster--process" aria-labelledby="rz-poster-process-h">
      <div className="container rz-sales-poster-inner">
        <div className="rz-poster-process-brand">
          <MarketingBrandMark size={36} className="rz-poster-brand-mark rz-poster-brand-mark--sm" />
          <p className="rz-poster-process-brand-line">Circle Prospecting AI · Automated prospecting for modern business</p>
        </div>

        <header className="rz-poster-process-header">
          <p className="rz-poster-eyebrow">Listing-led motion</p>
          <h2 id="rz-poster-process-h" className="rz-poster-title">
            Circle prospecting sales process
          </h2>
          <p className="rz-poster-sub rz-poster-process-sub">
            From new listing to neighborhood opportunity — data, visibility, then coordinated outreach.
          </p>

          <div className="rz-poster-ribbon-flow" aria-hidden>
            <div className="rz-poster-ribbon-line" />
            <ol className="rz-poster-ribbon-nodes">
              {ribbon.map((r) => (
                <li key={r.id} className="rz-poster-ribbon-node">
                  <span className="rz-poster-ribbon-glyph">
                    <ProcessRibbonIcon id={r.id} />
                  </span>
                  <span className="rz-poster-ribbon-label">{r.label}</span>
                </li>
              ))}
            </ol>
          </div>
        </header>

        <div className="rz-poster-process-steps">
          {LISTING_SALES_PROCESS_STEPS.map((step) => (
            <article key={step.n} className="rz-poster-process-card">
              {step.n === "1" ? <ListingListingVisual /> : null}
              <p className="rz-poster-process-step-n">Step {step.n}</p>
              <h3 className="rz-poster-process-card-title">{step.title}</h3>
              <p className="rz-poster-process-card-lead">{step.lead}</p>
              {step.dataBoxes ? (
                <div className="rz-poster-data-pair">
                  {step.dataBoxes.map((box) => (
                    <div key={box.title} className="rz-poster-data-box">
                      <p className="rz-poster-data-box-title">{box.title}</p>
                      <ul>
                        {box.items.map((it) => (
                          <li key={it}>{it}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}
              {step.bullets ? (
                <ul className="rz-poster-process-bullets">
                  {step.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              {step.n === "3" ? (
                <div className="rz-poster-step3-visual">
                  <RadarBackdrop />
                  <div className="rz-poster-opp-table-wrap">
                    <p className="rz-poster-opp-caption">Your neighborhood opportunity overview (sample)</p>
                    <table className="rz-poster-opp-table">
                      <tbody>
                        {OPPORTUNITY_COUNT_DEMO.map((row) => (
                          <tr key={row.label}>
                            <th scope="row">{row.label}</th>
                            <td>{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
              {step.n === "4" ? (
                <ul className="rz-poster-promo-check">
                  {step.promoItems?.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>

        <ul className="rz-poster-process-summary" aria-label="Why teams use this flow">
          {PROCESS_SUMMARY_POINTS.map((p) => (
            <li key={p.title} className="rz-poster-process-summary-item">
              <span className="rz-poster-summary-title">{p.title}</span>
              <span className="rz-poster-summary-d">{p.d}</span>
            </li>
          ))}
        </ul>

        <div className="rz-poster-process-bottom">
          <div className="rz-poster-process-bottom-left">
            <p className="rz-poster-bottom-kicker">One listing · Unlimited potential</p>
            <p className="rz-poster-bottom-copy">
              Turn a fresh listing into a structured neighborhood play — counts first, then coordinated outreach so homeowners hear your story.
            </p>
          </div>
          <div className="rz-poster-process-bottom-right">
            <p className="rz-poster-next-label">Next step → we contact the neighborhood for you</p>
            <p className="rz-poster-channels">{PROCESS_FOOTER_CHANNELS}</p>
            <Link to="/buy-leads" className="btn btn-primary rz-poster-process-cta">
              Start prospecting your area
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
