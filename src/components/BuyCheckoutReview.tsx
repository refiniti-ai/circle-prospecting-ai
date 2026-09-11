import { Link } from "react-router-dom";
import { PromoCodeField } from "./PromoCodeField";
import { contactEmail, contactPhoneDisplay } from "../lib/siteConfig";
import {
  checkoutPricePerLeadUsd,
  formatMoneyUsd,
  serviceLineLabel,
  type LeadServiceLine,
  type LeadTierId,
} from "../lib/leadPricing";
import { formatListingDisplayAddress, radiusRingLabel, type ListingFormValues, type ListingPayload, type RadiusId } from "../lib/listingData";

const CHECKOUT_NEXT_STEPS = [
  {
    title: "We pull homeowner records",
    detail: "We confirm property and homeowner data.",
  },
  {
    title: "Our system activates",
    detail: "Your campaign is set up and callers are assigned.",
  },
  {
    title: "Calls begin",
    detail: "Outreach starts within 24 hours.",
  },
  {
    title: "You receive results",
    detail: "Track lead activity and recordings in your dashboard.",
  },
] as const;

function targetAreaLabel(radiusId: RadiusId, radiusLabel: string): string {
  const ring = radiusRingLabel(radiusId, radiusLabel);
  return radiusId === "zip" ? ring : `${ring} Radius`;
}

function listingLine(form: ListingFormValues, listing: ListingPayload): string {
  const mls = form.mls.trim() || listing.mls.trim() || "MLS #";
  const address = formatListingDisplayAddress(form) || listing.address.trim();
  return `${mls} · ${address}`;
}

type Props = {
  listing: ListingPayload;
  form: ListingFormValues;
  campaignLabel: string;
  radiusId: RadiusId;
  radiusLabel: string;
  homes: number;
  serviceLine: LeadServiceLine;
  tierId: LeadTierId;
  packageLabel: string;
  promoCode: string | null;
  totalCents: number;
  email: string;
  phone: string;
  onFormChange: <K extends keyof ListingFormValues>(field: K, value: ListingFormValues[K]) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  promoInput: string;
  onPromoInputChange: (value: string) => void;
  onPromoApply: (code: string | null) => void;
  appliedPromoCode: string | null;
  lockedCampaignNote?: string | null;
  busy: boolean;
  listingReady: boolean;
  tierBandOk: boolean;
  onCheckout: () => void;
  disabled?: boolean;
};

function SecureCheckoutNote({ className = "" }: { className?: string }) {
  return (
    <p className={`buy-checkout-secure ${className}`.trim()}>
      <svg className="buy-checkout-secure__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 11V8a5 5 0 0 1 10 0v3"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.75" />
      </svg>
      Secure checkout • Cancel anytime
    </p>
  );
}

function SummaryField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="buy-checkout-summary-field">
      <span className="buy-checkout-summary-field__label">{label}</span>
      <div className={`buy-checkout-summary-field__value${highlight ? " is-highlight" : ""}`}>{value}</div>
    </div>
  );
}

export function BuyCheckoutReview({
  listing,
  form,
  campaignLabel,
  radiusId,
  radiusLabel,
  homes,
  serviceLine,
  tierId,
  packageLabel,
  promoCode,
  totalCents,
  email,
  phone,
  onFormChange,
  onEmailChange,
  onPhoneChange,
  promoInput,
  onPromoInputChange,
  onPromoApply,
  appliedPromoCode,
  lockedCampaignNote,
  busy,
  listingReady,
  tierBandOk,
  onCheckout,
  disabled,
}: Props) {
  const perHome = checkoutPricePerLeadUsd(serviceLine, tierId, promoCode);
  const displayCampaign =
    campaignLabel === "Just listed" ? "Just Listed" : campaignLabel === "Just sold" ? "Just Sold" : campaignLabel;
  const planBand = `${packageLabel} - ${formatMoneyUsd(perHome)}/home`;
  const phoneDisplay = contactPhoneDisplay();
  const checkoutDisabled = disabled || busy || !listingReady || !tierBandOk || totalCents < 50;

  return (
    <section id="buy-checkout-step" className="buy-checkout-section">
      <h2 className="buy-checkout-section__title">Step 4: Review &amp; checkout</h2>
      <p className="buy-checkout-section__sub">
        Confirm your selection — totals update when you change the ring or plan above.
        {lockedCampaignNote ? <> {lockedCampaignNote}</> : null}
      </p>

      <div className="buy-checkout-grid">
        <div className="buy-checkout-panel buy-checkout-panel--order">
          <label className="buy-checkout-field buy-checkout-field--full">
            <span className="buy-checkout-field__label">Listing</span>
            <div className="buy-checkout-field__readonly">{listingLine(form, listing)}</div>
          </label>

          <div className="buy-checkout-summary-grid">
            <SummaryField label="Campaign" value={displayCampaign} />
            <SummaryField label="Target area" value={targetAreaLabel(radiusId, radiusLabel)} />
            <SummaryField label="Homes in order" value={homes.toLocaleString()} />
            <SummaryField label="Service (product)" value={serviceLineLabel(serviceLine)} />
            <SummaryField label="Plan band" value={planBand} />
            <SummaryField label="Campaign total (est.)" value={formatMoneyUsd(totalCents / 100)} highlight />
          </div>

          <div className="buy-checkout-form-grid buy-checkout-form-grid--2">
            <label className="buy-checkout-field">
              <span className="buy-checkout-field__label">Agent name</span>
              <input
                type="text"
                className="premium-input"
                value={form.agentName}
                onChange={(e) => onFormChange("agentName", e.target.value)}
                autoComplete="name"
                disabled={disabled || busy}
                placeholder="Your name"
              />
            </label>
            <label className="buy-checkout-field">
              <span className="buy-checkout-field__label">Brokerage (optional)</span>
              <input
                type="text"
                className="premium-input"
                value={form.brokerage}
                onChange={(e) => onFormChange("brokerage", e.target.value)}
                disabled={disabled || busy}
                placeholder="Your brokerage"
              />
            </label>
          </div>

          <div className="buy-checkout-form-grid buy-checkout-form-grid--2">
            <label className="buy-checkout-field">
              <span className="buy-checkout-field__label">
                Email (delivery + receipt)
                <span className="buy-checkout-field__hint"> pre-filled from listing agent</span>
              </span>
              <input
                type="email"
                className="premium-input"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                autoComplete="email"
                disabled={disabled || busy}
                placeholder="you@yourbrokerage.com"
              />
            </label>
            <label className="buy-checkout-field">
              <span className="buy-checkout-field__label">
                Mobile phone
                <span className="buy-checkout-field__hint"> pre-filled from listing agent</span>
              </span>
              <input
                type="tel"
                className="premium-input"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                autoComplete="tel"
                disabled={disabled || busy}
                placeholder="+1 (555) 000-0000"
              />
            </label>
          </div>

          <div className="buy-checkout-panel__foot">
            <SecureCheckoutNote />
          </div>
        </div>

        <div className="buy-checkout-panel buy-checkout-panel--next">
          <h3 className="buy-checkout-panel__title">What happens next?</h3>
          <ol className="buy-checkout-next-list">
            {CHECKOUT_NEXT_STEPS.map((step) => (
              <li key={step.title}>
                <span className="buy-checkout-next-list__check" aria-hidden />
                <span className="buy-checkout-next-list__text">
                  <strong>{step.title}</strong>
                  <span>{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="buy-checkout-help">
            <span className="buy-checkout-help__icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 14v2a2 2 0 0 0 2 2h3l4 3v-8.5L9.5 10H6a2 2 0 0 0-2 2v2Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M14.5 8.5a5 5 0 0 1 0 7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M17 6a8 8 0 0 1 0 12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div>
              <strong className="buy-checkout-help__title">Need help?</strong>
              {phoneDisplay ? (
                <a className="buy-checkout-help__link" href={`tel:${phoneDisplay.replace(/\D/g, "")}`}>
                  {phoneDisplay}
                </a>
              ) : null}
              <a className="buy-checkout-help__link" href={`mailto:${contactEmail()}`}>
                {contactEmail()}
              </a>
            </div>
          </div>
        </div>

        <div className="buy-checkout-panel buy-checkout-panel--cta">
          <PromoCodeField
            value={promoInput}
            onChange={onPromoInputChange}
            onApply={onPromoApply}
            appliedCode={appliedPromoCode}
            disabled={busy}
            className="buy-checkout-promo--stack"
          />
          <SecureCheckoutNote className="buy-checkout-secure--stack" />
          <button
            type="button"
            className="btn btn-primary buy-checkout-cta-btn"
            disabled={checkoutDisabled}
            onClick={onCheckout}
          >
            {busy ? "Redirecting to Stripe…" : listingReady ? "Continue to checkout →" : "Find listing to checkout"}
          </button>
          <p className="buy-checkout-terms muted">
            By continuing you agree to our{" "}
            <Link to="/terms-and-conditions">Terms</Link> and <Link to="/privacy-policy">Privacy</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}
