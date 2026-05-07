import type { StatIconId } from "./icons";

export const MARKETING_IMG = {
  hero: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=2000&q=86",
  modern: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=86",
  pool: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1400&q=85",
  skyline: "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=1400&q=85",
  before: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=85",
};

/** Homepage + How it works — client: dead-simple path to conversations */
export const WORKFLOW_SECTION_TITLE = "Three steps from your area to conversations";

export const STEPS: { n: string; t: string; d: string }[] = [
  {
    n: "01",
    t: "Choose your target area",
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

export const BRAND_PLATFORM_LINE = "Done-for-you prospecting — we call your market for you";

export const POSITIONING_STRIP =
  "We have the data, the dialer, and the callers — so you get conversations, appointments, and deals.";

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
    badge: "Data",
    title: "Lists + targeting",
    lead: "Homeowner intelligence for your radius—filters and counts so you’re not spraying a raw CSV at the market.",
    outcomes: ["Farm-ready homeowner records", "Radius + motivator targeting", "Exports your ops team can trust"],
  },
  {
    badge: "AI outreach",
    title: "Calls + voicemail + text",
    lead: "High-volume touches on your behalf—AI dialing with voicemail and SMS so homeowners actually hear from you.",
    outcomes: ["Scaled coverage in your ring", "Consistent cadence without you on the headset", "More at-bats for conversations"],
  },
  {
    badge: "Full service",
    title: "Live callers + appointment setting",
    lead: "Real reps extending your brand—dialogue, qualification, and booked appointments when you need white-glove execution.",
    outcomes: ["Human conversations—not blasts", "Calendar-ready opportunities", "Built for competitive markets"],
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
  { role: "user", body: "Send me the callback hotlist for tonight." },
  {
    role: "bot",
    body: "Done—23 warm callbacks with dispositions are in your dashboard export. Want a one-tap handoff to your CRM webhook?",
  },
  { role: "user", body: "Add a second pass on voicemail-only homes tomorrow morning." },
  {
    role: "bot",
    body: "Scheduled: VM drop #2 at 9:00 AM local, same script family. You’ll get a summary ping when the pass finishes.",
  },
] as const;

export const BLOG_CARDS: { title: string; date: string; image: string; href: string }[] = [
  {
    title: "When AI + live callers beat “just the data” for circle prospecting",
    date: "February 2026",
    image: MARKETING_IMG.modern,
    href: "/content",
  },
  {
    title: "From radius pick to booked callbacks—what ops should expect",
    date: "January 2026",
    image: MARKETING_IMG.skyline,
    href: "/content",
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

/**
 * Homepage proof rail — outcome + execution clarity.
 * Benchmark line is illustrative; real results vary by market and follow-up.
 */
export const REZ_PROOF_LINE: { num: string; label: string }[] = [
  { num: "We call", label: "AI dialing + live callers reach homeowners for you—not “here’s a CSV, good luck.”" },
  { num: "~20+", label: "Benchmark: 20+ conversations per ~10,000 homeowners on typical campaigns (results vary)" },
  { num: "3-in-1", label: "Data + dialer + humans in one prospecting engine" },
  { num: "$ / home", label: "Published per-homeowner pricing before you commit" },
];

export const REZ_SHOWCASE_LEADS = {
  kicker: "Outcomes, not features",
  title: "We generate conversations in your market — you show up for the appointment.",
  lead:
    "Circle Prospecting AI is built for operators who are tired of paying for data and still owning the dialer. We combine lists, AI outreach, and live callers so homeowners get contacted on your behalf—and you get real opportunities back.",
  bullets: [
    "We contact homeowners (calls, voicemail, text) — you’re not grinding cold lists solo",
    "AI lanes for scale + hybrid / live lanes when you need human dialogue",
    "Just listed & just sold campaigns supported — same engine, clearer story at the door",
    "Dashboard + handoffs so ops and agents see delivery, not mystery exports",
    "Per-homeowner pricing bands — know your marketing spend before checkout",
    "Built for teams who want appointments, not another tool subscription",
  ],
};

export const REZ_SHOWCASE_CIRCLE = {
  kicker: "Your farm, visualized",
  title: "Pick the ring. See the counts. Then we go execute.",
  lead:
    "Agents and ops align on one map: subdivision through ZIP, neighbor totals, and spend—then our team runs the outreach so the story you pitch sellers matches what actually hits the phones.",
  bullets: [
    "Radius ladder matches how you explain “who we can reach”",
    "Counts refresh before you lock budget",
    "Same flow for listing-led or geo farms — we still call for you",
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
  { title: "AI powered", d: "Smart targeting & intent scoring", icon: "ai" },
  { title: "Live callers", d: "Real conversations that build trust", icon: "live" },
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

/** Illustrative homeowner counts for the radius strip (not a guarantee). */
export const POSTER_RADIUS_BANDS: readonly { miles: string; homes: string }[] = [
  { miles: "0.5 mi", homes: "150–300 homeowners" },
  { miles: "1 mi", homes: "300–600 homeowners" },
  { miles: "2 mi", homes: "600–1,200 homeowners" },
  { miles: "3 mi", homes: "1,200–2,500 homeowners" },
  { miles: "5 mi", homes: "2,500–6,000+ homeowners" },
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
  "AI outreach · Live callers · Voicemail · Text follow-up · Lead routing";
