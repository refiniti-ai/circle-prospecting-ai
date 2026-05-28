import { LEAD_PRICE_MATRIX, LEAD_SERVICE_LINES, LEAD_TIERS, formatMoneyUsd } from "../../lib/leadPricing";
import "../../pages/pay-link.css";
import "./plan-picker-still.css";

const DEMO_RINGS = [
  { label: "Subdivision", homes: 125 },
  { label: "1/4 Mile", homes: 164 },
  { label: "1/2 Mile", homes: 580, active: true },
  { label: "1 Mile", homes: 4634 },
  { label: "ZIP code", homes: 7803 },
] as const;

const DEMO_HOMES = 580;
const DEMO_SERVICE = "live_callers" as const;
const DEMO_TIER = "growth" as const;

/** Static homepage still of the pay-link / buy-leads plan picker (illustrative). */
export function PlanPickerStillShot() {
  const unitPrice = LEAD_PRICE_MATRIX[DEMO_SERVICE][2];
  const totalUsd = DEMO_HOMES * unitPrice;

  return (
    <div className="rz-plan-still pay-link-shell" aria-label="Choose your plan preview (illustrative)">
      <div className="pay-card pay-plan">
        <h2 className="pay-section-title">Choose your plan</h2>

        <div className="pay-step-block">
          <h3 className="buy-step2-subhead">Target ring</h3>
          <p className="muted pay-subhint">
            Sets the maximum homeowners we can call. Pick a ring then fine-tune the home count below.
          </p>
          <div className="pay-radius-row" aria-hidden>
            {DEMO_RINGS.map((ring) => (
              <div key={ring.label} className={`pay-radius-chip${"active" in ring && ring.active ? " is-on" : ""}`}>
                <strong>{ring.label}</strong>
                <span>{ring.homes.toLocaleString()} homes</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pay-step-block">
          <h3 className="buy-step2-subhead">1 · How many homes should we call?</h3>
          <div className="buy-listing-count-banner" role="presentation">
            <span className="buy-listing-count-banner__n">{DEMO_HOMES.toLocaleString()}</span>
            <span className="buy-listing-count-banner__l">
              homeowners in order · 1/2 Mile (up to 580) · plan <strong>Growth</strong>
            </span>
          </div>
          <label className="cp-form-grid buy-home-exact pay-home-input">
            <span className="muted-label">Homes to call (1–580)</span>
            <input type="number" className="premium-input" value={DEMO_HOMES} readOnly tabIndex={-1} aria-hidden />
          </label>
          <p className="buy-tier-auto muted pay-rate-line">
            <strong>{formatMoneyUsd(unitPrice)}</strong> per home with <strong>Live Callers</strong> ={" "}
            <strong className="gradient-text">{formatMoneyUsd(totalUsd)}</strong> estimated total
          </p>
        </div>

        <div className="pay-step-block">
          <h3 className="buy-step2-subhead">2 · Choose your plan (4 packages)</h3>
          <p className="muted pay-subhint">
            <strong>Dabble</strong>, <strong>Starter</strong>, <strong>Growth</strong>, and <strong>Scale</strong> — click a row to
            set plan band and service. Rates are per homeowner.
          </p>
          <div className="buy-pricing-scroll">
            <div className="buy-pricing-stack buy-pricing-stack--two-col" aria-hidden>
              {LEAD_SERVICE_LINES.map((line) => {
                const serviceSelected = line.id === DEMO_SERVICE;
                return (
                  <div key={line.id} className={`buy-pricing-block${serviceSelected ? " is-selected" : ""}`}>
                    <table className="buy-price-table">
                      <thead>
                        <tr>
                          <th className="buy-price-banner" colSpan={4} style={{ background: line.headerBg, color: line.headerText }}>
                            <span className="buy-price-title-btn" style={{ color: line.headerText }}>
                              {line.label}
                            </span>
                          </th>
                        </tr>
                        <tr className="buy-price-colheads">
                          <th scope="col" className="buy-price-col-select" aria-label="Select" />
                          <th scope="col">Plan</th>
                          <th scope="col">Volume</th>
                          <th scope="col">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {LEAD_TIERS.map((tier, idx) => {
                          const planPick = serviceSelected && tier.id === DEMO_TIER;
                          const rowBg = idx % 2 === 1 ? "rgba(15,23,42,0.04)" : "#fff";
                          const price = LEAD_PRICE_MATRIX[line.id][idx];
                          return (
                            <tr
                              key={tier.id}
                              className={`buy-price-row${planPick ? " is-plan-selected" : ""}`}
                              style={{ background: planPick ? line.rowAlt : rowBg }}
                            >
                              <td className="buy-price-col-select">
                                <input
                                  type="radio"
                                  className="buy-opp-radio"
                                  checked={planPick}
                                  readOnly
                                  tabIndex={-1}
                                  aria-hidden
                                />
                              </td>
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
          </div>
        </div>
      </div>
    </div>
  );
}
