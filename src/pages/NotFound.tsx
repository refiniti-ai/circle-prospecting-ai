import { Link } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";

export function NotFound() {
  return (
    <>
      <SeoHead title="Page not found | Circle Prospecting AI" description="The page you requested does not exist." noindex />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space rzInterior">
          <div className="container page-narrow">
            <div className="page-center-card">
              <h1 className="page-h1 page-h1--gradient" style={{ fontSize: "clamp(3rem, 10vw, 4.5rem)", margin: "0 0 0.5rem" }}>
                404
              </h1>
              <p className="page-lead" style={{ maxWidth: "100%" }}>
                We could not find that page. Return to the{" "}
                <Link to="/" style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                  home page
                </Link>
                .
              </p>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
