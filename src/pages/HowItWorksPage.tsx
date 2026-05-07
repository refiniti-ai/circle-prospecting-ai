import { Link } from "react-router-dom";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { SalesProcessInfographicSection } from "../components/marketing/PosterSections";
import { HowItWorksSection } from "../components/marketing/MarketingSections";

export function HowItWorksPage() {
  return (
    <MarketingPageShell
      title="How it works | Circle Prospecting AI"
      description="Three steps: pick your target area, we contact homeowners with AI + live callers, you get conversations and opportunities—plus clear checkout."
      path="/how-it-works"
      heroTitle="How it works"
      heroLead="Choose your farm, we run the dials and messages on your behalf, and appointments flow back to you—data + dialer + humans in one motion."
    >
      <SalesProcessInfographicSection />
      <HowItWorksSection />
      <section className="section home-section">
        <div className="container section-surface" style={{ textAlign: "center", padding: "1.5rem" }}>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Explore products and coverage next.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", justifyContent: "center" }}>
            <Link to="/leads" className="btn btn-primary">
              Product overview
            </Link>
            <Link to="/coverage" className="btn btn-ghost">
              Coverage &amp; maps
            </Link>
            <Link to="/campaign-pricing" className="btn btn-ghost">
              Campaign pricing
            </Link>
            <Link to="/buy-leads" className="btn btn-ghost">
              Start prospecting your area
            </Link>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
