import { SeoHead, JsonLdOrg, JsonLdSite } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import {
  RzEditorialHero,
  RzProductUiSection,
  RzProofRail,
  RzLeadShowcase,
  RzCircleShowcase,
  RzWorkflowRail,
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
        title="Circle Prospecting AI | Real Estate Leads & Automated Prospecting"
        description="Buy real estate lead packs and launch neighborhood campaigns around new listings—in one client-friendly place with clear pricing and simple file delivery."
        path="/"
      />
      <JsonLdSite />
      <JsonLdOrg />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" className="home-main rz-home-rez" tabIndex={-1}>
          <RzEditorialHero />
          <RzProductUiSection />
          <RzProofRail />
          <RzLeadShowcase />
          <RzWorkflowRail />
          <RzCircleShowcase />
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
