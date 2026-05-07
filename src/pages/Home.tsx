import { SeoHead, JsonLdOrg, JsonLdSite } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { PricingProductSheetSection, SalesProcessInfographicSection } from "../components/marketing/PosterSections";
import {
  RzEditorialHero,
  RzPositioningStrip,
  RzPainSolutionSection,
  RzProofRail,
  RzDifferentiationSection,
  RzProductLanesSection,
  RzProductUiSection,
  RzLeadShowcase,
  RzWorkflowRail,
  RzCircleShowcase,
  RzTestimonialsFeatured,
  RzMidCtaBand,
  IntegrationsSection,
  CampaignPricingSection,
  FaqSection,
} from "../components/marketing/MarketingSections";

export function Home() {
  return (
    <>
      <SeoHead
        title="Circle Prospecting AI | We Call Your Market — Conversations & Appointments"
        description="Done-for-you real estate prospecting: homeowner data, AI dialing, and live callers contact your farm for you—conversations, appointments, and deals. Clear per-home pricing."
        path="/"
      />
      <JsonLdSite />
      <JsonLdOrg />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" className="home-main rz-home-rez" tabIndex={-1}>
          <RzEditorialHero />
          <RzPositioningStrip />
          <RzPainSolutionSection />
          <RzProofRail />
          <RzDifferentiationSection />
          <RzProductLanesSection />
          <RzProductUiSection />
          <RzLeadShowcase />
          <RzWorkflowRail />
          <SalesProcessInfographicSection />
          <RzCircleShowcase />
          <PricingProductSheetSection showTestimonialStrip={false} />
          <RzTestimonialsFeatured />
          <IntegrationsSection rezLayout darkBand animateOnScroll />
          <CampaignPricingSection animateOnScroll />
          <RzMidCtaBand id="cta-mid" />
          <FaqSection animateOnScroll dark />
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
