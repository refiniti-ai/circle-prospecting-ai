import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";

type Kind = "privacy" | "terms";

export function Legal({ kind }: { kind: Kind }) {
  const isPrivacy = kind === "privacy";
  const title = isPrivacy ? "Privacy Policy" : "Terms of Service";
  return (
    <>
      <SeoHead
        title={`${title} | Circle Prospecting AI`}
        description="Legal information for Circle Prospecting AI."
        path={isPrivacy ? "/privacy" : "/terms"}
      />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space rzInterior">
          <div className="container page-narrow">
            <div className="section-surface" style={{ padding: "clamp(1.5rem, 3vw, 2.25rem)" }}>
              <p className="page-breadcrumb" style={{ marginBottom: "0.75rem" }}>
                <a href="/">Home</a> / {title}
              </p>
              <h1 className="page-h1" style={{ marginTop: 0 }}>{title}</h1>
              <div className="page-prose">
                <p>
                  <strong>Draft summary only.</strong> Final Privacy Policy and Terms of Service must be reviewed and approved by your
                  counsel. For the official version, contact{" "}
                  <a href="mailto:legal@circleprospecting.ai">legal@circleprospecting.ai</a>.
                </p>
                <h2>Summary</h2>
                <p>
                  Circle Prospecting AI provides done-for-you neighborhood marketing around real estate listings and sales—workflow,
                  checkout, and data handling tied to those campaigns. We process listing and contact data as described in your service
                  agreement{isPrivacy ? "; this draft highlights how we approach privacy" : ""}.
                </p>
                <h2>Contact</h2>
                <p>
                  Circle Prospecting AI — inquiries: <a href="mailto:hello@circleprospecting.ai">hello@circleprospecting.ai</a>
                </p>
              </div>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
