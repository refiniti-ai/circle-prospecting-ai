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
                  This is placeholder copy. Replace with counsel-approved language. Contact{" "}
                  <a href="mailto:legal@circleprospecting.ai">legal@circleprospecting.ai</a> for the latest version.
                </p>
                <h2>Summary</h2>
                <p>
                  Circle Prospecting AI provides prospecting and workflow tooling for real estate teams. We process listing and
                  contact data in line with your instructions and service agreements{isPrivacy ? ", and we take privacy seriously" : ""}.
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
