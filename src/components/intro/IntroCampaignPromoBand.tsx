import { Link } from "react-router-dom";
import { INTRO_CAMPAIGN } from "../../lib/introCampaign";
import "./intro-site-promo.css";

/** Homepage banner — first-time client $99 intro offer (links to /99promo). */
export function IntroCampaignPromoBand() {
  return (
    <section className="intro-site-promo" aria-label="First-time client campaign special">
      <div className="container intro-site-promo__inner">
        <div className="intro-site-promo__copy">
          <p className="intro-site-promo__kicker">First-time client · 1st Campaign Special</p>
          <h2 className="intro-site-promo__title">
            <span className="intro-site-promo__price">${INTRO_CAMPAIGN.priceUsd}</span>
            {" "}for {INTRO_CAMPAIGN.homes} homeowners — Live Callers only
          </h2>
          <p className="intro-site-promo__lead">
            We&apos;ll professionally call the {INTRO_CAMPAIGN.homes} homeowners closest to your newest listing or
            sale — no contracts.
          </p>
        </div>
        <div className="intro-site-promo__cta-wrap">
          <Link to={INTRO_CAMPAIGN.path} className="intro-site-promo__cta">
            Get your ${INTRO_CAMPAIGN.priceUsd} intro campaign
            <span aria-hidden> ›</span>
          </Link>
          <p className="intro-site-promo__fine">First-time customers only</p>
        </div>
      </div>
    </section>
  );
}
