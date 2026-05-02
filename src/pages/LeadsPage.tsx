import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { LeadsProductSection, SocialProofSection } from "../components/marketing/MarketingSections";

export function LeadsPage() {
  return (
    <MarketingPageShell
      title="Leads | Circle Prospecting AI"
      description="Inventory-grade real estate leads sold in packs. CSV delivery, Stripe checkout, and a secure client dashboard."
      path="/leads"
      heroTitle="Leads"
      heroLead="Structured lead inventory for serious operators: upload once, sell in packs, deliver by email with JWT-secured access and one-click CSV export."
    >
      <LeadsProductSection />
      <SocialProofSection />
    </MarketingPageShell>
  );
}
