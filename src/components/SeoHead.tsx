import { Helmet } from "react-helmet-async";

import { PRODUCTION_SITE_ORIGIN } from "../lib/siteUrl";

type Props = {
  title: string;
  description: string;
  path?: string;
  noindex?: boolean;
};

const siteUrl = PRODUCTION_SITE_ORIGIN;

/** Open Graph / link previews are defined only in index.html (static). */
export function SeoHead({ title, description, path = "/", noindex }: Props) {
  const url = `${siteUrl}${path === "/" ? "" : path}`;

  return (
    <Helmet>
      <html lang="en" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex" />}
    </Helmet>
  );
}

export function JsonLdSite() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Circle Prospecting AI",
    url: siteUrl,
    description:
      "Circle Prospecting AI runs homeowner outreach for you—data, AI dialing, and live callers to create conversations and appointments in your market.",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/#contact`,
      "query-input": "optional",
    },
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Helmet>
  );
}

export function JsonLdOrg() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Circle Prospecting AI",
    url: siteUrl,
    logo: `${siteUrl}/circle-prospecting-logo.png`,
    sameAs: [],
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Helmet>
  );
}
