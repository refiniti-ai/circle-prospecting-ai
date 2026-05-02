import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { CampaignPricingSection, CircleProductSection } from "../components/marketing/MarketingSections";

export function CampaignPricingPage() {
  return (
    <MarketingPageShell
      title="Campaign pricing | Circle Prospecting AI"
      description="Per-home AI, Live, and Pro rates with volume bands. Server-verified totals at checkout."
      path="/campaign-pricing"
      heroTitle="Campaign pricing"
      heroLead="Transparent per-home pricing for circle prospecting. Your checkout session is priced on the server — never trust the browser."
    >
      <CampaignPricingSection />
      <CircleProductSection />
    </MarketingPageShell>
  );
}
