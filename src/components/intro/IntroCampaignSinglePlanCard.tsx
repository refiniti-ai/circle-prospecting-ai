import { formatMoneyUsd, LEAD_SERVICE_LINES } from "../../lib/leadPricing";
import { INTRO_CAMPAIGN } from "../../lib/introCampaign";

const LIVE_CALLERS = LEAD_SERVICE_LINES.find((l) => l.id === "live_callers")!;

/** One fixed intro plan — Live Callers · 250 homes · $99 (not the 5-plan buy-leads grid). */
export function IntroCampaignSinglePlanCard() {
  return (
    <section className="section-surface buy-card intro-single-plan" aria-label="Introductory plan">
      <h2 className="premium-h2 intro-single-plan__title">Your intro plan</h2>
      <p className="muted intro-single-plan__lead">
        First-time customers only — one choice: professional live callers to {INTRO_CAMPAIGN.homes} nearby homeowners.
      </p>
      <div className="buy-plan-cards buy-plan-cards--single">
        <div className="buy-plan-card-shell buy-plan-card-shell--live_callers">
          <article
            className="buy-plan-card buy-plan-card--live_callers is-selected intro-single-plan__card"
            style={{ ["--buy-plan-accent" as string]: LIVE_CALLERS.headerBg }}
          >
            <div className="buy-plan-card__head" style={{ background: LIVE_CALLERS.headerBg, color: LIVE_CALLERS.headerText }}>
              <img src="/Live-Callers.webp" alt="" className="buy-plan-card__head-icon" width={36} height={36} />
              <span className="buy-plan-card__head-text">
                <span className="buy-plan-card__title">{LIVE_CALLERS.label}</span>
                <span className="buy-plan-card__subtitle">Human-Powered Conversations</span>
              </span>
              <span className="buy-plan-card__head-radio is-on" aria-hidden />
            </div>
            <div className="buy-plan-card__table-wrap">
              <table className="buy-plan-card__table">
                <thead>
                  <tr>
                    <th scope="col">Package</th>
                    <th scope="col">Homes</th>
                    <th scope="col">Intro total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="is-picked">
                    <td>First-time offer</td>
                    <td>{INTRO_CAMPAIGN.homes.toLocaleString()}</td>
                    <td>{formatMoneyUsd(INTRO_CAMPAIGN.priceUsd)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="buy-plan-card__calc">
              <div className="buy-plan-card__calc-row">
                <span className="buy-plan-card__rate">
                  {formatMoneyUsd(INTRO_CAMPAIGN.priceUsd)} <span>intro total</span>
                </span>
                <span className="buy-plan-card__homes-pill">{INTRO_CAMPAIGN.homes.toLocaleString()} homes</span>
              </div>
              <p className="buy-plan-card__est">
                <strong>{formatMoneyUsd(INTRO_CAMPAIGN.priceUsd)}</strong> One-time payment
              </p>
            </div>
            <footer className="buy-plan-card__foot">
              <img src="/Live-Callers.webp" alt="" className="buy-plan-card__foot-icon" width={22} height={22} />
              <p className="buy-plan-card__blurb">
                Professional U.S.-based callers introduce your listing and your brand to nearby homeowners.
              </p>
            </footer>
          </article>
        </div>
      </div>
    </section>
  );
}
