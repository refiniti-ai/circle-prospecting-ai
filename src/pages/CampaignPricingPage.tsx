import { CampaignPricingFlyerFooter } from "../components/marketing/CampaignPricingFlyerFooter";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { CampaignPricingRedesign } from "../components/marketing/CampaignPricingRedesign";
import "./campaign-pricing.css";

export function CampaignPricingPage() {
  return (
    <MarketingPageShell
      title="Campaign pricing | Circle Prospecting AI"
      description="Agent sales product sheet: Live Callers, AI Outreach, Hybrid, and Data Only per-homeowner pricing. Dabble through Dominate volume bands."
      path="/campaign-pricing"
      heroTitle="Campaign pricing"
      heroLead="Per-homeowner rates by package—same tiers you see on the agent sales sheet and at checkout."
    >
      <div className="cp-pricing-page">
        <CampaignPricingRedesign />
      </div>
      <CampaignPricingFlyerFooter />
    </MarketingPageShell>
  );
}
