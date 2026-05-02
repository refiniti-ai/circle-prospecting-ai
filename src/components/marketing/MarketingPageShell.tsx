import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SeoHead } from "../SeoHead";
import { SiteHeader } from "../SiteHeader";
import { SiteFooter } from "../SiteFooter";

type Props = {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  heroTitle: string;
  heroLead?: string;
  children: ReactNode;
};

export function MarketingPageShell({ title, description, path, noindex, heroTitle, heroLead, children }: Props) {
  return (
    <>
      <SeoHead title={title} description={description} path={path} noindex={noindex} />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="rzInterior page-space page-space--tight rezora-page-main">
          <div className="container">
            <header className="page-hero">
              <p className="page-breadcrumb">
                <Link to="/">Home</Link> / {heroTitle}
              </p>
              <h1 className="page-h1 page-h1--gradient">{heroTitle}</h1>
              {heroLead ? <p className="page-lead" style={{ maxWidth: 720 }}>{heroLead}</p> : null}
            </header>
          </div>
          {children}
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
