import type { ListingFormValues } from "../lib/listingData";

export type { ListingFormValues };

type Props = {
  values: ListingFormValues;
  onChange: <K extends keyof ListingFormValues>(field: K, value: ListingFormValues[K]) => void;
  disabled?: boolean;
  /** When true, agent contact fields are shown on separate buyer/seller cards. */
  propertyOnly?: boolean;
};

export function ListingCampaignForm({ values, onChange, disabled, propertyOnly }: Props) {
  return (
    <div className="buy-listing-form">
      {!propertyOnly ? (
        <>
          <div className="buy-listing-form__grid buy-listing-form__grid--2">
            <label className="cp-form-grid">
              <span className="muted-label">Agent name</span>
              <input
                type="text"
                className="premium-input"
                value={values.agentName}
                onChange={(e) => onChange("agentName", e.target.value)}
                autoComplete="name"
                disabled={disabled}
                placeholder="Your name"
              />
            </label>
            <label className="cp-form-grid">
              <span className="muted-label">MLS #</span>
              <input
                type="text"
                className="premium-input"
                value={values.mls}
                onChange={(e) => onChange("mls", e.target.value)}
                disabled={disabled}
                placeholder="TB8502524"
              />
            </label>
          </div>
          <div className="buy-listing-form__grid buy-listing-form__grid--2">
            <label className="cp-form-grid">
              <span className="muted-label">Phone</span>
              <input
                type="tel"
                className="premium-input"
                value={values.phone}
                onChange={(e) => onChange("phone", e.target.value)}
                autoComplete="tel"
                disabled={disabled}
                placeholder="+1 (555) 000-0000"
              />
            </label>
            <label className="cp-form-grid">
              <span className="muted-label">Email</span>
              <input
                type="email"
                className="premium-input"
                value={values.email}
                onChange={(e) => onChange("email", e.target.value)}
                autoComplete="email"
                disabled={disabled}
                placeholder="you@yourbrokerage.com"
              />
            </label>
          </div>
          <div className="buy-listing-form__grid buy-listing-form__grid--2">
            <label className="cp-form-grid">
              <span className="muted-label">Brokerage (optional)</span>
              <input
                type="text"
                className="premium-input"
                value={values.brokerage}
                onChange={(e) => onChange("brokerage", e.target.value)}
                disabled={disabled}
                placeholder="EXP Realty LLC"
              />
            </label>
            <label className="cp-form-grid">
              <span className="muted-label">Property address (street)</span>
              <input
                id="buy-listing-address"
                type="text"
                className="premium-input"
                value={values.streetAddress}
                onChange={(e) => onChange("streetAddress", e.target.value)}
                disabled={disabled}
                autoComplete="street-address"
                placeholder="1775 Stable Trl"
              />
            </label>
          </div>
        </>
      ) : (
        <label className="cp-form-grid">
          <span className="muted-label">MLS #</span>
          <input
            type="text"
            className="premium-input"
            value={values.mls}
            onChange={(e) => onChange("mls", e.target.value)}
            disabled={disabled}
            placeholder="TB8502524"
          />
        </label>
      )}
      {propertyOnly ? (
        <label className="cp-form-grid">
          <span className="muted-label">Property address (street)</span>
          <input
            id="buy-listing-address"
            type="text"
            className="premium-input"
            value={values.streetAddress}
            onChange={(e) => onChange("streetAddress", e.target.value)}
            disabled={disabled}
            autoComplete="street-address"
            placeholder="1775 Stable Trl"
          />
        </label>
      ) : null}
      <div className="buy-listing-form__grid buy-listing-form__grid--3">
        <label className="cp-form-grid">
          <span className="muted-label">City</span>
          <input
            type="text"
            className="premium-input"
            value={values.city}
            onChange={(e) => onChange("city", e.target.value)}
            disabled={disabled}
            autoComplete="address-level2"
          />
        </label>
        <label className="cp-form-grid">
          <span className="muted-label">State</span>
          <input
            type="text"
            className="premium-input"
            value={values.stateCode}
            onChange={(e) => onChange("stateCode", e.target.value.toUpperCase().slice(0, 2))}
            disabled={disabled}
            maxLength={2}
            autoComplete="address-level1"
            placeholder="FL"
          />
        </label>
        <label className="cp-form-grid">
          <span className="muted-label">ZIP</span>
          <input
            type="text"
            className="premium-input"
            value={values.zip}
            onChange={(e) => onChange("zip", e.target.value.replace(/\D/g, "").slice(0, 5))}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="34685"
          />
        </label>
      </div>
    </div>
  );
}
