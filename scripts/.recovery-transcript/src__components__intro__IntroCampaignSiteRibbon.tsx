import { Link, useLocation } from "react-router-dom";
import { INTRO_CAMPAIGN } from "../../lib/introCampaign";

/** Slim site-wide ribbon — hidden on the intro funnel itself. */
export function IntroCampaignSiteRibbon() {
  const { pathname } = useLocation();
  if (pathname.startsWith(INTRO_CAMPAIGN.path)) return null;

  return (
    <aside className="intro-site-ribbon" aria-label="First-time customer promotion">
      <div className="container intro-site-ribbon__inner">
        <p className="intro-site-ribbon__text">
          <strong>First-time special:</strong> ${INTRO_CAMPAIGN.priceUsd} for {INTRO_CAMPAIGN.homes} homeowners with
          professional live callers.
        </p>
        <Link to={INTRO_CAMPAIGN.path} className="intro-site-ribbon__link">
          View offer →
        </Link>
      </div>
    </aside>
  );
}
