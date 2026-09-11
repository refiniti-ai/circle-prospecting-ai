import { SeoHead, JsonLdOrg, JsonLdSite } from "../components/SeoHead";
import { SITE_META_DESCRIPTION, SITE_OG_DESCRIPTION } from "../lib/siteMeta";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { PricingProductSheetSection } from "../components/marketing/PosterSections";
import { BrokerageTrustCarousel } from "../components/marketing/BrokerageTrustCarousel";
import { IntroCampaignPromoBand } from "../components/intro/IntroCampaignPromoBand";
import {
  RzEditorialHero,
  RzPositioningStrip,
  RzProofRail,
  RzDifferentiationSection,
  RzProductLanesSection,
  RzProductUiSection,
  RzLeadShowcase,
  RzWorkflowRail,
  RzCircleShowcase,
  RzMidCtaBand,
  FaqSection,
} from "../components/marketing/MarketingSections";

export function Home() {
  return (
    <>
      <SeoHead
        title="Circle Prospecting AI | We Call Your Market — Conversations & Appointments"
        description={SITE_META_DESCRIPTION}
        shareDescription={SITE_OG_DESCRIPTION}
        path="/"
      />
      <JsonLdSite />
      <JsonLdOrg />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" className="home-main rz-home-rez" tabIndex={-1}>
          <IntroCampaignPromoBand />
          <RzEditorialHero />
          <BrokerageTrustCarousel />
          <RzPositioningStrip />
          <RzProofRail />
          <RzDifferentiationSection />
          <RzProductLanesSection />
          <RzProductUiSection />
          <RzLeadShowcase />
          <RzWorkflowRail />
          <RzCircleShowcase />
          <PricingProductSheetSection showTestimonialStrip={false} />
          <RzMidCtaBand id="cta-mid" />
          <FaqSection animateOnScroll dark />
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
