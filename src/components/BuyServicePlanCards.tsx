import {
  LEAD_SERVICE_LINES,
  LEAD_TIERS,
  formatMoneyUsd,
  isServiceLineHiddenDuringBeta,
  checkoutPricePerLeadUsd,
  type LeadServiceLine,
  type LeadTierId,
} from "../lib/leadPricing";

const CARD_META: Record<
  LeadServiceLine,
  { subtitle: string; blurb: string; icon: string; popular?: boolean }
> = {
  live_callers: {
    subtitle: "Human-Powered Conversations",
    blurb: "Professional U.S.-based callers have real conversations and qualify homeowners by phone.",
    icon: "/Live-Callers.webp",
  },
  ai_outreach: {
    subtitle: "AI-Powered Outreach",
    blurb: "Automated multi-channel outreach via email, SMS, and ringless voicemail with AI lead discovery.",
    icon: "/Ai-powered.webp",
  },
  hybrid: {
    subtitle: "The Best of Both Worlds",
    blurb: "AI identifies and nurtures leads, then our live callers follow up to qualify with real conversations.",
    icon: "/Qualified-leads.webp",
    popular: true,
  },
  data_only: {
    subtitle: "Verified Homeowner Data",
    blurb: "Access verified homeowner data within your target area to power your own outreach.",
    icon: "/zipcode.webp",
  },
  mailers: {
    subtitle: "Direct Mail to Homeowners",
    blurb: "Professional direct mail postcards delivered to verified homeowners in your target area.",
    icon: "/Mailer.webp",
  },
};

type Props = {
  serviceLine: LeadServiceLine;
  selectedTier: LeadTierId;
  requestedLeads: number;
  promoCode: string | null;
  onPick: (line: LeadServiceLine, tier: LeadTierId) => void;
};

export function BuyServicePlanCards({ serviceLine, selectedTier, requestedLeads, promoCode, onPick }: Props) {
  return (
    <div className="buy-plan-cards" role="group" aria-label="Service plans">
      {LEAD_SERVICE_LINES.map((line) => {
        const meta = CARD_META[line.id];
        const betaLocked = isServiceLineHiddenDuringBeta(line.id);
        const cardSelected = serviceLine === line.id;
        const perHome = checkoutPricePerLeadUsd(line.id, selectedTier, promoCode);
        const estTotal = perHome * requestedLeads;

        return (
          <div
            key={line.id}
            className={`buy-plan-card-shell buy-plan-card-shell--${line.id}${meta.popular ? " has-popular" : ""}`}
          >
            {meta.popular ? <span className="buy-plan-card__popular">MOST POPULAR</span> : null}
            <article
              className={`buy-plan-card buy-plan-card--${line.id}${cardSelected ? " is-selected" : ""}${betaLocked ? " is-beta-locked" : ""}`}
              style={{ ["--buy-plan-accent" as string]: line.headerBg }}
            >
            <button
              type="button"
              className="buy-plan-card__head"
              style={{ background: line.headerBg, color: line.headerText }}
              disabled={betaLocked}
              aria-pressed={cardSelected}
              onClick={() => onPick(line.id, selectedTier)}
            >
              <img src={meta.icon} alt="" className="buy-plan-card__head-icon" width={36} height={36} />
              <span className="buy-plan-card__head-text">
                <span className="buy-plan-card__title">{line.label}</span>
                <span className="buy-plan-card__subtitle">{meta.subtitle}</span>
              </span>
              <span className={`buy-plan-card__head-radio${cardSelected ? " is-on" : ""}`} aria-hidden />
            </button>
            <div className="buy-plan-card__table-wrap">
              <table className="buy-plan-card__table">
                <thead>
                  <tr>
                    <th scope="col">Package</th>
                    <th scope="col">Homes</th>
                    <th scope="col">Per home</th>
                  </tr>
                </thead>
                <tbody>
                  {LEAD_TIERS.map((tier) => {
                    const picked = cardSelected && selectedTier === tier.id;
                    const price = checkoutPricePerLeadUsd(line.id, tier.id, promoCode);
                    return (
                      <tr
                        key={tier.id}
                        className={picked ? "is-picked" : undefined}
                        onClick={() => !betaLocked && onPick(line.id, tier.id)}
                      >
                        <td>
                          {tier.id === "dominate" ? (
                            <>
                              Dominate <span className="buy-plan-card__star" aria-hidden>★</span>
                            </>
                          ) : (
                            tier.packageLabel
                          )}
                        </td>
                        <td>{tier.homesLabel}</td>
                        <td>{formatMoneyUsd(price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="buy-plan-card__calc">
              <div className="buy-plan-card__calc-row">
                <span className="buy-plan-card__rate">
                  {formatMoneyUsd(perHome)} <span>/ home</span>
                </span>
                <span className="buy-plan-card__homes-pill">{requestedLeads.toLocaleString()} homes</span>
              </div>
              <p className="buy-plan-card__est">
                <strong>{formatMoneyUsd(estTotal)}</strong> Est. total
              </p>
            </div>
            <footer className="buy-plan-card__foot">
              <img src={meta.icon} alt="" className="buy-plan-card__foot-icon" width={22} height={22} />
              <p className="buy-plan-card__blurb">{meta.blurb}</p>
              {betaLocked ? (
                <p className="buy-plan-card__beta muted">Checkout opens soon — preview pricing above.</p>
              ) : null}
            </footer>
            </article>
          </div>
        );
      })}
    </div>
  );
}
