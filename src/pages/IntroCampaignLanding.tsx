import { useCallback } from "react";
import { useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { IntroCampaignSearch } from "../components/intro/IntroCampaignSearch";
import {
  INTRO_CAMPAIGN,
  draftFromSearchResult,
  saveIntroCampaignDraft,
} from "../lib/introCampaign";
import { introPromoMlsHref } from "../lib/introDeepLink";
import { persistIntroListingSnapshot } from "../lib/introListingSnapshotApi";
import { campaignPathFromListingPayload } from "../lib/ghlContactRole";
import { resolveRealMls } from "../lib/listingDraft";
import { firstTimeCustomerAgentPath, normalizeAgentPhoneParam } from "../lib/introAgentPhone";
import { notifyError } from "../lib/notify";
import type { BuyLeadsSearchResult } from "../components/BuyLeadsSearch";
import "./intro-campaign.css";
import "./intro-splash.css";

const STEPS = [
  {
    n: "01",
    title: "Choose your property",
    detail: "Search your recent listing or sale by agent, MLS number, or address.",
  },
  {
    n: "02",
    title: "We map the closest 250",
    detail: "Our platform identifies eligible homeowners nearest to the property.",
  },
  {
    n: "03",
    title: "We call. You follow up.",
    detail: "Professional callers introduce your listing and surface neighborhood conversations.",
  },
] as const;

const INCLUDED = [
  {
    title: "250 closest homeowners",
    detail: "Geographically targeted around your listing or recent sale.",
  },
  {
    title: "Professional live callers",
    detail: "Real people introduce your property and your local brand.",
  },
  {
    title: "Campaign reporting",
    detail: "See call activity and outcomes in your Circle dashboard.",
  },
  {
    title: "No monthly commitment",
    detail: "One introductory campaign for one simple $99 payment.",
  },
] as const;

type IntroCampaignLandingProps = {
  /** When rendered with a phone already resolved (legacy callers). */
  agentPhoneOverride?: string;
};

export function IntroCampaignLanding({ agentPhoneOverride }: IntroCampaignLandingProps = {}) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { agentPhone: agentPhoneParam } = useParams();
  const initialAgentPhone =
    agentPhoneOverride ??
    (agentPhoneParam ? normalizeAgentPhoneParam(agentPhoneParam) : undefined);

  useEffect(() => {
    if (!initialAgentPhone) return;
    document.getElementById("intro-search")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialAgentPhone]);

  const onSearchResult = useCallback(
    (result: BuyLeadsSearchResult) => {
      try {
        saveIntroCampaignDraft(draftFromSearchResult(result));
        if (result.kind === "listing") persistIntroListingSnapshot(result.listing);
        const mls =
          result.kind === "listing"
            ? resolveRealMls(result.listing.mls, result.listing.id)
            : resolveRealMls(result.form.mls);
        if (mls) {
          const campaign =
            result.kind === "listing"
              ? campaignPathFromListingPayload(result.listing) ?? "listed"
              : "listed";
          navigate(introPromoMlsHref(mls, campaign, { search }));
          return;
        }
        navigate(INTRO_CAMPAIGN.checkoutPath);
      } catch {
        notifyError("Could not continue to checkout. Try again.");
      }
    },
    [navigate, search]
  );

  const onAgentPicked = useCallback(
    (phone: string) => {
      const next = firstTimeCustomerAgentPath(phone);
      if (!next || pathname === next) return false;
      navigate(next);
      return true;
    },
    [navigate, pathname]
  );

  return (
    <>
      <SeoHead
        title="250 Homeowner Calls for $99 | Circle Prospecting AI"
        description="Circle Prospecting AI calls the 250 homeowners closest to your listing for only $99."
        path={initialAgentPhone ? INTRO_CAMPAIGN.agentPath(initialAgentPhone) : INTRO_CAMPAIGN.path}
      />
      <div className="app-shell rz-shell rz-app intro-campaign-page intro-splash-page">
        <SiteHeader />
        <div className="intro-splash-topbar">
          First-time customer offer &nbsp;·&nbsp;{" "}
          <strong>250 homeowner calls for ${INTRO_CAMPAIGN.priceUsd}</strong>
        </div>
        <main id="main-content" tabIndex={-1} className="intro-campaign-main">
          <header
            className="intro-splash-hero"
            style={{ ["--intro-splash-hero" as string]: `url('${INTRO_CAMPAIGN.splashHeroImage}')` }}
          >
            <div className="intro-splash-wrap intro-splash-hero__grid">
              <div className="intro-splash-copy">
                <span className="intro-splash-eyebrow">Your first neighborhood campaign</span>
                <h1>
                  We call the <span className="intro-splash-lime">250 homeowners</span> closest to your listing.
                </h1>
                <p className="intro-splash-lede">
                  Turn one listing into your next listing. Our professional callers introduce you to the
                  neighborhood—while you focus on the conversations that come back.
                </p>
                <div className="intro-splash-points">
                  <span>
                    <i>✓</i> Calls made for you
                  </span>
                  <span>
                    <i>✓</i> No contract
                  </span>
                  <span>
                    <i>✓</i> One-time ${INTRO_CAMPAIGN.priceUsd} offer
                  </span>
                </div>
              </div>
              <aside className="intro-splash-card" id="intro-search">
                <div className="intro-splash-card__tag">
                  <span>First campaign</span>
                  <span>Save over 40%</span>
                </div>
                <div className="intro-splash-price-row">
                  <div className="intro-splash-price">
                    <sup>$</sup>
                    {INTRO_CAMPAIGN.priceUsd}
                  </div>
                  <div className="intro-splash-price-copy">
                    one-time
                    <br />
                    intro price
                  </div>
                </div>
                <h2 className="intro-splash-card__title">Find your listing. Meet the neighborhood.</h2>
                <p className="intro-splash-card__sub">
                  Start with your agent email, phone, MLS number, or property address.
                </p>
                <IntroCampaignSearch
                  className="intro-search__panel"
                  initialAgentPhone={initialAgentPhone}
                  onResult={onSearchResult}
                  onAgentPicked={onAgentPicked}
                  onError={(msg) => notifyError(msg, { id: "intro-search" })}
                />
                <div className="intro-splash-micro">
                  <span>🔒 Secure checkout</span>
                  <span>✓ First-time customers only</span>
                  <span>
                    <Link to="/buy-leads">Regular pricing</Link>
                  </span>
                </div>
              </aside>
            </div>
          </header>

          <div className="intro-splash-numbers">
            <div className="intro-splash-wrap intro-splash-numbers__card">
              <div className="intro-splash-stat">
                <b>250</b>
                <span>closest eligible homeowners called</span>
              </div>
              <div className="intro-splash-stat">
                <b>Professional</b>
                <span>live callers representing your brand</span>
              </div>
              <div className="intro-splash-stat">
                <b>${INTRO_CAMPAIGN.priceUsd}</b>
                <span>one-time introductory campaign</span>
              </div>
            </div>
          </div>

          <section className="intro-splash-section">
            <div className="intro-splash-wrap">
              <div className="intro-splash-head">
                <span className="intro-splash-kicker">From listing to conversations</span>
                <h2>
                  Your listing opens the door.
                  <br />
                  We start the conversation.
                </h2>
                <p>No lists to buy. No dialer to manage. No afternoon lost to cold calls.</p>
              </div>
              <div className="intro-splash-steps">
                {STEPS.map((step) => (
                  <article key={step.n} className="intro-splash-step">
                    <div className="intro-splash-step__num">{step.n}</div>
                    <h3>{step.title}</h3>
                    <p>{step.detail}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="intro-splash-section intro-splash-contrast">
            <div className="intro-splash-wrap">
              <div className="intro-splash-head">
                <span className="intro-splash-kicker">Everything handled</span>
                <h2>A real campaign—not another list.</h2>
                <p>We combine the data, targeting, calling, and reporting needed to activate the neighborhood.</p>
              </div>
              <div className="intro-splash-included">
                {INCLUDED.map((item) => (
                  <div key={item.title} className="intro-splash-include">
                    <span className="intro-splash-check">✓</span>
                    <div>
                      <b>{item.title}</b>
                      <span>{item.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="intro-splash-section intro-splash-final">
            <div className="intro-splash-wrap intro-splash-final__card">
              <div>
                <h2>
                  Your next listing could be <span className="intro-splash-lime">one call away.</span>
                </h2>
                <p>Activate the 250 homeowners closest to your property today.</p>
              </div>
              <a className="intro-splash-cta" href="#intro-search">
                Start my ${INTRO_CAMPAIGN.priceUsd} campaign →
              </a>
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
