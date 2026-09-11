import { Link } from "react-router-dom";
import { contactEmail, contactPhoneDisplay } from "../../lib/siteConfig";
import { formatMoneyUsd, serviceLineLabel } from "../../lib/leadPricing";
import { formatListingDisplayAddress, radiusRingLabel, type ListingFormValues, type ListingPayload, type RadiusId } from "../../lib/listingData";
import { INTRO_CAMPAIGN } from "../../lib/introCampaign";

const CHECKOUT_NEXT_STEPS = [
  { title: "We pull homeowner records", detail: "We confirm property and homeowner data." },
  { title: "Our system activates", detail: "Your campaign is set up and callers are assigned." },
  { title: "Calls begin", detail: "Outreach starts within 24 hours." },
  { title: "You receive results", detail: "Track lead activity and recordings in your dashboard." },
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
  email: string;
  phone: string;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  busy: boolean;
  onCheckout: () => void;
};

function SummaryField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="buy-checkout-summary-field">
      <span className="buy-checkout-summary-field__label">{label}</span>
      <div className={`buy-checkout-summary-field__value${highlight ? " is-highlight" : ""}`}>{value}</div>
    </div>
  );
}

export function IntroCampaignCheckoutReview({
  listing,
  form,
  campaignLabel,
  radiusId,
  radiusLabel,
  email,
  phone,
  onEmailChange,
  onPhoneChange,
  busy,
  onCheckout,
}: Props) {
  const displayCampaign =
    campaignLabel === "Just listed" ? "Just Listed" : campaignLabel === "Just sold" ? "Just Sold" : campaignLabel;
  const phoneDisplay = contactPhoneDisplay();
  const checkoutDisabled = busy || !email.includes("@");

  return (
    <section id="intro-checkout-step" className="buy-checkout-section">
      <h2 className="buy-checkout-section__title">Review &amp; checkout</h2>
      <p className="buy-checkout-section__sub">
        First-time customer offer — {formatMoneyUsd(INTRO_CAMPAIGN.priceUsd)} for {INTRO_CAMPAIGN.homes.toLocaleString()}{" "}
        homeowners with {serviceLineLabel(INTRO_CAMPAIGN.serviceLine)}.
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
            <SummaryField label="Homes in order" value={INTRO_CAMPAIGN.homes.toLocaleString()} />
            <SummaryField label="Service" value={serviceLineLabel(INTRO_CAMPAIGN.serviceLine)} />
            <SummaryField label="Intro offer" value="First-time $99 package" />
            <SummaryField label="Total" value={formatMoneyUsd(INTRO_CAMPAIGN.priceUsd)} highlight />
          </div>

          <div className="buy-checkout-form-grid buy-checkout-form-grid--2">
            <label className="buy-checkout-field">
              <span className="buy-checkout-field__label">Email (delivery + receipt)</span>
              <input
                type="email"
                className="premium-input"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                autoComplete="email"
                disabled={busy}
                placeholder="you@yourbrokerage.com"
              />
            </label>
            <label className="buy-checkout-field">
              <span className="buy-checkout-field__label">Mobile phone</span>
              <input
                type="tel"
                className="premium-input"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                autoComplete="tel"
                disabled={busy}
                placeholder="+1 (555) 000-0000"
              />
            </label>
          </div>
          <p className="buy-checkout-secure">Secure checkout powered by Stripe</p>
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
          <p className="buy-checkout-secure buy-checkout-secure--stack">Secure checkout • Cancel anytime</p>
          <button
            type="button"
            className="btn btn-primary buy-checkout-cta-btn"
            disabled={checkoutDisabled}
            onClick={onCheckout}
          >
            {busy ? "Redirecting to Stripe…" : `Pay ${formatMoneyUsd(INTRO_CAMPAIGN.priceUsd)} securely →`}
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
