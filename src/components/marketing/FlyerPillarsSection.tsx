import { FLYER_PILLAR_IMAGE, POSTER_PILLARS, POSTER_SHEET_HEADLINE, POSTER_SHEET_INTRO } from "./marketingData";

/** Client PDF — “Local focus” row with AI / Live / Qualified artwork. */
export function FlyerPillarsSection() {
  return (
    <section className="cp-flyer-pillars" aria-labelledby="cp-flyer-pillars-title">
      <div className="cp-flyer-pillars__head">
        <h3 id="cp-flyer-pillars-title" className="cp-flyer-pillars__title">
          {POSTER_SHEET_HEADLINE}
        </h3>
        <p className="cp-flyer-pillars__intro">{POSTER_SHEET_INTRO}</p>
      </div>
      <ul className="cp-flyer-pillars__grid">
        {POSTER_PILLARS.map((p) => (
          <li key={p.title} className="cp-flyer-pillar-card">
            <img
              src={FLYER_PILLAR_IMAGE[p.icon]}
              alt=""
              className="cp-flyer-pillar-card__icon"
              width={72}
              height={72}
              loading="lazy"
              decoding="async"
            />
            <span className="cp-flyer-pillar-card__title">{p.title}</span>
            <span className="cp-flyer-pillar-card__d">{p.d}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
