import {
  LEAD_SERVICE_LINES,
  LEAD_TIERS,
  LEAD_PRICE_MATRIX,
  formatMoneyUsd,
  serviceLineLabel,
  type LeadServiceLine,
  type LeadTierId,
} from "../../lib/leadPricing";
import "./BuyLeadsSalesSheet.css";

const SERVICE_BLURB: Record<LeadServiceLine, string> = {
  ai_outreach: "Email, SMS & ringless voicemail with AI-assisted discovery.",
  live_callers: "U.S.-based callers qualify homeowners with real conversations.",
  hybrid: "AI nurtures leads; live callers follow up to qualify.",
  data_only: "Verified homeowner records for your own outreach stack.",
  mailers: "Printed postcards delivered to homeowners in your target radius.",
};

/** Typical homeowner counts by radius (illustrative ranges for the sales sheet). */
const RADIUS_BANDS: { mi: string; label: string; homeowners: string }[] = [
  { mi: "0.5", label: "½ mile", homeowners: "150 – 300 homeowners" },
  { mi: "1.0", label: "1 mile", homeowners: "300 – 600" },
  { mi: "2.0", label: "2 miles", homeowners: "600 – 1,200" },
  { mi: "3.0", label: "3 miles", homeowners: "1,200 – 2,500" },
  { mi: "5.0", label: "5 miles", homeowners: "2,500 – 6,000+" },
];

type Props = {
  serviceLine: LeadServiceLine;
  selectedTier: LeadTierId;
  radius: string;
  onPickService: (line: LeadServiceLine) => void;
  onPickPlan: (line: LeadServiceLine, tier: LeadTierId) => void;
  onPickRadius: (mi: string) => void;
};

export function BuyLeadsSalesSheet({
  serviceLine,
  selectedTier,
  radius,
  onPickService,
  onPickPlan,
  onPickRadius,
}: Props) {
  return (
    <section className="buy-sheet" aria-label="Pricing and targeting overview">
      <div className="buy-sheet__cols">
        {LEAD_SERVICE_LINES.map((line) => {
          const activeCol = serviceLine === line.id;
          return (
            <div key={line.id} className={`buy-sheet-col${activeCol ? " buy-sheet-col--active" : ""}`}>
              <button
                type="button"
                className="buy-sheet-col__banner"
                style={{ background: line.headerBg, color: line.headerText }}
                onClick={() => onPickService(line.id)}
              >
                {line.label}
              </button>
              <p className="buy-sheet-col__desc">{SERVICE_BLURB[line.id]}</p>
              <table className="buy-sheet-col__table">
                <thead>
                  <tr>
                    <th scope="col">Package</th>
                    <th scope="col">Homes</th>
                    <th scope="col">/ home</th>
                  </tr>
                </thead>
                <tbody>
                  {LEAD_TIERS.map((tier, idx) => {
                    const price = LEAD_PRICE_MATRIX[line.id][idx];
                    const picked = activeCol && selectedTier === tier.id;
                    return (
                      <tr
                        key={tier.id}
                        className={picked ? "is-picked" : undefined}
                        onClick={() => onPickPlan(line.id, tier.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onPickPlan(line.id, tier.id);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`${serviceLineLabel(line.id)} ${tier.packageLabel}, ${tier.homesLabel} homes, ${formatMoneyUsd(price)} per home`}
                      >
                        <td>{tier.packageLabel}</td>
                        <td>{tier.homesLabel}</td>
                        <td>{formatMoneyUsd(price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      <div className="buy-sheet-radius">
        <h3 className="buy-sheet-radius__title">Choose your targeting radius</h3>
        <div className="buy-sheet-radius__row">
          {RADIUS_BANDS.map((b) => (
            <button
              key={b.mi}
              type="button"
              className={`buy-sheet-radius__pill${radius === b.mi ? " is-active" : ""}`}
              onClick={() => onPickRadius(b.mi)}
            >
              <span className="buy-sheet-radius__mi">{b.label}</span>
              <span className="buy-sheet-radius__range">{b.homeowners}</span>
            </button>
          ))}
        </div>
        <p className="buy-sheet-footnote">
          Tighter <strong>¼ mile</strong> ring is available in Step 1. Live counts depend on your market — see map preview.
        </p>
      </div>
    </section>
  );
}
