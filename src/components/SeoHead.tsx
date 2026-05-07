import { Helmet } from "react-helmet-async";

type Props = {
  title: string;
  description: string;
  path?: string;
  noindex?: boolean;
};

const siteUrl = "https://circleprospecting.ai";

export function SeoHead({ title, description, path = "/", noindex }: Props) {
  const url = `${siteUrl}${path === "/" ? "" : path}`;

  return (
    <Helmet>
      <html lang="en" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
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
