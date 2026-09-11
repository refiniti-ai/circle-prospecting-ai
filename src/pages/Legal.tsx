import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { privacyPolicy, termsAndConditions, type LegalDocument } from "../content/legalContent";

type Kind = "privacy" | "terms";

function contactHref(line: string): string | null {
  const t = line.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.includes("@")) return `mailto:${t}`;
  if (/^\+?[\d().\-\s]+$/.test(t)) return `tel:${t.replace(/[^\d+]/g, "")}`;
  return null;
}

function LegalDocumentPage({ doc, path }: { doc: LegalDocument; path: string }) {
  return (
    <>
      <SeoHead
        title={`${doc.pageTitle} | Circle Prospecting AI`}
        description={`${doc.pageTitle} for Circle Prospecting AI. Effective ${doc.effectiveDate}.`}
        path={path}
      />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space rzInterior">
          <div className="container page-narrow">
            <div className="section-surface" style={{ padding: "clamp(1.5rem, 3vw, 2.25rem)" }}>
              <p className="page-breadcrumb" style={{ marginBottom: "0.75rem" }}>
                <a href="/">Home</a> / {doc.pageTitle}
              </p>
              <h1 className="page-h1" style={{ marginTop: 0 }}>
                {doc.pageTitle}
              </h1>
              <p className="page-prose" style={{ marginTop: "0.5rem", color: "#64748b" }}>
                Effective Date: {doc.effectiveDate}
              </p>
              <div className="page-prose">
                {doc.intro ? <p>{doc.intro}</p> : null}
                {doc.sections.map((section) => (
                  <section key={section.title}>
                    <h2>{section.title}</h2>
                    {section.paragraphs.map((p) => (
                      <p key={p.slice(0, 48)}>{p}</p>
                    ))}
                  </section>
                ))}
                <h2>Contact</h2>
                {doc.contactLines.map((line) => {
                  const href = contactHref(line);
                  return (
                    <p key={line} style={{ margin: "0.25rem 0" }}>
                      {href ? (
                        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined}>
                          {line}
                        </a>
                      ) : (
                        line
                      )}
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}

export function Legal({ kind }: { kind: Kind }) {
  if (kind === "privacy") {
    return <LegalDocumentPage doc={privacyPolicy} path="/privacy-policy" />;
  }
  return <LegalDocumentPage doc={termsAndConditions} path="/terms-and-conditions" />;
}
