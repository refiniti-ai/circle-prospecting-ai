import { FlyerNeighborhoodSection } from "./FlyerNeighborhoodSection";
import { FlyerPricingGrid } from "./FlyerPricingGrid";
import { FlyerSectionHeading } from "./FlyerSectionHeading";
import {
  FLYER_PILLAR_IMAGE,
  FLYER_TESTIMONIALS,
  POSTER_PILLARS,
  POSTER_SHEET_BENEFITS,
  POSTER_SHEET_HEADLINE,
  POSTER_SHEET_INTRO,
  POSTER_SHEET_PROMISE,
  POSTER_SHEET_QUOTE,
  POSTER_TESTIMONIALS_HEADLINE,
} from "./marketingData";

function FlyerTargetGlyph() {
  return (
    <svg width={56} height={56} viewBox="0 0 48 48" fill="none" aria-hidden className="cp-flyer-local__glyph">
      <circle cx="24" cy="24" r="20" stroke="#5a9320" strokeWidth="1.8" fill="none" opacity="0.35" />
      <circle cx="24" cy="24" r="12" stroke="#5a9320" strokeWidth="1.6" fill="none" opacity="0.55" />
      <path d="M24 6v36M6 24h36" stroke="#5a9320" strokeWidth="1.4" opacity="0.5" />
      <circle cx="24" cy="24" r="8" fill="#5a9320" />
      <path d="M24 20l-3-2.5v-4.5h2.5v3h1V13h2.5v3h2.5v4.5L24 20z" fill="#fff" />
    </svg>
  );
}

function testimonialInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Client PDF layout for /campaign-pricing (section order matches print flyer). */
export function FlyerProductSheet() {
  return (
    <section id="pricing" className="cp-flyer-sheet" aria-label="Agent sales product sheet">
      <div className="container cp-flyer-sheet__inner">
        <section className="cp-flyer-local" aria-labelledby="cp-flyer-local-title">
          <FlyerTargetGlyph />
          <div className="cp-flyer-local__copy">
            <h2 id="cp-flyer-local-title" className="cp-flyer-local__title">
              {POSTER_SHEET_HEADLINE}
            </h2>
            <p className="cp-flyer-local__intro">{POSTER_SHEET_INTRO}</p>
          </div>
          <ul className="cp-flyer-local__pillars">
            {POSTER_PILLARS.map((p) => (
              <li key={p.title} className="cp-flyer-local__pillar">
                <img
                  src={FLYER_PILLAR_IMAGE[p.icon]}
                  alt=""
                  className="cp-flyer-local__pillar-img"
                  width={56}
                  height={56}
                  loading="lazy"
                  decoding="async"
                />
                <span className="cp-flyer-local__pillar-title">{p.title}</span>
                <span className="cp-flyer-local__pillar-d">{p.d}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="cp-flyer-block" aria-labelledby="cp-flyer-pricing-title">
          <FlyerSectionHeading id="cp-flyer-pricing-title">Pricing plans</FlyerSectionHeading>
          <FlyerPricingGrid />
        </section>

        <FlyerNeighborhoodSection />

        <section className="cp-flyer-benefits" aria-label="Core benefits, quote, and promise">
          <div className="cp-flyer-benefits__col">
            <h3 className="cp-flyer-benefits__h">Core agent benefits</h3>
            <ul className="cp-flyer-benefits__list">
              {POSTER_SHEET_BENEFITS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <blockquote className="cp-flyer-benefits__quote">
            <span className="cp-flyer-benefits__quote-mark" aria-hidden>
              “
            </span>
            <p>{POSTER_SHEET_QUOTE.body}</p>
            <p className="cp-flyer-benefits__quote-em">{POSTER_SHEET_QUOTE.emphasis}</p>
          </blockquote>
          <div className="cp-flyer-benefits__col cp-flyer-benefits__col--promise">
            <span className="cp-flyer-benefits__promise-icon" aria-hidden>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 19V5" strokeLinecap="round" />
                <path d="M4 15l4-3 3 3 5-6 4 4" strokeLinejoin="round" />
                <path d="M18 10v9H4" strokeLinejoin="round" />
              </svg>
            </span>
            <h3 className="cp-flyer-benefits__h">Our promise</h3>
            <p className="cp-flyer-benefits__promise-p">{POSTER_SHEET_PROMISE}</p>
          </div>
        </section>

        <section className="cp-flyer-block" aria-labelledby="cp-flyer-testimonials-title">
          <FlyerSectionHeading id="cp-flyer-testimonials-title">{POSTER_TESTIMONIALS_HEADLINE}</FlyerSectionHeading>
          <div className="cp-flyer-testimonials">
            {FLYER_TESTIMONIALS.map((t) => (
              <figure key={t.name} className="cp-flyer-testimonial">
                <span className="cp-flyer-testimonial__avatar" aria-hidden>
                  {testimonialInitials(t.name)}
                </span>
                <div className="cp-flyer-testimonial__stars" aria-label="5 out of 5 stars">
                  {"★★★★★"}
                </div>
                <blockquote className="cp-flyer-testimonial__quote">{t.quote}</blockquote>
                <figcaption className="cp-flyer-testimonial__cap">
                  <span className="cp-flyer-testimonial__name">{t.name}</span>
                  <span className="cp-flyer-testimonial__role">{t.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
