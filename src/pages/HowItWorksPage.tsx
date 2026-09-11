import { Link } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { HowItWorksInfographic } from "../components/marketing/HowItWorksInfographic";
export function HowItWorksPage() {
  return (
    <>
      <SeoHead
        title="How it works | Circle Prospecting AI"
        description="Six steps from MLS listing to homeowner conversations: target area, audience build, live + AI outreach, and opportunities back to you."
        path="/how-it-works"
      />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="rzInterior hiw-page">
          <div className="container hiw-page__crumb">
            <p className="page-breadcrumb">
              <Link to="/">Home</Link> / How it works
            </p>
          </div>
          <HowItWorksInfographic />
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
