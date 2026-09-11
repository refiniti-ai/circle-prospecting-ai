import { Link } from "react-router-dom";
import { INTRO_CAMPAIGN } from "../../lib/introCampaign";

/** Homepage feature band — $99 first-time customer offer. */
export function IntroCampaignPromoBand() {
  return (
    <section className="intro-site-promo" aria-label="First-time customer special">
      <div className="container intro-site-promo__inner">
        <div className="intro-site-promo__copy">
          <p className="intro-site-promo__kicker">Limited-time first-time customer special</p>
          <h2 className="intro-site-promo__title">
            ${INTRO_CAMPAIGN.priceUsd} for {INTRO_CAMPAIGN.homes} homeowners — Live Callers
          </h2>
          <p className="intro-site-promo__lead">
            New to Circle Prospecting AI? We&apos;ll professionally call the {INTRO_CAMPAIGN.homes} homeowners
            closest to your newest listing or sale — one introductory purchase per email.
          </p>
        </div>
        <div className="intro-site-promo__cta-wrap">
          <Link to={INTRO_CAMPAIGN.path} className="btn btn-primary intro-site-promo__cta">
            Claim ${INTRO_CAMPAIGN.priceUsd} intro offer
          </Link>
          <p className="intro-site-promo__fine muted">First-time customers only · No contracts</p>
        </div>
      </div>
    </section>
  );
}
