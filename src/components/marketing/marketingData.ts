import type { StatIconId } from "./icons";

/** Hero dashboard — Market Activity map (client asset). */
export const HERO_MARKET_ACTIVITY_MAP = "/marketing/hero-market-activity-map.png";

export const MARKETING_IMG = {
  hero: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=2000&q=86",
  modern: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=86",
  pool: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1400&q=85",
  skyline: "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=1400&q=85",
  before: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=85",
};

/** Homepage + How it works — client: dead-simple path to conversations */
export const WORKFLOW_SECTION_TITLE = "From Listings to Conversations in 3 Simple Steps";

export const STEPS: { n: string; t: string; d: string }[] = [
  {
    n: "01",
    t: "Select Radius around your Listing",
    d: "Pick your market center, radius, and filters—so every dial matches the pocket you actually farm.",
  },
  {
    n: "02",
    t: "We contact homeowners (AI + live callers)",
    d: "We call, voicemail, and text on your behalf—scaled AI outreach plus real humans when you need appointment-grade conversations.",
  },
  {
    n: "03",
    t: "You get conversations & opportunities",
    d: "Replies, callbacks, and booked appointments flow to you and your CRM—so you’re closing, not cold dialing.",
  },
];

export const BRAND_PLATFORM_LINE = "Just Listed & Just Sold neighborhood promotion";

export const POSITIONING_STRIP =
  "We combine live callers, AI calling, and ringless voicemail with 4-6 outreach attempts over a 14-day campaign to promote you as the trusted local real estate expert in the neighborhood.";

export const AGENT_PAIN_POINTS: string[] = [
  "Buying data but still stuck dialing yourself",
  "Postcards and ads don’t start real conversations",
  "VA teams and dialer tools need constant babysitting",
  "Batch / Geo / AI tools hand you lists—not outcomes",
  "Cold calling burns time you should spend on appointments",
  "Prospecting feels like a second job next to listings",
];

export const DFY_SOLUTION_BULLETS: string[] = [
  "Precision lists + targeting for your farm",
  "We contact homeowners using AI and live callers",
  "Calls, voicemail drops, and text—your brand on the line",
  "Conversations and callbacks routed to you",
  "Optional live appointment setters on full-service lanes",
  "One engine: data + dialer + humans — you focus on deals",
];

/** Product structure: Data vs AI vs Full service (homepage lanes). */
export const PRODUCT_LANES: readonly {
  badge: string;
  title: string;
  lead: string;
  outcomes: readonly string[];
}[] = [
  {
    badge: "Full service",
    title: "Live callers + appointment setting",
    lead: "Real reps extending your brand—dialogue, qualification, and booked appointments when you need white-glove execution.",
    outcomes: ["Human conversations—not blasts", "Calendar-ready opportunities", "Built for competitive markets"],
  },
  {
    badge: "AI outreach",
    title: "Calls + voicemail + text",
    lead: "High-volume touches on your behalf—AI dialing with voicemail and SMS so homeowners actually hear from you.",
    outcomes: ["Scaled coverage in your ring", "Consistent cadence without you on the headset", "More at-bats for conversations"],
  },
  {
    badge: "Data",
    title: "Lists + targeting",
    lead: "Homeowner intelligence for your radius—filters and counts so you’re not spraying a raw CSV at the market.",
    outcomes: ["Farm-ready homeowner records", "Radius + motivator targeting", "Exports your ops team can trust"],
  },
] as const;

/** Homepage command-center preview — in-app guide chat (illustrative). */
export const PRODUCT_UI_GUIDE_CHAT: readonly { role: "bot" | "user"; body: string }[] = [
  {
    role: "bot",
    body: "Want more conversations? We can widen the radius or add a live-caller lane for callbacks that need a human touch.",
  },
  { role: "user", body: "How many connects yesterday?" },
  {
    role: "bot",
    body: "182 live connects, 37 voicemail drops, 12 SMS threads—export the disposition file whenever your ISA team is ready.",
  },
  { role: "user", body: "Can we prioritize absentee owners in the 1-mile ring?" },
  {
    role: "bot",
    body: "Yes—toggle absentee + high-equity filters on this run. I’ll rebalance the dial queue so those homeowners hit first in the next batch.",
  },
  { role: "user", body: "Perfect—send me the updated homeowner count before tonight’s dial." },
  {
    role: "bot",
    body: "You’re set: 412 homeowners match absentee + high-equity in the 1-mile ring. I’ll drop the export link in your dashboard when the batch is queued.",
  },
  { role: "user", body: "Great—queue the live-caller lane for callbacks once the first pass finishes." },
  {
    role: "bot",
    body: "Queued. You’ll see live-caller dispositions in your dashboard as callbacks complete—export anytime for your ISA handoff.",
  },
] as const;

export const BLOG_CARDS: { title: string; date: string; image: string; href: string }[] = [
  {
    title: "When AI + live callers beat “just the data” for circle prospecting",
    date: "February 2026",
    image: MARKETING_IMG.modern,
    href: "/contact",
  },
  {
    title: "From radius pick to booked callbacks—what ops should expect",
    date: "January 2026",
    image: MARKETING_IMG.skyline,
    href: "/contact",
  },
];

/** Capability highlights for coverage / product pages */
export const STAT_BAR: { v: string; k: string; s: string; icon: StatIconId }[] = [
  { v: "Call", k: "We dial for you", s: "AI + live outreach lanes", icon: "trend" },
  { v: "Data", k: "Lists + targeting", s: "Radius & homeowner filters", icon: "contacts" },
  { v: "Appts", k: "Conversations", s: "Callbacks & booked meetings", icon: "homes" },
  { v: "DFY", k: "Execution", s: "Not another DIY dialer login", icon: "subdivision" },
];

export const TRUST_BRANDS: string[] = [
  "Independent agents",
  "Team leads",
  "Regional brokerages",
  "Growth-focused brokers",
  "Inside sales operators",
  "Ops & marketing directors",
];

/** Homepage “Trusted by…” carousel — add images under /public/logos/brokerages/ (see README there). */
export type BrokerageLogo = {
  id: string;
  name: string;
  src: string;
  alt: string;
};

export const BROKERAGE_LOGOS: BrokerageLogo[] = [
  {
    id: "remax",
    name: "RE/MAX",
    src: "/logos/brokerages/REMAX-logo.webp",
    alt: "RE/MAX",
  },
  {
    id: "coldwell-banker",
    name: "Coldwell Banker",
    src: "/logos/brokerages/Coldwell-Banker_logo.webp",
    alt: "Coldwell Banker",
  },
  {
    id: "homeservices",
    name: "HomeServices of America",
    src: "/logos/brokerages/HomeServices-of-America-logo.webp",
    alt: "HomeServices of America, a Berkshire Hathaway affiliate",
  },
  {
    id: "berkshire",
    name: "Berkshire Hathaway HomeServices",
    src: "/logos/brokerages/Berkshire-Hathaway-HomeServices-logo.webp",
    alt: "Berkshire Hathaway HomeServices",
  },
  {
    id: "exp",
    name: "eXp Realty",
    src: "/logos/brokerages/cropped-eXp-Realty-Logo.webp",
    alt: "eXp Realty",
  },
  {
    id: "anywhere",
    name: "Anywhere",
    src: "/logos/brokerages/AnywhereAdvisors_logo.webp",
    alt: "Anywhere Advisors",
  },
  {
    id: "weichert",
    name: "Weichert",
    src: "/logos/brokerages/weichert_logo.webp",
    alt: "Weichert Realtors",
  },
  {
    id: "sothebys",
    name: "Sotheby's International Realty",
    src: "/logos/brokerages/Sotheby-logo.webp",
    alt: "Sotheby's International Realty",
  },
];

export const TRUSTED_BROKERAGES_HEADLINE = "Trusted by World's Top Brokerages and Agents";

/**
 * Homepage proof rail — outcome + execution clarity.
 * Benchmark line is illustrative; real results vary by market and follow-up.
 */
export const REZ_PROOF_LINE: { num: string; label: string }[] = [
  { num: "500,000+", label: "Phone calls made across client campaigns" },
  { num: "1,500+", label: "Seller leads generated" },
  { num: "300+", label: "Closed deals created from those opportunities" },
  { num: "$4M+", label: "Commissions generated for clients" },
];

export const REZ_SHOWCASE_LEADS = {
  kicker: "14-day neighborhood campaign",
  title: "We promote you around every Just Listed and Just Sold property.",
  lead:
    "Over a 14-day campaign, we make 4-6 outreach attempts per listing using live callers, AI calls, and ringless voicemail to keep your name in front of nearby homeowners.",
  bullets: [
    "Homeowners around your listings hear from your brand, not just another postcard",
    "4-6 contact attempts per listing over a 14-day campaign",
    "Live callers, AI calling, and ringless voicemail in one coordinated system",
    "Built to position you as the trusted local expert in the neighborhood",
    "Designed to create more seller conversations and listing opportunities",
    "You focus on appointments and closings while we handle the outreach",
  ],
};

export const REZ_SHOWCASE_CIRCLE = {
  kicker: "Your farm, visualized",
  title: "See the homeowners around your listing before the campaign starts.",
  lead:
    "Start with subdivision, radius, or ZIP counts around every Just Listed and Just Sold property. Once you choose the market, we run the outreach so the story you tell sellers matches the activity happening in the neighborhood.",
  bullets: [
    "Radius ladders make it easy to explain neighborhood reach to clients",
    "Counts refresh before you lock budget and launch a campaign",
    "The same system works for listing-led outreach or broader geo farming",
  ],
};

export const SOCIAL_PROOF: { n: string; d: string }[] = [
  { n: "Conversations", d: "Callbacks, replies, and booked meetings—not just impressions" },
  { n: "Coverage", d: "Thousands of homeowner touches without you on the headset all day" },
  { n: "Speed", d: "Launch a market faster than hiring and training an ISA bench" },
  { n: "Clarity", d: "One vendor for data, dialer, and optional live callers" },
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
    q: "Do you actually call homeowners for me?",
    a: "Yes—that’s the core offer. We combine data, AI-powered dialing (including voicemail and SMS where configured), and optional live callers so outreach happens on your behalf. You focus on conversations and appointments that come back to you.",
  },
  {
    q: "How fast can we go live?",
    a: "Many teams connect billing, pick a lane (data / AI / full service), define a market, and start a test campaign quickly. Enterprise rollouts may pilot one metro first—we’ll align on compliance and scripts.",
  },
  {
    q: "Where do checkout numbers come from?",
    a: "Your published per-homeowner grid lives server-side. The browser shows estimates, but the charge is built on the server at checkout.",
  },
  {
    q: "Is this the same as buying a lead list?",
    a: "No. Lists are inputs. The product is executed outreach—calls and messages that create conversations. Exports may be part of ops, but the value is performance in your market, not a static CSV.",
  },
  {
    q: "How should I think about budget?",
    a: "Frame it as marketing + labor you’d spend on ISAs and dialers anyway—expressed as per-homeowner rates and volume bands. Your live checkout is always the source of truth.",
  },
  {
    q: "What about compliance and DNC?",
    a: "You’re responsible for brokerage / state compliance. We support structured targeting and documentation—run your review with counsel before scaling.",
  },
];

/** Legacy compare (subpages) — still “promotion vs commodity list” angle */
export const COMPARE_WITHOUT: string[] = [
  "Hand you data and expect you to dial it all",
  "Another login-heavy “AI dialer” with no live backup",
  "Generic blasts that don’t sound like your market",
];

export const COMPARE_WITH: string[] = [
  "Agents who want conversations—not another list purchase",
  "Teams pairing AI scale with live callers for tough markets",
  "Brokers standardizing “we call for you” prospecting nationwide",
];

/** Homepage: other platforms vs Circle (client differentiation block) */
export const DIFFERENTIATION_OTHER: string[] = [
  "Give you data — you still own the grind",
  "Sell tools — you manage scripts, VAs, and follow-up",
  "Look like every batch / geo / AI dialer stack",
  "Optimize for seats sold — not appointments in your market",
];

export const DIFFERENTIATION_OURS: string[] = [
  "Targets your market with precision",
  "Contacts homeowners for you — AI + live callers",
  "Turns outreach into conversations & opportunities",
  "One partner for data, dialer, and execution",
];

/** Paired with `TESTIMONIALS` by index */
export const TESTIMONIAL_SHOWCASE_METRICS: { headline: string; label: string; caption: string }[] = [
  {
    headline: "We dial",
    label: "AI + live coverage",
    caption: "Stop paying for data and still living on the phone—outreach runs as a service.",
  },
  {
    headline: "~20+",
    label: "Talk tracks per 10K",
    caption: "Benchmark conversation yield on strong campaigns—your market may differ.",
  },
  {
    headline: "1 stack",
    label: "Data · Dialer · Callers",
    caption: "Fewer vendors, clearer accountability, faster launches.",
  },
];

export const TESTIMONIALS: { quote: string; name: string; role: string; accent?: boolean }[] = [
  {
    quote: "“Finally someone else owns the dialer — we measure meetings booked, not rows in a spreadsheet.”",
    name: "Managing broker",
    role: "Multi-office team, Sun Belt",
  },
  {
    quote: "“Buyers hear a real story about our listings because the calls actually go out — not ‘we’ll get to that farm next quarter.’”",
    name: "Director of operations",
    role: "Regional brokerage",
    accent: true,
  },
  {
    quote: "“We kept buying lists from big data brands and still had ISAs quitting — this flips who does the boring part.”",
    name: "Team lead",
    role: "Metro market",
  },
];

/** Print-style pricing poster — package row labels (aligned to tier index). */
export const VOLUME_PACKAGE_LABELS: readonly string[] = [
  "Pay as you go",
  "Starter",
  "Growth",
  "Scale",
  "Scale+",
];

/** Data / export lane — planning rates for the sales sheet (confirm before purchase). */
export const POSTER_DATA_PER_HOME_FALLBACK: readonly number[] = [0.1, 0.1, 0.09, 0.08, 0.08];

export const POSTER_PILLARS: readonly { title: string; d: string; icon: "ai" | "live" | "leads" }[] = [
  { title: "Live callers", d: "Real conversations that build trust", icon: "live" },
  { title: "AI powered", d: "Smart targeting & intent scoring", icon: "ai" },
  { title: "Qualified opportunities", d: "Callbacks & appointments routed to you", icon: "leads" },
];

/** Sales-sheet style band (matches print one-pager). */
export const POSTER_SHEET_BENEFITS: readonly string[] = [
  "More listing conversations from radius coverage",
  "Stay top of mind around every new listing",
  "A scalable system—not a one-off list purchase",
];

export const POSTER_SHEET_QUOTE: { body: string; emphasis: string } = {
  body: "Circle Prospecting delivers conversations that turn into appointments and listings.",
  emphasis: "You close. We do the rest.",
};

export const POSTER_SHEET_PROMISE =
  "Committed to agent growth: clear per-home pricing, accountable execution, and outreach that carries your brand.";

export const POSTER_TESTIMONIALS_HEADLINE = "What agents say";

/** Illustrative homeowner counts for the radius strip (not a guarantee). Aligns with checkout rings. */
export const POSTER_RADIUS_BANDS: readonly { id: string; label: string; homes: string }[] = [
  { id: "subdivision", label: "Subdivision", homes: "128 homeowners" },
  { id: "q1", label: "¼ mile", homes: "214 homeowners" },
  { id: "h1", label: "½ mile", homes: "482 homeowners" },
  { id: "m1", label: "1 mile", homes: "1,126 homeowners" },
  { id: "zip", label: "Zip Code", homes: "2,845 homeowners" },
];

export const LISTING_SALES_PROCESS_STEPS: readonly {
  n: string;
  title: string;
  lead: string;
  bullets?: readonly string[];
  promoItems?: readonly string[];
  dataBoxes?: readonly { title: string; items: readonly string[] }[];
}[] = [
  {
    n: "1",
    title: "Trigger: new listing goes live",
    lead: "As soon as a listing is live, we start the neighborhood workflow.",
    bullets: [
      "New listing published to MLS",
      "Our system detects and pulls the listing",
      "Activation begins in near real time",
      "Opportunity mapping is initiated",
    ],
  },
  {
    n: "2",
    title: "We capture listing & agent data",
    lead: "We pull and structure the fields your campaign needs — property + who to credit.",
    dataBoxes: [
      {
        title: "Listing data captured",
        items: ["MLS #", "Address & price", "Subdivision", "Geo location"],
      },
      {
        title: "Agent data captured",
        items: ["Agent name", "Agent email", "Agent phone"],
      },
    ],
  },
  {
    n: "3",
    title: "We map radius opportunities",
    lead:
      "We cross-reference the listing with homeowner coverage and produce ring counts you can share with the seller — then you confirm scope before spend locks at checkout.",
  },
  {
    n: "4",
    title: "We promote you in the neighborhood",
    lead: "We put the story in market: digital, direct, and human touches — so more sellers and buyers raise their hands.",
    promoItems: [
      "Targeted digital promotion",
      "Property & neighborhood messaging",
      "Voicemail & SMS where configured",
      "Homeowner & buyer outreach",
      "AI + live caller lanes on full programs",
    ],
  },
];

/** Decorative table on step 3 — sample only; not live counts. */
export const OPPORTUNITY_COUNT_DEMO: readonly { label: string; count: string }[] = [
  { label: "In subdivision", count: "128" },
  { label: "¼ mile radius", count: "214" },
  { label: "½ mile radius", count: "482" },
  { label: "1 mile radius", count: "1,126" },
  { label: "ZIP code", count: "2,845" },
];

export const PROCESS_SUMMARY_POINTS: readonly { title: string; d: string }[] = [
  { title: "Instant activation", d: "Listing in → workflow starts" },
  { title: "Accurate data", d: "Structured listing + agent record" },
  { title: "Complete visibility", d: "Ring counts before you buy" },
  { title: "More opportunities", d: "Promotion + outreach in motion" },
  { title: "We contact the area", d: "AI + live on your behalf" },
];

export const PROCESS_FOOTER_CHANNELS =
  "Live callers · AI outreach · Voicemail · Text follow-up · Lead routing";
