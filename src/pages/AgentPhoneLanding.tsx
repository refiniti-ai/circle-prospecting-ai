import { useCallback, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { IntroCampaignSearch } from "../components/intro/IntroCampaignSearch";
import type { BuyLeadsSearchResult } from "../components/BuyLeadsSearch";
import { firstTimeCustomerAgentPath, normalizeAgentPhoneParam, searchAgentPath } from "../lib/introAgentPhone";
import { INTRO_CAMPAIGN } from "../lib/introCampaign";
import { buildMlsLeadsUrl } from "../lib/mlsUrl";
import { resolveCampaignPath } from "../lib/mlsCampaignPath";
import {
  agentRoleFromListingPayload,
  campaignPathFromListingPayload,
} from "../lib/ghlContactRole";
import { notifyError } from "../lib/notify";
import "./intro-campaign.css";

export function AgentPhoneLanding() {
  const navigate = useNavigate();
  const { agentPhone: agentPhoneParam } = useParams();
  const initialAgentPhone = agentPhoneParam ? normalizeAgentPhoneParam(agentPhoneParam) : undefined;

  useEffect(() => {
    if (!initialAgentPhone) return;
    document.getElementById("agent-search")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialAgentPhone]);

  const onSearchResult = useCallback(
    (result: BuyLeadsSearchResult) => {
      if (result.kind !== "listing") {
        notifyError("Pick a listing to continue.");
        return;
      }
      const listing = result.listing;
      const campaignPath =
        campaignPathFromListingPayload(listing) ??
        resolveCampaignPath({
          listingType: listing.listingType,
          agentType: listing.agentType,
          agentRole: agentRoleFromListingPayload(listing) ?? undefined,
        });
      navigate(buildMlsLeadsUrl(listing.mls, { campaignPath }), {
        state: { preloadedListing: listing },
      });
    },
    [navigate]
  );

  return (
    <>
      <SeoHead
        title="Find your latest listing or sale | Circle Prospecting AI"
        description="Search by agent phone to load your latest listing, sold, or buyer-side close — then order a neighborhood campaign."
        path={initialAgentPhone ? searchAgentPath(initialAgentPhone) : "/buy-leads"}
      />
      <div className="app-shell rz-shell rz-app intro-campaign-page">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="intro-campaign-main">
          <section id="agent-search" className="intro-flyer-search intro-flyer-search--mid">
            <div className="container">
              <h1 className="intro-flyer-search__title">Let&apos;s find your latest listing or sale</h1>
              <p className="intro-search__note intro-flyer-search__note intro-flyer-search__note--mid">
                Pick a listing — latest listing, sold, or buyer side close — then continue to checkout at regular
                pricing.
              </p>
              <IntroCampaignSearch
                className="intro-search__panel intro-search__panel--flyer"
                initialAgentPhone={initialAgentPhone}
                onResult={onSearchResult}
                onError={notifyError}
              />
              <p className="intro-search__note intro-flyer-search__note intro-flyer-search__note--mid">
                First-time customer?{" "}
                <Link to={initialAgentPhone ? firstTimeCustomerAgentPath(initialAgentPhone) : INTRO_CAMPAIGN.path}>
                  See the $99 introductory offer
                </Link>
                .
              </p>
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
