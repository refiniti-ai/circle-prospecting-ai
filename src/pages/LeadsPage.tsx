import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { LeadsProductSection, SocialProofSection } from "../components/marketing/MarketingSections";

export function LeadsPage() {
  return (
    <MarketingPageShell
      title="Product | Circle Prospecting AI"
      description="We contact homeowners for you—data, AI dialing, and live callers. Conversations and appointments back to your team, with per-home pricing and a secure dashboard."
      path="/leads"
      heroTitle="What we deliver"
      heroLead="A done-for-you prospecting engine: lists + AI outreach + optional live appointment setters. We own the dialer; you own the deals. Checkout locks scope; your dashboard shows delivery."
    >
      <LeadsProductSection />
      <SocialProofSection />
    </MarketingPageShell>
  );
}
