import type { StatIconId } from "./icons";

export const MARKETING_IMG = {
  hero: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=2000&q=86",
  modern: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=86",
  pool: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1400&q=85",
  skyline: "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=1400&q=85",
  before: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=85",
};

export const STEPS: { n: string; t: string; d: string }[] = [
  {
    n: "01",
    t: "New listing lands",
    d: "You send us the listing (or plug in your feed). We store the property and count how many neighbors sit inside each radius you sell.",
  },
  {
    n: "02",
    t: "Your CRM stays in the loop",
    d: "Contacts and stages flow into Go High Level or your tools—so Ops sees the same story the agent pitched at the kitchen table.",
  },
  {
    n: "03",
    t: "Agent picks the farm",
    d: "They choose the ring around the listing and the plan tier. Pricing always comes from your rate card—nothing typed by hand at checkout.",
  },
  {
    n: "04",
    t: "Pay, download, go",
    d: "They check out when ready, grab their CSV from the dashboard, or buy lead packs alongside circle runs—everything in one client space.",
  },
];

export const BLOG_CARDS: { title: string; date: string; image: string; href: string }[] = [
  {
    title: "Circle drops without wrecking CRM hygiene",
    date: "April 2025",
    image: MARKETING_IMG.modern,
    href: "/content",
  },
  {
    title: "From listing webhook to Stripe checkout",
    date: "March 2025",
    image: MARKETING_IMG.skyline,
    href: "/content",
  },
];

export const STAT_BAR: { v: string; k: string; s: string; icon: StatIconId }[] = [
  { v: "99%", k: "Files delivered", s: "Exports + dashboard", icon: "trend" },
  { v: "5M+", k: "Leads moved", s: "Through checkout", icon: "contacts" },
  { v: "1,200+", k: "Teams live", s: "Brokers & investors", icon: "homes" },
  { v: "100%", k: "Card checkout", s: "Test or live mode", icon: "subdivision" },
];

/** Grayscale “logo strip” names (illustrative — replace with partner marks as needed). */
export const TRUST_BRANDS: string[] = [
  "Coldwell Banker",
  "Compass",
  "Keller Williams",
  "RE/MAX",
  "Sotheby's",
  "eXp Realty",
];

/** Homepage proof rail */
export const REZ_PROOF_LINE: { num: string; label: string }[] = [
  { num: "99%", label: "Files delivered on time" },
  { num: "5M+", label: "Leads routed" },
  { num: "1,200+", label: "Teams using it" },
  { num: "4.9/5", label: "Avg. customer rating" },
];

export const REZ_SHOWCASE_LEADS = {
  kicker: "Lead packs",
  title: "Buy lists your team can trust—not recycled names.",
  lead:
    "You set up the market once. Buyers pick a pack size, pay by card, and download rows that were held for them—no accidental double-sells.",
  bullets: [
    "Fields that match how you actually work in MLS, spreadsheets, or GHL",
    "Each paid order locks in unique rows—not the same homeowner sold twice",
    "A simple client area to grab CSVs anytime",
  ],
};

export const REZ_SHOWCASE_CIRCLE = {
  kicker: "Neighborhood outreach",
  title: "When a listing hits, the map is ready for your pitch.",
  lead:
    "Drop in a listing and agents get one link with rings around the home, live counts, and clear per-home pricing from your own rate card.",
  bullets: [
    "Rings that match how you explain the farm on the listing call",
    "Totals update if they widen or shrink the area",
    "One branded link—no copy-paste chaos",
  ],
};

export const SOCIAL_PROOF: { n: string; d: string }[] = [
  { n: "20K+", d: "Leads delivered" },
  { n: "1,200+", d: "Active customers" },
  { n: "50+", d: "Markets covered" },
  { n: "4.9/5", d: "Customer rating" },
];

export const INTEGRATION_SLOTS: string[] = [
  "Stripe",
  "Go High Level",
  "Zapier",
  "Google Maps",
  "Firebase",
  "CSV / SFTP",
  "Webhooks",
  "JWT / SSO-ready",
];

export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "How fast can we go live?",
    a: "Many teams plug in Stripe, upload a tier sheet, and try a sandbox order on day one. Bigger brokers usually stage markets first—we’ll walk through it.",
  },
  {
    q: "Where do the checkout numbers come from?",
    a: "Your published price grid lives on our server. The screen shows what the shopper will pay, but totals are finalized when they check out—not guessed in the browser.",
  },
  {
    q: "Can clients sign in with our existing login?",
    a: "The dashboard uses a token today so you can test quickly. Swap in your own sign-in vendor when you are ready.",
  },
  {
    q: "What happens to lead rows after purchase?",
    a: "Paid rows appear in their dashboard until you decide otherwise. Tell us how long you want to keep exports and we’ll mirror that.",
  },
];

export const COMPARE_WITHOUT: string[] = [
  "Structured fields your CRM can ingest without manual cleanup passes",
  "Server-held allocation — each paid row is reserved, not duplicated",
  "Stripe checkout with totals computed off your tier grid — not pasted rates",
];

export const COMPARE_WITH: string[] = [
  "Broker-led teams provisioning subdivisions and farms every week",
  "Investors and wholesalers who refuse duplicate-sold records",
  "Ops leaders standardizing webhook → CSV → GHL pushes nationwide",
];

/** Paired with `TESTIMONIALS` by index for the homepage testimonial rail. */
export const TESTIMONIAL_SHOWCASE_METRICS: { headline: string; label: string; caption: string }[] = [
  {
    headline: "4.9/5",
    label: "Avg. team sentiment",
    caption: "From onboarding calls—not a generic widget score.",
  },
  {
    headline: "12 hrs",
    label: "To sandbox checkout",
    caption: "Stripe test mode plus your tier sheet, same afternoon.",
  },
  {
    headline: "2×",
    label: "Cleaner handoffs",
    caption: "One link from listing to paid export—fewer orphaned sheets.",
  },
];

export const TESTIMONIALS: { quote: string; name: string; role: string; accent?: boolean }[] = [
  {
    quote: "“Finally one link that matches what we promised on circle prospecting—not another orphaned spreadsheet.”",
    name: "Jordan Lee",
    role: "Managing Partner, Meridian Land Co.",
  },
  {
    quote: "“Card checkout plus a straightforward client portal made legal happy enough to approve it.”",
    name: "Priya Desai",
    role: "Director of Ops, Bayline Realty",
    accent: true,
  },
  {
    quote: "“Half-mile visuals that line up with our farm saved us from building maps ourselves.”",
    name: "Marcus Chen",
    role: "Lead Broker, Lighthouse Group",
  },
];
