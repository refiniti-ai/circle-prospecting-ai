const TRUST_STEPS = [
  {
    label: "We pull homeowner records",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Our system activates your campaign",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3l7 3v5c0 4.2-2.8 7.9-7 9-4.2-1.1-7-4.8-7-9V6l7-3Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    label: "Calls begin within 24 hours",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6.5 4.8h2.2l1.4 3.4-1.7 1.2a11.5 11.5 0 0 0 5.4 5.4l1.2-1.7 3.4 1.4v2.2c0 .9-.7 1.6-1.6 1.7-7 .8-12.8-5-12-12 .1-.9.8-1.6 1.7-1.6Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "You receive lead activity and reporting",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 10.5 12 5l8 5.5V19a1 1 0 0 1-1 1h-5v-5.5H10V20H5a1 1 0 0 1-1-1v-8.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
] as const;

const COMPLIANCE_BADGES = [
  {
    title: "SSL",
    subtitle: "SECURE",
    tone: "green",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "GDPR",
    subtitle: "COMPLIANT",
    tone: "blue",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M12 7.5l1 2.8h2.9l-2.3 1.7.9 2.8-2.5-1.8-2.5 1.8.9-2.8-2.3-1.7h2.9l1-2.8Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    title: "SOC 2",
    subtitle: "TYPE II",
    tone: "blue",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3l7 3v5c0 4.2-2.8 7.9-7 9-4.2-1.1-7-4.8-7-9V6l7-3Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M10 12h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
] as const;

export function BuyOrderTrustStrip() {
  return (
    <section className="buy-order-trust" aria-label="Trust and order assurance">
      <article className="buy-order-trust__card buy-order-trust__card--quote">
        <p className="buy-order-trust__eyebrow">Trusted by real estate professionals</p>
        <p className="buy-order-trust__stars" aria-label="5 out of 5 stars">
          ★★★★★
        </p>
        <blockquote className="buy-order-trust__quote">
          &ldquo;Circle Prospecting generated 3 listing appointments from one new listing.&rdquo;
        </blockquote>
        <cite className="buy-order-trust__cite">— Jeff Borham</cite>
      </article>

      <article className="buy-order-trust__card buy-order-trust__card--steps">
        <h3 className="buy-order-trust__steps-title">Your order is reviewed and verified</h3>
        <ul className="buy-order-trust__steps">
          {TRUST_STEPS.map((step) => (
            <li key={step.label}>
              <span className="buy-order-trust__step-icon">{step.icon}</span>
              <span className="buy-order-trust__step-label">{step.label}</span>
            </li>
          ))}
        </ul>
      </article>

      <article className="buy-order-trust__card buy-order-trust__card--badges">
        <ul className="buy-order-trust__badges">
          {COMPLIANCE_BADGES.map((badge) => (
            <li key={badge.title} className={`buy-order-trust__badge buy-order-trust__badge--${badge.tone}`}>
              <span className="buy-order-trust__badge-icon">{badge.icon}</span>
              <span className="buy-order-trust__badge-text">
                <strong>{badge.title}</strong>
                <span>{badge.subtitle}</span>
              </span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
