import type { ListingAgentFormValues, ListingAgentRole } from "../lib/listingAgents";
import type { ListingCampaignType } from "../lib/listingData";

type Props = {
  role: ListingAgentRole;
  title: string;
  campaignLabel: string;
  campaignType: ListingCampaignType;
  values: ListingAgentFormValues;
  onChange: <K extends keyof ListingAgentFormValues>(field: K, value: ListingAgentFormValues[K]) => void;
  onSelectForOrder: () => void;
  isActive: boolean;
  disabled?: boolean;
};

export function ListingAgentCard({
  role,
  title,
  campaignLabel,
  values,
  onChange,
  onSelectForOrder,
  isActive,
  disabled,
}: Props) {
  return (
    <section
      className={`buy-agent-card buy-agent-card--${role}${isActive ? " is-active" : ""}`}
      aria-labelledby={`buy-agent-${role}-title`}
    >
      <div className="buy-agent-card__head">
        <h3 className="buy-agent-card__title" id={`buy-agent-${role}-title`}>
          {title}
        </h3>
        <span className={`buy-campaign-badge buy-campaign-badge--${campaignLabel === "Just sold" ? "just_sold" : "just_listed"}`}>
          {campaignLabel}
        </span>
      </div>
      <div className="buy-listing-form__grid buy-listing-form__grid--2">
        <label className="cp-form-grid">
          <span className="muted-label">Agent name</span>
          <input
            type="text"
            className="premium-input"
            value={values.name}
            onChange={(e) => onChange("name", e.target.value)}
            disabled={disabled}
            autoComplete="name"
          />
        </label>
        <label className="cp-form-grid">
          <span className="muted-label">Phone</span>
          <input
            type="tel"
            className="premium-input"
            value={values.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            disabled={disabled}
            autoComplete="tel"
          />
        </label>
      </div>
      <div className="buy-listing-form__grid buy-listing-form__grid--2">
        <label className="cp-form-grid">
          <span className="muted-label">Email</span>
          <input
            type="email"
            className="premium-input"
            value={values.email}
            onChange={(e) => onChange("email", e.target.value)}
            disabled={disabled}
            autoComplete="email"
          />
        </label>
        <label className="cp-form-grid">
          <span className="muted-label">Brokerage</span>
          <input
            type="text"
            className="premium-input"
            value={values.brokerage}
            onChange={(e) => onChange("brokerage", e.target.value)}
            disabled={disabled}
          />
        </label>
      </div>
      <button
        type="button"
        className={`btn ${isActive ? "btn-primary" : "btn-ghost"} buy-agent-card__cta`}
        disabled={disabled}
        onClick={onSelectForOrder}
      >
        {isActive ? "Ordering as this agent" : `Place order as ${title.toLowerCase()}`}
      </button>
    </section>
  );
}
