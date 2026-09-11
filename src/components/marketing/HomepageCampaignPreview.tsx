import { Link } from "react-router-dom";
import { buildMlsLeadsUrl } from "../../lib/mlsUrl";
import { DEMO_MLS_ID, HOMEPAGE_CAMPAIGN_PREVIEW } from "./marketingData";
import "./homepage-campaign-preview.css";

/** Homepage hero visual — client checkout screenshot; links to canonical MLS URL. */
export function HomepageCampaignPreview() {
  return (
    <Link
      to={buildMlsLeadsUrl(DEMO_MLS_ID, { campaign: "just_listed" })}
      className="rz-home-campaign-preview"
      aria-label={`Open example listing checkout for MLS ${DEMO_MLS_ID}`}
    >
      <img
        src={HOMEPAGE_CAMPAIGN_PREVIEW}
        alt="Circle Prospecting AI checkout: select target area, choose service, enter campaign contact info, and review checkout for MLS TB8502524."
        width={1400}
        height={900}
        loading="eager"
        decoding="async"
      />
    </Link>
  );
}
