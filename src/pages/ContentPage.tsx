import { Link } from "react-router-dom";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { ContentBookSection } from "../components/marketing/MarketingSections";

export function ContentPage() {
  return (
    <MarketingPageShell
      title="Content & resources | Circle Prospecting AI"
      description="Book a walkthrough, download templates, and read policies for Circle Prospecting AI."
      path="/content"
      heroTitle="Content"
      heroLead="Schedule a demo with our team and access templates and legal resources."
    >
      <ContentBookSection />
      <section className="section home-section">
        <div className="container section-surface">
          <h2 className="premium-h2" style={{ marginTop: 0 }}>
            Resources
          </h2>
          <ul style={{ color: "var(--muted)", lineHeight: 2, paddingLeft: "1.25rem", margin: 0 }}>
            <li>
              <a href="/csv/lead-template.csv" download style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                Lead CSV template
              </a>{" "}
              (for admin uploads)
            </li>
            <li>
              <Link to="/buy-leads" style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                Start prospecting your area
              </Link>
            </li>
            <li>
              <Link to="/dashboard" style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                Client dashboard
              </Link>
            </li>
            <li>
              <Link to="/privacy" style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                Privacy policy
              </Link>
            </li>
            <li>
              <Link to="/terms" style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                Terms of service
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </MarketingPageShell>
  );
}
