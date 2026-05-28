import { useState } from "react";
import { BROKERAGE_LOGOS, TRUSTED_BROKERAGES_HEADLINE, type BrokerageLogo } from "./marketingData";

function BrokerageLogoSlide({ logo }: { logo: BrokerageLogo }) {
  const [useFallback, setUseFallback] = useState(false);

  return (
    <div className="rz-brokerage-trust__slide" role="listitem">
      <div className="rz-brokerage-logo-card">
        {!useFallback ? (
          <img
            src={logo.src}
            alt={logo.alt}
            width={280}
            height={72}
            loading="lazy"
            decoding="async"
            className="rz-brokerage-logo-img"
            onError={() => setUseFallback(true)}
          />
        ) : (
          <span className="rz-brokerage-logo-fallback" aria-label={logo.alt}>
            {logo.name}
          </span>
        )}
      </div>
    </div>
  );
}

/** Infinite logo carousel — tight ~24px gaps (BidOnHomes-style). */
export function BrokerageTrustCarousel({ embed = false }: { embed?: boolean }) {
  const doubled = [...BROKERAGE_LOGOS, ...BROKERAGE_LOGOS];

  return (
    <section
      id="trusted-brokerages"
      className={`rz-brokerage-trust rz-reveal-static${embed ? " rz-brokerage-trust--embed" : ""}`}
      aria-labelledby="rz-brokerage-trust-title"
      aria-roledescription="carousel"
    >
      <div className="container rz-brokerage-trust__inner">
        <h2 id="rz-brokerage-trust-title" className="rz-brokerage-trust__title">
          {TRUSTED_BROKERAGES_HEADLINE}
        </h2>
      </div>
      <div className="rz-brokerage-trust__viewport">
        <div className="rz-brokerage-trust__track" role="list">
          {doubled.map((logo, i) => (
            <BrokerageLogoSlide key={`${logo.id}-${i}`} logo={logo} />
          ))}
        </div>
      </div>
    </section>
  );
}
