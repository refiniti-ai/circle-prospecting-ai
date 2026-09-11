import type { ReactNode } from "react";
import { formatMoneyUsd, LEAD_PRICE_MATRIX, LEAD_SERVICE_LINES, LEAD_TIERS } from "../../lib/leadPricing";

const FLYER_PRICING_COLUMNS: {
  lineId: "live_callers" | "ai_outreach" | "hybrid" | "data_only";
  title: string;
  subtitle: string;
  blurb: ReactNode;
  footIcon: "phone" | "channels" | "headset" | "data";
}[] = [
  {
    lineId: "live_callers",
    title: "Live Callers",
    subtitle: "Human-Powered Conversations",
    blurb: "Professional U.S.-based callers have real conversations and qualify homeowners by phone.",
    footIcon: "phone",
  },
  {
    lineId: "ai_outreach",
    title: "AI Outreach",
    subtitle: "AI-Powered Outreach",
    blurb: "Automated multi-channel outreach via email, SMS, and ringless voicemail with AI lead discovery.",
    footIcon: "channels",
  },
  {
    lineId: "hybrid",
    title: "Hybrid (AI + Live)",
    subtitle: "The Best of Both Worlds",
    blurb: "AI identifies and nurtures leads, then our live callers follow up to qualify with real conversations.",
    footIcon: "headset",
  },
  {
    lineId: "data_only",
    title: "Data Only",
    subtitle: "Verified Homeowner Data",
    blurb: "Access verified homeowner data within your target area to power your own outreach.",
    footIcon: "data",
  },
];

function PricingFootIcon({ kind }: { kind: (typeof FLYER_PRICING_COLUMNS)[number]["footIcon"] }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, "aria-hidden": true as const };
  switch (kind) {
    case "phone":
      return (
        <svg {...common}>
          <path d="M6.5 5c.4-.9 1.4-1.3 2.3-1 2.1.9 4 2.3 5.6 4 1.6 1.6 3 3.5 4 5.6.3.9-.1 1.9-1 2.3l-1.5.6c-.7.3-1.5.1-2-.5l-1-1.2" strokeLinejoin="round" />
        </svg>
      );
    case "channels":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      );
    case "headset":
      return (
        <svg {...common}>
          <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
          <path d="M4 14a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2zm14 0a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <ellipse cx="12" cy="6" rx="7" ry="3" />
          <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
        </svg>
      );
  }
}

export function FlyerPricingGrid() {
  return (
    <div className="cp-flyer-pricing-grid">
      {FLYER_PRICING_COLUMNS.map((col) => {
        const line = LEAD_SERVICE_LINES.find((l) => l.id === col.lineId)!;
        return (
          <article
            key={col.lineId}
            className={`cp-flyer-pricing-col cp-flyer-pricing-col--${col.lineId}`}
            style={{ ["--cp-flyer-accent" as string]: line.headerBg }}
          >
            <header className="cp-flyer-pricing-col__head" style={{ background: line.headerBg, color: line.headerText }}>
              <h3 className="cp-flyer-pricing-col__title">{col.title}</h3>
              <p className="cp-flyer-pricing-col__subtitle">{col.subtitle}</p>
            </header>
            <div className="cp-flyer-pricing-col__table-wrap">
              <table className="cp-flyer-pricing-table">
                <thead>
                  <tr>
                    <th scope="col">Package</th>
                    <th scope="col">Homes</th>
                    <th scope="col" className="cp-flyer-pricing-table__num">
                      Per home
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {LEAD_TIERS.map((tier, idx) => (
                    <tr key={tier.id} className={tier.id === "dominate" ? "cp-flyer-pricing-table__row--dominate" : undefined}>
                      <td>
                        {tier.packageLabel}
                        {tier.id === "dominate" ? (
                          <span className="cp-flyer-pricing-star" aria-hidden>
                            {" "}
                            ★
                          </span>
                        ) : null}
                      </td>
                      <td>{tier.homesLabel}</td>
                      <td className="cp-flyer-pricing-table__num">{formatMoneyUsd(LEAD_PRICE_MATRIX[col.lineId][idx])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="cp-flyer-pricing-col__foot">
              <span className="cp-flyer-pricing-col__foot-icon" style={{ color: line.headerBg }}>
                <PricingFootIcon kind={col.footIcon} />
              </span>
              <p className="cp-flyer-pricing-col__foot-text">{col.blurb}</p>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
