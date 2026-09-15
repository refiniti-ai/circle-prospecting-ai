import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { BuyListingPropertyCard } from "../components/BuyListingPropertyCard";
import { BuyMapPreviewCard } from "../components/BuyMapPreviewCard";
import { BuyOrderTrustStrip } from "../components/BuyOrderTrustStrip";
import { IntroCampaignSinglePlanCard } from "../components/intro/IntroCampaignSinglePlanCard";
import { IntroCampaignOrderSummary } from "../components/intro/IntroCampaignOrderSummary";
import { IntroCampaignCheckoutReview } from "../components/intro/IntroCampaignCheckoutReview";
import { useIntroCampaignMapPreview } from "../components/intro/useIntroCampaignMapPreview";
import {
  INTRO_CAMPAIGN,
  readIntroCampaignDraft,
  startIntroCheckout,
  type IntroCampaignDraft,
} from "../lib/introCampaign";
import { trackFirstPromoterReferral } from "../lib/firstPromoter";
import { resolveListingDisplayFields } from "../lib/buyListingDisplay";
import {
  DEFAULT_LISTING_RADIUS_ID,
  formatListingDisplayAddress,
  radiusMilesFromId,
  radiusRingLabel,
} from "../lib/listingData";
import { resolveRealMls } from "../lib/listingDraft";
import { introPromoMlsPath } from "../lib/introDeepLink";
import { parseCampaignPathFromUrl, resolveCampaignPath } from "../lib/mlsCampaignPath";
import { reportCheckoutCanceled } from "../lib/leadsApi";
import { notifyError } from "../lib/notify";
import "./intro-campaign.css";
import "./buy-leads.css";

export function IntroCampaignCheckout({
  seoPath,
  initialDraft,
}: { seoPath?: string; initialDraft?: IntroCampaignDraft | null } = {}) {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const storedDraft = useMemo(() => readIntroCampaignDraft(), []);
  const draft = initialDraft ?? storedDraft;
  const [email, setEmail] = useState(draft?.form.email.trim() ?? "");
  const [phone, setPhone] = useState(draft?.form.phone.trim() ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!draft) {
      navigate(INTRO_CAMPAIGN.path, { replace: true });
    }
  }, [draft, navigate]);

  useEffect(() => {
    if (sp.get("canceled") !== "1") return;
    notifyError("Checkout was canceled. Your listing is still saved — try again when ready.");
    const fromUrl = sp.get("session_id")?.trim() || "";
    let fromStore = "";
    try {
      fromStore = sessionStorage.getItem("cpai_checkout_session") || "";
    } catch {
      /* ignore */
    }
    const sessionId = fromUrl || fromStore;
    if (sessionId) {
      try {
        sessionStorage.removeItem("cpai_checkout_session");
      } catch {
        /* ignore */
      }
      void reportCheckoutCanceled(sessionId).catch(() => {});
    }
  }, [sp]);

  const scrollToCheckout = useCallback(() => {
    document.getElementById("intro-checkout-step")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (!draft) return null;

  const { listing, form } = draft;
  const campaignType = draft.campaignType ?? "just_listed";
  const campaignPath =
    draft.campaignPath ??
    parseCampaignPathFromUrl(seoPath ?? "") ??
    resolveCampaignPath({
      agentRole: draft.agentRole,
      listingType: listing.listingType,
      pathSegment: draft.campaignType === "just_sold" ? "seller" : "listed",
    });
  const campaignDisplay = resolveListingDisplayFields(form, listing, campaignType, campaignPath);
  const radiusId = DEFAULT_LISTING_RADIUS_ID;
  const selectedRing = listing.radii[radiusId] ?? {
    label: "1/4 Mile",
    count: INTRO_CAMPAIGN.homes,
  };
  const radiusLabel = radiusRingLabel(radiusId, selectedRing.label);
  const { mapLat, mapLng, mapHasCoords, locatingMap, mapNotice } = useIntroCampaignMapPreview(draft);
  const listingAddress = formatListingDisplayAddress(form) || listing.address.trim();

  async function onCheckout() {
    if (!draft) return;
    if (!email.includes("@")) {
      notifyError("Enter a valid email.");
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      notifyError("Enter a valid phone number (at least 10 digits).");
      return;
    }
    setBusy(true);
    try {
      const mls = resolveRealMls(form.mls, listing.mls) || "";
      const { url, sessionId } = await startIntroCheckout(email.trim(), phone.trim(), {
        city: form.city.trim() || listing.cityStateZip,
        county: draft.county.trim() || listing.county,
        zip: form.zip.trim() || listing.zip,
        radiusMiles: radiusMilesFromId(radiusId),
        campaignType: draft.campaignType,
        agentRole: draft.agentRole,
        mls,
        listingAddress,
        agentName: form.agentName.trim() || listing.agentName,
        brokerage: form.brokerage.trim() || listing.brokerage,
        radiusLabel: "Intro 250 pack",
        pagePath: introPromoMlsPath(mls, campaignPath),
      });
      if (sessionId) sessionStorage.setItem("cpai_checkout_session", sessionId);
      trackFirstPromoterReferral(email.trim());
      window.location.assign(url);
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Checkout could not start.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SeoHead
        title="First-time offer checkout | Circle Prospecting AI"
        description={`Secure checkout — $${INTRO_CAMPAIGN.priceUsd} for ${INTRO_CAMPAIGN.homes} homeowners with professional live callers.`}
        path={seoPath ?? INTRO_CAMPAIGN.checkoutPath}
        noindex
      />
      <div className="app-shell rz-shell rz-app intro-campaign-page intro-checkout-page buy-leads-page">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="intro-campaign-main">
          <div className="container buy-wrap">
            <header className="intro-checkout__head">
              <p className="intro-kicker">First-time customer offer</p>
              <h1 className="intro-checkout__title">Build your intro campaign</h1>
              <p className="muted">
                <Link to={INTRO_CAMPAIGN.path}>← Back to offer</Link>
                {" · "}
                <Link to="/buy-leads">Regular pricing</Link>
              </p>
            </header>

            <section id="buy-listing-loaded" className="buy-mockup-hero">
              <BuyListingPropertyCard
                listing={listing}
                form={form}
                campaignType={campaignType}
                campaignPath={campaignPath}
                radiusId={radiusId}
                radiusLabel={radiusLabel}
                radiusCount={INTRO_CAMPAIGN.homes}
              />
              <BuyMapPreviewCard
                listing={listing}
                form={form}
                campaignType={campaignType}
                campaignPath={campaignPath}
                radiusId={radiusId}
                selectedRing={{ label: selectedRing.label, count: INTRO_CAMPAIGN.homes }}
                mapHasCoords={mapHasCoords}
                mapLat={mapLat}
                mapLng={mapLng}
                mapPreviewRadius={radiusId}
                mapPreviewRadiusMiles={radiusMilesFromId(radiusId)}
                mapPreviewRadiusLabel={radiusLabel}
                locatingMap={locatingMap}
                mapNotice={mapNotice}
              />
              <div className="buy-mockup-hero__summary">
                <IntroCampaignOrderSummary
                  listing={listing}
                  form={form}
                  campaignLabel={campaignDisplay.campaignPrefix}
                  campaignType={campaignType}
                  campaignPath={campaignPath}
                  radiusId={radiusId}
                  radiusLabel={selectedRing.label}
                  onContinue={scrollToCheckout}
                  busy={busy}
                />
              </div>
            </section>

            <IntroCampaignSinglePlanCard />

            <IntroCampaignCheckoutReview
              listing={listing}
              form={form}
              campaignLabel={campaignDisplay.campaignLabel}
              radiusId={radiusId}
              radiusLabel={selectedRing.label}
              email={email}
              phone={phone}
              onEmailChange={setEmail}
              onPhoneChange={setPhone}
              busy={busy}
              onCheckout={() => void onCheckout()}
            />

            <BuyOrderTrustStrip />
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
