import {
  useCallback,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { useScrollReveal } from "../../hooks/useScrollReveal";
import { contactEmail } from "../../lib/siteConfig";
import { ListingMap } from "../ListingMap";
import { SAMPLE_LISTING } from "../../lib/listingData";
import { StatBarGlyph, IconCheck, IconDoc, PlayIcon } from "./icons";
import { usePricingTiers } from "../../context/PricingTiersContext";
import { formatCurrency, lowestPerHomeRate, tiersToTableRows } from "../../lib/pricing";
import { RzPostHeroPhoneMarquee } from "./RzPostHeroPhone";
import {
  MARKETING_IMG,
  STEPS,
  STAT_BAR,
  SOCIAL_PROOF,
  TRUST_BRANDS,
  INTEGRATION_SLOTS,
  FAQ_ITEMS,
  COMPARE_WITHOUT,
  COMPARE_WITH,
  TESTIMONIALS,
  TESTIMONIAL_SHOWCASE_METRICS,
  BLOG_CARDS,
  REZ_PROOF_LINE,
  REZ_SHOWCASE_LEADS,
  REZ_SHOWCASE_CIRCLE,
} from "./marketingData";

/** Stagger delay index for `--rz-stagger` (used with `.rz-stagger-child`). */
function stag(n: number): CSSProperties {
  return { ["--rz-stagger" as string]: String(n) } as CSSProperties;
}

type ScrollRevealBindings = Pick<ReturnType<typeof useScrollReveal>, "sentinelRef" | "revealClassName">;

/* —— Homepage: Rezora-style anatomy (distinct from legacy subpages) —— */

function RzBrowserShell({ children, variant = "default" }: { children: ReactNode; variant?: "default" | "hero" }) {
  return (
    <div className={`rz-browser-shell${variant === "hero" ? " rz-browser-shell--hero" : ""}`} role="presentation">
      <div className="rz-browser-bar" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="rz-browser-viewport">{children}</div>
    </div>
  );
}

/** Minimal homepage CTAs — primary + optional pricing link only. */
export function RzPrimaryCtas({ showPricingLink = true, compact = false }: { showPricingLink?: boolean; compact?: boolean }) {
  return (
    <div className={`rz-cta-triple rz-cta-triple--minimal${compact ? " rz-cta-triple--compact" : ""}`}>
      <Link to="/buy-leads" className="btn btn-primary rz-btn-cta-lg">
        Get started
        <span aria-hidden>→</span>
      </Link>
      {showPricingLink ? (
        <Link to="/campaign-pricing" className="btn btn-link-rz">
          View pricing
        </Link>
      ) : null}
    </div>
  );
}

export function RzMidCtaBand({ id }: { id?: string }) {
  const { sentinelRef, revealClassName } = useScrollReveal();
  return (
    <section id={id} className={`rz-mid-cta-band rz-mid-cta-band--dark ${revealClassName}`} aria-label="Sign up">
      <div ref={sentinelRef} className="rz-reveal-sentinel" aria-hidden />
      <div className="container">
        <div className={`rz-mid-cta-glass rz-stagger-child`} style={stag(0)}>
          <h2 className="rz-mid-cta-h">Start in minutes—not months.</h2>
          <p className="rz-mid-cta-lead">
            Browse lead packs and checkout when ready—pricing stays on the sheet, delivery stays in one dashboard.
          </p>
          <RzPrimaryCtas />
        </div>
      </div>
    </section>
  );
}

/** Dashboard + lightweight chat preview — clarity over jargon. */
export function RzProductUiSection() {
  const { sentinelRef, revealClassName } = useScrollReveal();
  return (
    <section className={`rz-product-ui ${revealClassName}`} aria-labelledby="rz-product-ui-h">
      <div ref={sentinelRef} className="rz-reveal-sentinel" aria-hidden />
      <div className="container">
        <div className="rz-product-ui-head rz-stagger-child" style={stag(0)}>
          <p className="rz-product-ui-kicker">Product</p>
          <h2 className="rz-product-ui-title" id="rz-product-ui-h">
            Your dashboard. Simple status. Human help when you need it.
          </h2>
          <p className="rz-product-ui-lead">
            Clients see what they bought, what’s ready to download, and quick answers—without wading through settings.
          </p>
        </div>
        <div className="rz-product-ui-grid">
          <div className="rz-product-dash rz-glass-panel rz-stagger-child" style={stag(1)}>
            <div className="rz-pui-dash-top">
              <span className="rz-pui-dot" />
              <span className="rz-pui-title">Deliveries</span>
            </div>
            <div className="rz-pui-stats">
              <div className="rz-pui-stat">
                <span className="rz-pui-stat-n">12</span>
                <span className="rz-pui-stat-l">Ready files</span>
              </div>
              <div className="rz-pui-stat">
                <span className="rz-pui-stat-n">3</span>
                <span className="rz-pui-stat-l">In progress</span>
              </div>
              <div className="rz-pui-stat">
                <span className="rz-pui-stat-n">$0</span>
                <span className="rz-pui-stat-l">Open balance</span>
              </div>
            </div>
            <div className="rz-pui-table">
              <div className="rz-pui-row rz-pui-row-h">
                <span>Order</span>
                <span>Area</span>
                <span>Status</span>
              </div>
              <div className="rz-pui-row">
                <span>#1042</span>
                <span>Half-mile ring</span>
                <span className="rz-pui-pill rz-pui-pill-live">Delivered</span>
              </div>
              <div className="rz-pui-row">
                <span>#1041</span>
                <span>Lead pack · 250</span>
                <span className="rz-pui-pill">Processing</span>
              </div>
            </div>
          </div>
          <aside className="rz-product-chat rz-glass-panel rz-stagger-child" style={stag(2)} aria-label="Sample chat">
            <p className="rz-pui-chat-kicker">In-app guides</p>
            <div className="rz-pui-msg rz-pui-msg-bot">
              <strong>Circle AI</strong>
              <p>Want a tighter ring? Drag the slider and we&apos;ll refresh the count before you pay.</p>
            </div>
            <div className="rz-pui-msg rz-pui-msg-user">
              <p>Show me the CSV layout.</p>
            </div>
            <div className="rz-pui-msg rz-pui-msg-bot">
              <strong>Circle AI</strong>
              <p>Here&apos;s your column map—addresses first, flags last. Download anytime from Deliveries.</p>
            </div>
          </aside>
        </div>
        <div className="rz-product-ui-cta rz-stagger-child" style={stag(3)}>
          <RzPrimaryCtas />
        </div>
      </div>
    </section>
  );
}

export function RzEditorialHero() {
  return (
    <section className="rz-hero-v2 rz-hero-v2--stacked rz-reveal-static" aria-label="Introduction">
      <div className="rz-hero-v2-mesh" aria-hidden />
      <div className="container rz-hero-v2-stack">
        <div className="rz-hero-v2-copy rz-hero-v2-copy--center">
          <p className="rz-hero-v2-tag">Leads + neighborhood outreach</p>
          <h1 className="rz-hero-v2-headline">
            Buy leads and run <span className="gradient-text">neighborhood campaigns</span> from every new listing.
          </h1>
          <p className="rz-hero-v2-sub">
            Sell lists, take payment, preview maps on a new listing, and hand off clean files—without living in spreadsheets.
          </p>
          <RzPrimaryCtas />
        </div>
        <RzPostHeroPhoneMarquee />
      </div>
    </section>
  );
}

export function RzLogoMarquee() {
  const { sentinelRef, revealClassName } = useScrollReveal();
  const doubled = [...TRUST_BRANDS, ...TRUST_BRANDS];
  return (
    <section className={`rz-logo-marquee ${revealClassName}`} aria-labelledby="rz-logo-marquee-title">
      <div ref={sentinelRef} className="rz-reveal-sentinel" aria-hidden />
      <div id="rz-logo-marquee-title" className="rz-logo-marquee-intro rz-stagger-child" style={stag(0)}>
        Also trusted at brokerages like these
      </div>
      <div className="rz-logo-marquee-viewport rz-stagger-child" style={stag(1)}>
        <div className="rz-logo-marquee-track">{doubled.map((b, i) => (
          <span key={`${b}-${i}`}>{b}</span>
        ))}
        </div>
      </div>
    </section>
  );
}

export function RzProofRail() {
  const { sentinelRef, revealClassName } = useScrollReveal();
  return (
    <section className={`rz-proof-rail rz-proof-rail--dark ${revealClassName}`} aria-label="Key metrics">
      <div ref={sentinelRef} className="rz-reveal-sentinel" aria-hidden />
      <div className="container rz-proof-rail-grid">
        {REZ_PROOF_LINE.map((cell, i) => (
          <div key={cell.label} className="rz-proof-rail-cell rz-stagger-child" style={stag(i)}>
            <p className="rz-proof-rail-num">{cell.num}</p>
            <p className="rz-proof-rail-label">{cell.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

type RzShowcaseSplitProps = {
  reverse?: boolean;
  sectionClass?: string;
  kicker: string;
  title: string;
  lead: string;
  bullets: readonly string[];
  afterBullets?: ReactNode;
  children: ReactNode;
  reveal: ScrollRevealBindings;
};

function RzShowcaseSplit(props: RzShowcaseSplitProps) {
  const { reverse, sectionClass = "", kicker, title, lead, bullets, afterBullets, children, reveal } = props;
  const secClass = ["rz-showcase-split", reverse && "rz-showcase-split--reverse", sectionClass, reveal.revealClassName].filter(Boolean).join(" ");
  return (
    <section className={secClass}>
      <div ref={reveal.sentinelRef} className="rz-reveal-sentinel" aria-hidden />
      <div className="container rz-showcase-grid">
        <div className="rz-showcase-copy">
          <p className="rz-rez-kicker rz-stagger-child" style={stag(0)}>
            {kicker}
          </p>
          <h2 className="rz-showcase-title rz-stagger-child" style={stag(1)}>
            {title}
          </h2>
          <p className="rz-showcase-lead muted rz-muted rz-stagger-child" style={stag(2)}>
            {lead}
          </p>
          <ul className="rz-showcase-bullets">
            {bullets.map((line, idx) => (
              <li key={line} className="rz-stagger-child" style={stag(3 + idx)}>
                <span className="rz-bullet-dot" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
          {afterBullets ? (
            <div className="rz-showcase-actions rz-stagger-child" style={stag(3 + bullets.length)}>
              {afterBullets}
            </div>
          ) : null}
        </div>
        <div
          className="rz-showcase-visual rz-stagger-child"
          style={stag(3 + bullets.length + (afterBullets ? 1 : 0))}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

export function RzLeadShowcase() {
  const reveal = useScrollReveal();
  return (
    <RzShowcaseSplit
      reveal={reveal}
      kicker={REZ_SHOWCASE_LEADS.kicker}
      title={REZ_SHOWCASE_LEADS.title}
      lead={REZ_SHOWCASE_LEADS.lead}
      bullets={REZ_SHOWCASE_LEADS.bullets}
      afterBullets={
        <>
          <Link to="/buy-leads" className="btn btn-primary rz-btn-soft">
            Browse packs
            <span aria-hidden>→</span>
          </Link>
          <Link to="/content" className="btn btn-ghost rz-btn-soft">
            Book a demo
          </Link>
          <a href="/csv/lead-template.csv" download className="btn btn-ghost rz-btn-soft">
            <IconDoc /> Sample CSV
          </a>
        </>
      }
    >
      <RzBrowserShell>
        <div className="rz-browser-dash-preview">
          <img src={MARKETING_IMG.modern} alt="Dashboard-style interior imagery" loading="lazy" width={920} height={560} />
        </div>
      </RzBrowserShell>
    </RzShowcaseSplit>
  );
}

export function RzCircleShowcase() {
  const reveal = useScrollReveal();
  return (
    <RzShowcaseSplit
      reveal={reveal}
      kicker={REZ_SHOWCASE_CIRCLE.kicker}
      title={REZ_SHOWCASE_CIRCLE.title}
      lead={REZ_SHOWCASE_CIRCLE.lead}
      bullets={REZ_SHOWCASE_CIRCLE.bullets}
      afterBullets={
        <>
          <Link to="/order/948" className="btn btn-primary rz-btn-soft">
            Open sample order
            <span aria-hidden>→</span>
          </Link>
          <Link to="/content" className="btn btn-ghost rz-btn-soft">
            Book a demo
          </Link>
        </>
      }
    >
      <RzBrowserShell>
        <div className="rz-browser-dash-preview rz-browser-map-wrap">
          <ListingMap lat={SAMPLE_LISTING.lat} lng={SAMPLE_LISTING.lng} radius="h1" />
        </div>
      </RzBrowserShell>
    </RzShowcaseSplit>
  );
}

export function RzWorkflowRail() {
  const { sentinelRef, revealClassName } = useScrollReveal();
  return (
    <section className={`rz-workflow-rail rz-workflow-rail--dark rz-section home-section ${revealClassName}`}>
      <div ref={sentinelRef} className="rz-reveal-sentinel" aria-hidden />
      <div className="container">
        <p className="rz-rez-kicker rz-rez-kicker-center rz-stagger-child" style={stag(0)}>
          How it works
        </p>
        <h2 className="rz-workflow-heading rz-stagger-child" style={stag(1)}>
          Four steps from listing to download
        </h2>
        <div className="rz-workflow-rail-grid">
          {STEPS.map((s, i) => (
            <div key={s.n} className="rz-workflow-step rz-stagger-child" style={stag(2 + i)}>
              <div className="rz-workflow-node">
                <span className="rz-workflow-num">{s.n}</span>
                {i < STEPS.length - 1 ? <span className="rz-workflow-line" aria-hidden /> : null}
              </div>
              <h3 className="rz-workflow-h">{s.t}</h3>
              <p className="rz-workflow-desc muted rz-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function tv2Initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

function tv2QuoteBody(raw: string): string {
  return raw.replace(/^[\s"'“„«]+|[\s"'”»]+$/gu, "").trim();
}

export function RzTestimonialsFeatured() {
  const trackRef = useRef<HTMLDivElement>(null);
  const { sentinelRef, revealClassName } = useScrollReveal();

  const scrollByDir = useCallback((dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.querySelector<HTMLElement>("[data-testimonial-slide]");
    const gs = getComputedStyle(el);
    const gapParsed = Number.parseFloat(gs.columnGap || gs.gap.split(" ")[0] || "0");
    const gap = Number.isFinite(gapParsed) && gapParsed > 0 ? gapParsed : 14;
    const step =
      slide != null ? Math.round(slide.getBoundingClientRect().width + gap) : Math.min(560, el.clientWidth * 0.82);
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * step * 2, behavior: reduce ? "auto" : "smooth" });
  }, []);

  const onTrackKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollByDir(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollByDir(1);
      }
    },
    [scrollByDir],
  );

  const slides: ReactNode[] = [];
  let stagIdx = 0;
  for (let i = 0; i < TESTIMONIALS.length; i++) {
    const metric = TESTIMONIAL_SHOWCASE_METRICS[i];
    const t = TESTIMONIALS[i];
    if (metric) {
      slides.push(
        <div
          key={`rz-t-m-${i}`}
          data-testimonial-slide
          className="rz-tv2-slide rz-stagger-child"
          style={stag(stagIdx++)}
        >
          <article className="rz-tv2-metric-card" aria-label={`${metric.headline}: ${metric.label}`}>
            <p className="rz-tv2-metric-head">{metric.headline}</p>
            <p className="rz-tv2-metric-label">{metric.label}</p>
            <p className="rz-tv2-metric-cap">{metric.caption}</p>
          </article>
        </div>,
      );
    }
    slides.push(
      <div
        key={`rz-t-q-${t.name}`}
        data-testimonial-slide
        className="rz-tv2-slide rz-stagger-child"
        style={stag(stagIdx++)}
      >
        <blockquote className="rz-tv2-quote-card">
          <span className="rz-tv2-quote-glyph" aria-hidden>
            “
          </span>
          <p className="rz-tv2-quote-text">{tv2QuoteBody(t.quote)}</p>
          <footer className="rz-tv2-quote-foot">
            <span className="rz-tv2-avatar" aria-hidden>
              {tv2Initials(t.name)}
            </span>
            <div>
              <cite className="rz-tv2-quote-name">{t.name}</cite>
              <p className="rz-tv2-quote-role">{t.role}</p>
            </div>
          </footer>
        </blockquote>
      </div>,
    );
  }

  return (
    <section className={`rz-tv2-outer rz-section rz-section--white home-section ${revealClassName}`}>
      <div ref={sentinelRef} className="rz-reveal-sentinel" aria-hidden />
      <div className="container">
        <div className="rz-tv2-module">
          <header className="rz-tv2-head">
            <p className="rz-tv2-kicker">What teams are saying</p>
            <div className="rz-tv2-heading-burst">
              <span className="rz-tv2-burst" aria-hidden />
              <h2 className="rz-tv2-title">Proof from the field</h2>
            </div>
            <p className="rz-tv2-lead">
              Real operators. Real checkouts. Here’s what happens when circle prospecting lives on one branded link instead
              of twelve tabs.
            </p>
          </header>

          <div className="rz-tv2-carousel" aria-label="Testimonial highlights">
            <button
              type="button"
              className="rz-tv2-nav rz-tv2-nav--prev"
              aria-label="Scroll testimonials left"
              onClick={() => scrollByDir(-1)}
            >
              <span aria-hidden>‹</span>
            </button>
            <div className="rz-tv2-viewport">
              <div
                ref={trackRef}
                className="rz-tv2-track"
                role="region"
                aria-label="Customer testimonials"
                tabIndex={0}
                onKeyDown={onTrackKeyDown}
              >
                {slides}
              </div>
            </div>
            <button
              type="button"
              className="rz-tv2-nav rz-tv2-nav--next"
              aria-label="Scroll testimonials right"
              onClick={() => scrollByDir(1)}
            >
              <span aria-hidden>›</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function StatBarSection() {
  return (
    <section className="rz-section rz-section--white rz-stat-strip home-section">
      <div className="container">
        <p className="rz-marquee-intro">Trusted by disciplined teams nationwide</p>
        <div className="rz-marquee-row" aria-hidden>
          {TRUST_BRANDS.map((b) => (
            <span key={b}>{b}</span>
          ))}
        </div>
        <div className="cp-statbar">
          {STAT_BAR.map((x) => (
            <div key={x.k} className="cp-statbar-item">
              <div className="cp-statbar-icon" aria-hidden>
                <span className="cp-statbar-glow" />
                <span className="cp-statbar-ico-inner">
                  <StatBarGlyph id={x.icon} />
                </span>
              </div>
              <div>
                <p className="cp-statbar-val">{x.v}</p>
                <p className="cp-statbar-key">{x.k}</p>
                <p className="cp-statbar-sub">{x.s}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LeadsProductSection() {
  return (
    <section className="rz-section rz-section--white home-section split-mock">
      <div className="container split-mock-grid">
        <div className="cp-glass-block">
          <p className="cp-tag rz-kicker-sans" style={{ letterSpacing: "0.14em", marginBottom: "0.5rem" }}>
            Inventory you can trust
          </p>
          <h2 className="rz-section-title">Inventory-grade leads, sold in packs</h2>
          <p className="muted rz-muted" style={{ marginBottom: "1.25rem" }}>
            Admins seed your market. Clients buy fixed pack sizes, pay with Stripe, and get delivery in a secure dashboard with
            one-click export.
          </p>
          <ul className="cp-checklist">
            <li>
              <IconCheck />
              <span>Structured fields for your MLS, investor, or GHL stack — geo, occupancy, equity flags, and more.</span>
            </li>
            <li>
              <IconCheck />
              <span>Server-side allocation: each paid order gets unique rows — no duplicate selling.</span>
            </li>
            <li>
              <IconCheck />
              <span>JWT-secured client area (swap in your auth provider when you go live).</span>
            </li>
          </ul>
          <div className="cp-inventory-btns">
            <Link to="/buy-leads" className="btn btn-primary">
              View lead packages
              <span aria-hidden>→</span>
            </Link>
            <Link to="/leads" className="btn btn-ghost">
              Learn more
            </Link>
            <a href="/csv/lead-template.csv" download className="btn btn-ghost" style={{ gap: 8 }}>
              <IconDoc />
              Lead template
            </a>
          </div>
        </div>
        <div className="cp-video-block">
          <div className="cp-video-frame">
            <img src={MARKETING_IMG.modern} alt="Luxury interior preview" width={800} height={450} loading="lazy" />
            <button type="button" className="cp-play" aria-label="Play overview video" disabled>
              <PlayIcon />
            </button>
          </div>
          <div className="cp-testimonial">
            <div className="cp-testimonial-row">
              <div className="cp-testimonial-avatar" aria-hidden>
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80"
                  alt=""
                  width={48}
                  height={48}
                />
              </div>
              <div>
                <p className="cp-testimonial-quote">
                  “This cut our list build time by 90% — and the data actually matched our farm.”
                </p>
                <p className="cp-testimonial-name">Michael Torres</p>
                <p className="cp-testimonial-role">Principal, Atlas Realty Group</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ComparisonSplitSection() {
  return (
    <section className="rz-compare-split" aria-label="List quality versus ideal customer profiles">
      <div className="rz-compare-left">
        <h2 className="rz-compare-h2">
          Why our list works better
        </h2>
        <ul className="rz-compare-list">
          {COMPARE_WITHOUT.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
      <div className="rz-compare-right">
        <h2 className="rz-compare-h2 rz-compare-h2--light">
          Who uses Circle Prospecting AI?
        </h2>
        <ul className="rz-compare-list rz-compare-list--light">
          {COMPARE_WITH.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function TestimonialsDeckSection() {
  return (
    <section className="rz-section rz-section--white home-section">
      <div className="container">
        <p className="rz-kicker-sans" style={{ textAlign: "center" }}>
          Social proof
        </p>
        <h2 className="rz-section-title" style={{ textAlign: "center", maxWidth: 640, marginInline: "auto" }}>
          Love letters from teams that ditched brittle spreadsheets
        </h2>
        <div className="rz-testimonial-deck">
          {TESTIMONIALS.map((t) => (
            <blockquote
              key={t.name}
              className={t.accent ? "rz-testimonial-card rz-testimonial-card--accent" : "rz-testimonial-card"}
            >
              <p className="rz-testimonial-stars" aria-hidden>
                ★★★★★
              </p>
              <p className="rz-testimonial-quote">{t.quote}</p>
              <footer>
                <cite className="rz-testimonial-name">{t.name}</cite>
                <p className="rz-testimonial-role">{t.role}</p>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

export function IntegrationsSection({
  rezLayout = false,
  animateOnScroll = false,
  darkBand = false,
}: {
  rezLayout?: boolean;
  animateOnScroll?: boolean;
  darkBand?: boolean;
}) {
  const scroll = useScrollReveal({ enabled: animateOnScroll });
  const shell =
    rezLayout && darkBand
      ? "rz-section home-section rz-integration-rez-band rz-integration-rez-refresh rz-integration--dark"
      : `rz-section rz-section--white home-section${rezLayout ? " rz-integration-rez-band rz-integration-rez-refresh" : ""}`;
  return (
    <section className={`${shell}${animateOnScroll ? ` ${scroll.revealClassName}` : ""}`}>
      {animateOnScroll ? <div ref={scroll.sentinelRef} className="rz-reveal-sentinel" aria-hidden /> : null}
      <div className="container">
        {rezLayout ? (
          <>
            <p className={`rz-rez-kicker rz-rez-kicker-center${animateOnScroll ? " rz-stagger-child" : ""}`} {...(animateOnScroll ? { style: stag(0) } : {})}>
              Integrations
            </p>
            <h2 className={`rz-workflow-heading${animateOnScroll ? " rz-stagger-child" : ""}`} {...(animateOnScroll ? { style: stag(1) } : {})}>
              Works with the tools you already use
            </h2>
            <p
              className={`muted rz-muted rz-integration-rez-intro${animateOnScroll ? " rz-stagger-child" : ""}`}
              {...(animateOnScroll ? { style: stag(2) } : {})}
            >
              Card payments, CRM, maps, and file delivery—hook up what your team already trusts.
            </p>
          </>
        ) : (
          <>
            <p className="rz-kicker-sans">Integrations</p>
            <h2 className="rz-section-title">Plays nice with your stack</h2>
            <p className="muted rz-muted" style={{ maxWidth: 560, marginBottom: "2rem" }}>
              Connect payouts, CRM automation, maps, and ingestion without ripping out the systems you already sold your brokerages on.
            </p>
          </>
        )}
        <div className={rezLayout ? "rz-integration-board" : "rz-integration-grid"}>
          {INTEGRATION_SLOTS.map((name, i) => (
            <div
              key={name}
              className={`rz-integration-tile${rezLayout ? " rz-integration-tile--board" : ""}${animateOnScroll ? " rz-stagger-child" : ""}`}
              {...(animateOnScroll ? { style: stag(3 + i) } : {})}
            >
              <span className={`rz-integration-dot${rezLayout ? " rz-integration-dot--subtle" : ""}`} aria-hidden />
              <span className="rz-integration-label">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FaqSection({ animateOnScroll = false, dark = false }: { animateOnScroll?: boolean; dark?: boolean }) {
  const scroll = useScrollReveal({ enabled: animateOnScroll });
  const shell = ["rz-section", "home-section", "rz-faq-band", dark ? "rz-faq-band--dark" : "rz-section--white"].join(" ");
  return (
    <section className={`${shell}${animateOnScroll ? ` ${scroll.revealClassName}` : ""}`}>
      {animateOnScroll ? <div ref={scroll.sentinelRef} className="rz-reveal-sentinel" aria-hidden /> : null}
      <div className="container rz-faq-container" style={{ maxWidth: 760 }}>
        <p className={`rz-kicker-sans${animateOnScroll ? " rz-stagger-child" : ""}`} {...(animateOnScroll ? { style: stag(0) } : {})}>
          FAQ
        </p>
        <h2 className={`rz-section-title${animateOnScroll ? " rz-stagger-child" : ""}`} {...(animateOnScroll ? { style: stag(1) } : {})}>
          Common questions
        </h2>
        <p
          className={`muted rz-muted${animateOnScroll ? " rz-stagger-child" : ""}`}
          style={{ marginBottom: "1.75rem", ...(animateOnScroll ? stag(2) : {}) }}
        >
          Rollout, billing, sign-in, and data—answered in plain English.
        </p>
        <div className="rz-faq-list">
          {FAQ_ITEMS.map((item, idx) => (
            <details
              key={item.q}
              className={`rz-faq-item${animateOnScroll ? " rz-stagger-child" : ""}`}
              {...(animateOnScroll ? { style: stag(3 + idx) } : {})}
            >
              <summary className="rz-faq-summary-hit">{item.q}</summary>
              <div className="rz-faq-body">
                <p>{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SocialProofSection() {
  return (
    <section className="rz-section rz-section--white cp-social-proof" aria-label="Customer metrics">
      <div className="container cp-social-inner">
        <p className="cp-social-crown">Numbers teams care about</p>
        <div className="cp-social-grid">
          {SOCIAL_PROOF.map((m) => (
            <div key={m.d} className="cp-social-cell">
              <p className="cp-social-num">{m.n}</p>
              <p className="cp-social-desc">{m.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CircleProductSection() {
  return (
    <section className="rz-section rz-section--white home-section">
      <div className="container split-section section-surface">
        <div className="img-frame" style={{ order: 1 }}>
          <img src={MARKETING_IMG.pool} alt="Contemporary home with water feature" loading="lazy" width={800} height={480} />
        </div>
        <div style={{ order: 2 }}>
          <h2 className="rz-section-title">Circle prospecting made turnkey</h2>
          <p className="muted rz-muted" style={{ marginBottom: "1.25rem" }}>
            A new listing lands, validates, and opens a pre-filled order link. Agents pick subdivision through ZIP-level radius and
            compare AI / Live / Pro lanes with transparent volume bands.
          </p>
          <Link to="/order/948" className="btn btn-primary">
            Open demo order (948)
          </Link>
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section className="rz-section rz-section--white home-section flow-section">
      <div className="container">
        <p className="rz-kicker-sans" style={{ textAlign: "center" }}>
          How it works
        </p>
        <h2 className="rz-section-title" style={{ textAlign: "center" }}>
          Delivery in four moves
        </h2>
        <p className="muted rz-muted" style={{ textAlign: "center", maxWidth: 560, margin: "0.5rem auto 2rem" }}>
          One premium operator rhythm: isolate <strong>lead product</strong> from <strong>prospecting product</strong>, then automate
          the seams.
        </p>
        <div className="flow-grid">
          {STEPS.map((s) => (
            <div key={s.n} className="flow-card">
              <p className="flow-step-p">{s.n}</p>
              <h3 className="flow-h3">{s.t}</h3>
              <p className="muted rz-muted flow-d">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MapFarmSection() {
  return (
    <section className="rz-section rz-section--white home-section">
      <div className="container split-section section-surface">
        <div>
          <p className="rz-kicker-sans">Maps</p>
          <h2 className="rz-section-title">Reach them where they are</h2>
          <p className="muted rz-muted">
            Listing pin plus radius rings that match how you pitch. Hook up <code className="cp-code">VITE_GOOGLE_MAPS_API_KEY</code>
            {" "}for Google tiles — otherwise OSM renders out of the box.
          </p>
          <p className="muted rz-muted" style={{ marginTop: "0.75rem" }}>
            Example: Dunedin, FL · half‑mile preview below.
          </p>
        </div>
        <div>
          <ListingMap lat={SAMPLE_LISTING.lat} lng={SAMPLE_LISTING.lng} radius="h1" />
        </div>
      </div>
    </section>
  );
}

export function BeforeAfterSection() {
  return (
    <section className="rz-section rz-section--white home-section cp-section-muted">
      <div className="container section-surface">
        <h2 className="rz-section-title" style={{ textAlign: "center" }}>
          The old list vs. your stack
        </h2>
        <div className="cp-beforeafter-grid">
          <div className="gradient-border cp-card-pad" style={{ background: "var(--rz-white)" }}>
            <img src={MARKETING_IMG.before} alt="Traditional lead workflow" className="cp-ba-img" loading="lazy" />
            <h3 className="cp-ba-h">Before</h3>
            <p className="muted rz-muted" style={{ margin: 0 }}>
              Static drops, windshield time, zero trigger linking a listing to a timely neighborhood blast.
            </p>
          </div>
          <div className="gradient-border cp-card-beforeafter-right" style={{ background: "#fafafa" }}>
            <img src={MARKETING_IMG.skyline} alt="Integrated data stack" className="cp-ba-img" loading="lazy" />
            <div className="cp-card-pad-sm">
              <h3 className="cp-ba-h">After</h3>
              <p className="muted rz-muted" style={{ margin: 0 }}>
                One flagship flow: purchase leads, export cleanly, route circle orders with verified pricing — maps mirror your pitch.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const PRICING_INCLUDED = [
  "AI, Live, and Pro campaign lanes priced per qualified home inside the radius you pick",
  "Volume tiers applied automatically — the checkout API recomputes totals (browser never owns price)",
  "Lead packs sold separately with CSV delivery plus dashboard export for your admins",
  "Maps, Stripe checkout, webhook-friendly listing intake, and JWT client access out of the box",
];

export function CampaignPricingSection({ animateOnScroll = false }: { animateOnScroll?: boolean }) {
  const scroll = useScrollReveal({ enabled: animateOnScroll });
  const { tiers, loading, error } = usePricingTiers();
  const rows = tiersToTableRows(tiers);
  const fromRate = lowestPerHomeRate(tiers);

  return (
    <section
      className={`rz-section rz-section--white home-section rz-pricing-section rz-pricing-section--rez${animateOnScroll ? ` ${scroll.revealClassName}` : ""}`}
    >
      {animateOnScroll ? <div ref={scroll.sentinelRef} className="rz-reveal-sentinel" aria-hidden /> : null}
      <div className="container rz-pricing-rez-container">
        <div className="rz-pricing-rez-head">
          <p className={`rz-kicker-sans${animateOnScroll ? " rz-stagger-child" : ""}`} {...(animateOnScroll ? { style: stag(0) } : {})}>
            Pricing
          </p>
          <h2 className={`rz-pricing-rez-title${animateOnScroll ? " rz-stagger-child" : ""}`} {...(animateOnScroll ? { style: stag(1) } : {})}>
            Straightforward prices. Three neighborhood campaign types.
          </h2>
          <p
            className={`rz-pricing-rez-lead${animateOnScroll ? " rz-stagger-child" : ""}`}
            {...(animateOnScroll ? { style: stag(2) } : {})}
          >
            Per-home rates inside the ring you sell. Volume bands below — same numbers your checkout uses server-side.
          </p>
        </div>

        <div className={`rz-pricing-rez-surface${animateOnScroll ? " rz-stagger-child" : ""}`} {...(animateOnScroll ? { style: stag(3) } : {})}>
          <div className="rz-pricing-rez-top">
            <div className="rz-pricing-rez-price-block">
              <span className="rz-pricing-rez-from">From</span>
              <div className="rz-pricing-rez-price-row">
                <span className="rz-price-num">{formatCurrency(fromRate)}</span>
                <span className="rz-pricing-rez-per">/ home</span>
              </div>
              <p className="rz-price-sub">At volume with AI · scales by homes in ring.</p>
            </div>
            <div className="rz-pricing-rez-includes">
              <h3 className="rz-included-title">What&apos;s included</h3>
              <ul className="rz-included-list">
                {PRICING_INCLUDED.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rz-pricing-rez-table-inner">
            <table className="data-table rezora-data-table rz-pricing-rez-table">
              <thead>
                <tr>
                  <th>Homes in ring</th>
                  <th>AI / home</th>
                  <th>Live / home</th>
                  <th>Pro / home</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((c) => (
                      <td key={`${row[0]}-${c}`}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`rz-pricing-rez-cta${animateOnScroll ? " rz-stagger-child" : ""}`} {...(animateOnScroll ? { style: stag(4) } : {})}>
          <Link to="/buy-leads" className="btn btn-primary btn-wide rz-pricing-rez-btn">
            Get started
          </Link>
          <p className="rz-pricing-rez-footnote">
            Need a procurement packet? We&apos;ll mirror your tier sheet on the API host — not exposed in the browser.
          </p>
        </div>

        {loading && !error ? (
          <p className="rz-pricing-rez-status" aria-live="polite">
            Refreshing live rates…
          </p>
        ) : null}
        {error ? (
          <p className="rz-pricing-rez-status rz-pricing-rez-status--quiet" role="status">
            Showing default rate card. Connect the pricing API for live sync.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function BlogCardsSection() {
  return (
    <section className="rz-section rz-section--white home-section" aria-label="Recent articles">
      <div className="container">
        <p className="rz-kicker-sans">Insights</p>
        <h2 className="rz-section-title">From the field</h2>
        <p className="muted rz-muted" style={{ maxWidth: 560, marginBottom: 0 }}>
          Short reads on rollout, integrations, and how teams operationalize radius campaigns — without ripping out CRM hygiene.
        </p>
        <div className="rz-blog-grid">
          {BLOG_CARDS.map((post) => (
            <Link key={post.title} to={post.href} className="rz-blog-card">
              <div className="rz-blog-card-img-wrap">
                <img src={post.image} alt="" loading="lazy" width={640} height={400} />
              </div>
              <div className="rz-blog-card-body">
                <p className="rz-blog-card-date">{post.date}</p>
                <h3 className="rz-blog-card-title">{post.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ContentBookSection() {
  return (
    <section className="rz-section rz-section--white home-section">
      <div className="container section-surface">
        <div className="cp-book gradient-border">
          <p className="rz-kicker-sans" style={{ marginBottom: "0.65rem" }}>
            Demo
          </p>
          <h2 className="rz-section-title" style={{ marginTop: 0 }}>
            Walk through intake, copy, and GHL handoff
          </h2>
          <p className="muted rz-muted" style={{ maxWidth: 520, margin: "0.5rem auto 1.5rem", textAlign: "center" }}>
            Align voice, tiers, Stripe modes, and admin CSV cadence — test or prod, your call.
          </p>
          <a className="btn btn-primary" href={`mailto:${contactEmail()}?subject=Circle%20Prospecting%20AI%20—%20Demo`}>
            {contactEmail()}
          </a>
        </div>
      </div>
    </section>
  );
}
