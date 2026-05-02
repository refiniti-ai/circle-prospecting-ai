import { Link } from "react-router-dom";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { HowItWorksSection } from "../components/marketing/MarketingSections";

export function HowItWorksPage() {
  return (
    <MarketingPageShell
      title="How it works | Circle Prospecting AI"
      description="From new listing detection to CRM handoff, radius selection, and secure checkout — the full delivery workflow."
      path="/how-it-works"
      heroTitle="How it works"
      heroLead="End-to-end flow for listings, GHL opportunities, lead packs, and circle prospecting — one stack, clear stages."
    >
      <HowItWorksSection />
      <section className="section home-section">
        <div className="container section-surface" style={{ textAlign: "center", padding: "1.5rem" }}>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Explore products and coverage next.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", justifyContent: "center" }}>
            <Link to="/leads" className="btn btn-primary">
              Lead packs
            </Link>
            <Link to="/coverage" className="btn btn-ghost">
              Coverage &amp; maps
            </Link>
            <Link to="/campaign-pricing" className="btn btn-ghost">
              Campaign pricing
            </Link>
            <Link to="/buy-leads" className="btn btn-ghost">
              Buy leads
            </Link>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
