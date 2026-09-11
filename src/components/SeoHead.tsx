import { Helmet } from "react-helmet-async";

import {
  SITE_OG_DESCRIPTION,
  SITE_OG_IMAGE,
  SITE_OG_IMAGE_HEIGHT,
  SITE_OG_IMAGE_WIDTH,
  SITE_OG_TITLE,
} from "../lib/siteMeta";
import { PRODUCTION_SITE_ORIGIN } from "../lib/siteUrl";

type Props = {
  title: string;
  description: string;
  path?: string;
  noindex?: boolean;
  /** Link-preview title (defaults to site name). */
  shareTitle?: string;
  /** Link-preview description (defaults to page description, then site OG copy). */
  shareDescription?: string;
};

const siteUrl = PRODUCTION_SITE_ORIGIN;

/** SEO + Open Graph — Helmet replaces index.html tags after load (fixes duplicate/conflict on mobile crawlers with JS). */
export function SeoHead({
  title,
  description,
  path = "/",
  noindex,
  shareTitle = SITE_OG_TITLE,
  shareDescription,
}: Props) {
  const url = `${siteUrl}${path === "/" ? "" : path}`;
  const ogDescription = shareDescription ?? description ?? SITE_OG_DESCRIPTION;

  return (
    <Helmet>
      <html lang="en" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex" />}
      <meta property="og:site_name" content={SITE_OG_TITLE} />
      <meta property="og:title" content={shareTitle} />
      <meta property="og:description" content={ogDescription} />
      <meta property="og:image" content={SITE_OG_IMAGE} />
      <meta property="og:image:secure_url" content={SITE_OG_IMAGE} />
      <meta property="og:image:type" content="image/jpeg" />
      <meta property="og:image:width" content={SITE_OG_IMAGE_WIDTH} />
      <meta property="og:image:height" content={SITE_OG_IMAGE_HEIGHT} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={shareTitle} />
      <meta name="twitter:description" content={ogDescription} />
      <meta name="twitter:image" content={SITE_OG_IMAGE} />
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
