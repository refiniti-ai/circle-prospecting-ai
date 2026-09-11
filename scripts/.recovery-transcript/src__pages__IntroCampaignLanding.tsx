import { useCallback } from "react";
import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { IntroCampaignSearch } from "../components/intro/IntroCampaignSearch";
import { BrokerageTrustCarousel } from "../components/marketing/BrokerageTrustCarousel";
import { HERO_MARKET_ACTIVITY_MAP } from "../components/marketing/marketingData";
import {
  INTRO_CAMPAIGN,
  draftFromSearchResult,
  saveIntroCampaignDraft,
} from "../lib/introCampaign";
import { normalizeAgentPhoneParam } from "../lib/introAgentPhone";
import { notifyError } from "../lib/notify";
import type { BuyLeadsSearchResult } from "../components/BuyLeadsSearch";
import "./intro-campaign.css";

const HERO_BULLETS = [
  "AI identifies the best nearby homeowners",
  "Professional live callers make every call",
  "Promote your newest listing and your brand",
  "Generate more conversations, appointments, and future listings",
] as const;

const STEPS = [
  {
    n: "1",
    title: "Find Your Listing or Sale",
    detail: "Search by agent email or phone, MLS number, or property address.",
    icon: "pin",
  },
  {
    n: "2",
    title: "AI Identifies",
    detail: "The best 250 nearby homeowners.",
    icon: "ai",
  },
  {
    n: "3",
    title: "Professional Callers",
    detail: "Introduce your newest listing or sale and YOU as the local real estate expert.",
    icon: "phone",
  },
  {
    n: "4",
    title: "Generate More",
    detail: "Appointments, listing opportunities, and referrals.",
    icon: "calendar",
  },
] as const;

const INCLUDED = [
  "AI identifies the best 250 nearby homeowners",
  "Professional live callers make every call",
  "Promote your newest listing",
  "Promote YOU and your brand",
  "Neighborhood introduction campaign",
  "Campaign reporting in your dashboard",
  "Appointment and lead tracking",
] as const;

const RECENT_LISTINGS = [
  { address: "1847 Bayfront Dr, St Petersburg, FL", mls: "U8145678" },
  { address: "2201 Gulf Blvd, Clearwater, FL", mls: "U8134521" },
  { address: "501 Bayshore Blvd, Tampa, FL", mls: "TB88604696" },
] as const;

function StepIcon({ kind }: { kind: (typeof STEPS)[number]["icon"] }) {
  if (kind === "pin") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="intro-step-icon">
        <path
          d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle cx="12" cy="10" r="2.5" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "ai") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="intro-step-icon">
        <rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "phone") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="intro-step-icon">
        <path
          d="M6.5 4h3l1.5 5-2 1.5a11 11 0 0 0 5 5L15.5 14l5 1.5v3A2 2 0 0 1 18.7 20 15 15 0 0 1 4 5.3 2 2 0 0 1 6.5 4Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="intro-step-icon">
      <rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IntroCampaignLanding() {
  const navigate = useNavigate();
  const { agentPhone: agentPhoneParam } = useParams();
  const initialAgentPhone = agentPhoneParam ? normalizeAgentPhoneParam(agentPhoneParam) : undefined;

  useEffect(() => {
    if (!initialAgentPhone) return;
    document.getElementById("intro-search")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialAgentPhone]);

  const onSearchResult = useCallback(
    (result: BuyLeadsSearchResult) => {
      try {
        saveIntroCampaignDraft(draftFromSearchResult(result));
        navigate(INTRO_CAMPAIGN.checkoutPath);
      } catch {
        notifyError("Could not continue to checkout. Try again.");
      }
    },
    [navigate]
  );

  return (
    <>
      <SeoHead
        title="First-time neighborhood campaign — $99 for 250 homeowners | Circle Prospecting AI"
        description="Introductory offer: we professionally call the 250 homeowners closest to your newest listing or sale for $99. Live callers, AI targeting, no contracts."
        path={initialAgentPhone ? INTRO_CAMPAIGN.agentPath(initialAgentPhone) : INTRO_CAMPAIGN.path}
      />
      <div className="app-shell rz-shell rz-app intro-campaign-page intro-flyer-page">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="intro-campaign-main">
          <section className="intro-flyer-hero intro-flyer-hero--client-banner">
            <picture className="intro-flyer-hero__banner-picture">
              <source
                media="(min-width: 1440px)"
                srcSet={INTRO_CAMPAIGN.bannerImageDesktop}
              />
              <img
                className="intro-flyer-hero__banner-img"
                src={INTRO_CAMPAIGN.bannerImage}
                alt=""
                aria-hidden
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.src.endsWith(HERO_MARKET_ACTIVITY_MAP)) {
                    img.src = HERO_MARKET_ACTIVITY_MAP;
                  }
                }}
              />
            </picture>
            <div className="intro-flyer-hero__overlay intro-flyer-hero__overlay--light" aria-hidden />
            <div className="container intro-flyer-hero__grid">
              <div className="intro-flyer-hero__copy">
                <p className="intro-flyer-hero__tagline">
                  The #1 Neighborhood Marketing Platform for Real Estate Professionals
                </p>
                <h1 className="intro-flyer-hero__title">
                  We Promote <span className="intro-flyer-accent">YOU</span> as the Local{" "}
                  <span className="intro-flyer-accent">Real Estate Expert</span>
                </h1>
                <p className="intro-flyer-hero__sub">Turn your new listing into your next listing.</p>
                <p className="intro-flyer-hero__lead">
                  For just <strong>${INTRO_CAMPAIGN.priceUsd}</strong>, we&apos;ll professionally call the{" "}
                  <strong>{INTRO_CAMPAIGN.homes} homeowners</strong> closest to your newest listing or sale.
                </p>
                <ul className="intro-flyer-checklist intro-flyer-checklist--hero">
                  {HERO_BULLETS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="intro-flyer-hero__price-callout">
                  Your First Neighborhood Campaign Only <strong>${INTRO_CAMPAIGN.priceUsd}</strong>
                </p>
                <a href="#intro-search" className="intro-flyer-btn intro-flyer-btn--hero">
                  Promote my latest listing or sale
                  <span aria-hidden>›</span>
                </a>
              </div>
            </div>
          </section>

          <section id="intro-search" className="intro-flyer-search intro-flyer-search--mid">
            <div className="container">
              <h2 className="intro-flyer-search__title">Let&apos;s find your latest listing or sale</h2>
              <IntroCampaignSearch
                className="intro-search__panel intro-search__panel--flyer"
                initialAgentPhone={initialAgentPhone}
                onResult={onSearchResult}
                onError={notifyError}
              />
              <p className="intro-search__note intro-flyer-search__note intro-flyer-search__note--mid">
                Already used this offer?{" "}
                <Link to="/buy-leads">Order at regular pricing</Link>.
              </p>
            </div>
          </section>

          <section className="intro-flyer-steps">
            <div className="container">
              <h2 className="intro-flyer-section-label">How it works</h2>
              <ol className="intro-flyer-steps__grid">
                {STEPS.map((step, i) => (
                  <li key={step.n} className="intro-flyer-steps__item">
                    <StepIcon kind={step.icon} />
                    <span className="intro-flyer-steps__n">Step {step.n}</span>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                    {i < STEPS.length - 1 ? <span className="intro-flyer-steps__arrow" aria-hidden /> : null}
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="intro-flyer-split">
            <div className="container intro-flyer-split__grid">
              <div className="intro-flyer-split__media">
                <img
                  src="/marketing/homepage-campaign-checkout.webp"
                  alt=""
                  className="intro-flyer-split__photo"
                />
                <div className="intro-flyer-split__quote">
                  <h2 className="intro-flyer-section-label">Imagine this…</h2>
                  <p>
                    Your newest listing becomes the reason 250 nearby homeowners hear from you — not a cold pitch,
                    but a professional introduction to the agent who just sold or listed right in their neighborhood.
                  </p>
                </div>
              </div>
              <aside className="intro-flyer-included">
                <h2 className="intro-flyer-included__title">What&apos;s included?</h2>
                <ul className="intro-flyer-checklist intro-flyer-checklist--included">
                  {INCLUDED.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </aside>
            </div>
          </section>

          <section className="intro-flyer-offer">
            <div className="container intro-flyer-offer__inner">
              <p className="intro-flyer-offer__price" aria-label={`${INTRO_CAMPAIGN.priceUsd} dollars`}>
                ${INTRO_CAMPAIGN.priceUsd}
              </p>
              <div className="intro-flyer-offer__copy">
                <p className="intro-flyer-offer__kicker">Limited-time introductory offer</p>
                <p className="intro-flyer-offer__lead">
                  We&apos;ll professionally contact the {INTRO_CAMPAIGN.homes} homeowners closest to your newest
                  listing or sale.
                </p>
                <ul className="intro-flyer-offer__trust">
                  <li>No contracts</li>
                  <li>No monthly commitment</li>
                  <li>Cancel anytime</li>
                </ul>
              </div>
              <a href="#intro-search" className="intro-flyer-btn intro-flyer-btn--offer">
                Promote my latest listing or sale
                <span aria-hidden>›</span>
              </a>
            </div>
          </section>

          <section className="intro-flyer-recent">
            <div className="container intro-flyer-recent__grid">
              <div className="intro-flyer-recent__cta-card">
                <img src="/marketing/homepage-campaign-checkout.webp" alt="" className="intro-flyer-recent__house" />
                <div className="intro-flyer-recent__cta-copy">
                  <h3>Let&apos;s get started!</h3>
                  <p>Search by agent email or phone, MLS #, or property address to begin your $99 campaign.</p>
                  <a href="#intro-search" className="intro-flyer-btn intro-flyer-btn--compact">
                    Start search
                  </a>
                </div>
              </div>
              <div className="intro-flyer-recent__list-wrap">
                <h3 className="intro-flyer-recent__list-title">Recent listings</h3>
                <ul className="intro-flyer-recent__list">
                  {RECENT_LISTINGS.map((row) => (
                    <li key={row.mls}>
                      <img src="/Property.webp" alt="" />
                      <div>
                        <strong>{row.address}</strong>
                        <span>MLS# {row.mls}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <div className="intro-flyer-trust">
            <BrokerageTrustCarousel embed />
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
