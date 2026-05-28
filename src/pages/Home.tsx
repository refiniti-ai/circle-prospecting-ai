import { SeoHead, JsonLdOrg, JsonLdSite } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { PricingProductSheetSection } from "../components/marketing/PosterSections";
import { BrokerageTrustCarousel } from "../components/marketing/BrokerageTrustCarousel";
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
        description="We contact homeowners around your Just Listed and Just Sold properties using live callers, AI calls, and ringless voicemail to promote you as the trusted local expert in the neighborhood."
        path="/"
      />
      <JsonLdSite />
      <JsonLdOrg />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" className="home-main rz-home-rez" tabIndex={-1}>
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
