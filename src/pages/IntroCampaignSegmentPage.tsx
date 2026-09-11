import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import {
  INTRO_CAMPAIGN,
  draftFromSearchResult,
  saveIntroCampaignDraft,
  type IntroCampaignDraft,
} from "../lib/introCampaign";
import { firstTimeCustomerAgentPath } from "../lib/introAgentPhone";
import { introPromoMlsPath, parseFirstTimeCustomerSegment } from "../lib/introDeepLink";
import { introListingLoadErrorMessage, resolveIntroListingByMls } from "../lib/introMlsListing";
import {
  agentRoleFromCampaignPath,
  campaignTypeFromPathSegment,
  type MlsCampaignPathSegment,
} from "../lib/mlsCampaignPath";
import { IntroCampaignCheckout } from "./IntroCampaignCheckout";
import "./intro-campaign.css";

function applyIntroCampaignPath(
  draft: IntroCampaignDraft,
  campaign: MlsCampaignPathSegment
): IntroCampaignDraft {
  const campaignType = campaignTypeFromPathSegment(campaign);
  const agentRole = agentRoleFromCampaignPath(campaign);
  return {
    ...draft,
    campaignType,
    agentRole,
    listing: { ...draft.listing, campaignType },
  };
}

/** $99 intro MLS checkout — `/99promo/{listed|seller|buyer}/mls/:mls` */
export function IntroCampaignMlsPage({ campaign }: { campaign: MlsCampaignPathSegment }) {
  const { mls: mlsParam } = useParams();
  const [searchParams] = useSearchParams();
  const mls = mlsParam?.trim() ?? "";
  const contactId = searchParams.get("c")?.trim() || searchParams.get("contactId")?.trim() || "";
  const [loadingMls, setLoadingMls] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [mlsReady, setMlsReady] = useState(false);
  const [loadedDraft, setLoadedDraft] = useState<IntroCampaignDraft | null>(null);
  const seoPath = introPromoMlsPath(mls, campaign);

  useEffect(() => {
    if (!mls) return;
    const ac = new AbortController();
    setLoadingMls(true);
    setLoadError(null);
    setMlsReady(false);
    setLoadedDraft(null);
    (async () => {
      try {
        const listing = await resolveIntroListingByMls(mls, {
          signal: ac.signal,
          contactId: contactId || null,
        });
        if (ac.signal.aborted) return;
        const draft = applyIntroCampaignPath(
          draftFromSearchResult({ kind: "listing", listing }),
          campaign
        );
        saveIntroCampaignDraft(draft);
        setLoadedDraft(draft);
        setMlsReady(true);
      } catch (e) {
        if (ac.signal.aborted) return;
        setLoadError(introListingLoadErrorMessage(e, mls));
      } finally {
        if (!ac.signal.aborted) setLoadingMls(false);
      }
    })();
    return () => ac.abort();
  }, [campaign, mls, contactId, retryNonce]);

  if (!mls) {
    return <Navigate to={INTRO_CAMPAIGN.path} replace />;
  }

  if (loadingMls) {
    return (
      <>
        <SeoHead
          title={`Loading MLS ${mls} — $99 intro campaign | Circle Prospecting AI`}
          description="Loading your listing for the $99 first-time neighborhood campaign."
          path={seoPath}
        />
        <div className="app-shell rz-shell rz-app intro-campaign-page intro-flyer-page">
          <SiteHeader />
          <main id="main-content" tabIndex={-1} className="intro-campaign-main">
            <section className="intro-flyer-hero intro-flyer-hero--client-banner">
              <div className="container intro-flyer-loading">
                <p className="intro-flyer-loading__text">Loading listing {mls}…</p>
                <p className="intro-flyer-loading__sub muted">
                  Preparing your $99 neighborhood campaign. During a busy send this can take a little longer — we’ll keep trying.
                </p>
              </div>
            </section>
          </main>
          <SiteFooter />
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <SeoHead
          title={`MLS ${mls} — $99 intro campaign | Circle Prospecting AI`}
          description="Load your listing for the $99 first-time neighborhood campaign."
          path={seoPath}
        />
        <div className="app-shell rz-shell rz-app intro-campaign-page intro-flyer-page">
          <SiteHeader />
          <main id="main-content" tabIndex={-1} className="intro-campaign-main">
            <section className="intro-flyer-hero intro-flyer-hero--client-banner">
              <div className="container intro-flyer-loading">
                <p className="intro-flyer-loading__text">Couldn’t load listing {mls}</p>
                <p className="intro-flyer-loading__sub muted">{loadError}</p>
                <div className="intro-flyer-loading__actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setRetryNonce((n) => n + 1)}
                  >
                    Try again
                  </button>
                  <Link to={INTRO_CAMPAIGN.path} className="btn btn-ghost">
                    Search instead
                  </Link>
                </div>
              </div>
            </section>
          </main>
          <SiteFooter />
        </div>
      </>
    );
  }

  if (mlsReady && loadedDraft) {
    return <IntroCampaignCheckout seoPath={seoPath} initialDraft={loadedDraft} />;
  }

  return (
    <div className="app-shell rz-shell rz-app intro-campaign-page intro-flyer-page">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="intro-campaign-main">
        <section className="intro-flyer-hero intro-flyer-hero--client-banner">
          <div className="container intro-flyer-loading">
            <p className="intro-flyer-loading__text">Couldn’t load listing {mls}</p>
            <div className="intro-flyer-loading__actions">
              <button type="button" className="btn btn-primary" onClick={() => setRetryNonce((n) => n + 1)}>
                Try again
              </button>
              <Link to={INTRO_CAMPAIGN.path} className="btn btn-ghost">
                Search instead
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

/** Legacy `/first-time-customer/:segment` → `/99promo/...` (preserves query string). */
export function IntroCampaignSegmentPage() {
  const { segment } = useParams();
  const { search } = useLocation();
  const parsed = segment ? parseFirstTimeCustomerSegment(segment) : null;
  if (!parsed) return <Navigate to={`${INTRO_CAMPAIGN.path}${search}`} replace />;
  if (parsed.kind === "phone") {
    return <Navigate to={`${firstTimeCustomerAgentPath(parsed.phone)}${search}`} replace />;
  }
  return <Navigate to={`${introPromoMlsPath(parsed.mls, "listed")}${search}`} replace />;
}
