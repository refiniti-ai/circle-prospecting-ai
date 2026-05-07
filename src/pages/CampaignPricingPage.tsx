import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { PricingProductSheetSection } from "../components/marketing/PosterSections";
import { CampaignPricingSection, CircleProductSection } from "../components/marketing/MarketingSections";

export function CampaignPricingPage() {
  return (
    <MarketingPageShell
      title="Campaign pricing | Circle Prospecting AI"
      description="Per-homeowner rates for data, AI, live, and hybrid lanes—volume packages and server-verified checkout."
      path="/campaign-pricing"
      heroTitle="Campaign pricing"
      heroLead="See cost per homeowner, pick your package band, and know your total before you pay. Strong programs often benchmark ~20+ conversations per ~10K homeowners—your mileage varies."
    >
      <PricingProductSheetSection />
      <CampaignPricingSection />
      <CircleProductSection />
    </MarketingPageShell>
  );
}
