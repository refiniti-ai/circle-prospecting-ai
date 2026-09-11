import {
  FLYER_RADIUS_BANDS,
  FLYER_RADIUS_BULLETS,
  POSTER_RADIUS_TITLE,
} from "./marketingData";
import { FlyerRadiusBandIcon } from "./FlyerRadiusBandIcon";

function FlyerTargetGlyph() {
  return (
    <svg width={48} height={48} viewBox="0 0 48 48" fill="none" aria-hidden className="cp-flyer-neighborhood__glyph">
      <circle cx="24" cy="24" r="20" stroke="#5a9320" strokeWidth="1.8" fill="none" opacity="0.35" />
      <circle cx="24" cy="24" r="12" stroke="#5a9320" strokeWidth="1.6" fill="none" opacity="0.55" />
      <path d="M24 6v36M6 24h36" stroke="#5a9320" strokeWidth="1.4" opacity="0.5" />
      <circle cx="24" cy="24" r="8" fill="#5a9320" />
      <path
        d="M24 20l-3-2.5v-4.5h2.5v3h1V13h2.5v3h2.5v4.5L24 20z"
        fill="#fff"
      />
    </svg>
  );
}

/** Client PDF layout: bordered box, left pitch + five columns with dotted dividers. */
export function FlyerNeighborhoodSection() {
  return (
    <section className="cp-flyer-neighborhood" aria-labelledby="cp-flyer-neighborhood-title">
      <div className="cp-flyer-neighborhood__box">
        <div className="cp-flyer-neighborhood__intro">
          <h3 id="cp-flyer-neighborhood-title" className="cp-flyer-neighborhood__title">
            {POSTER_RADIUS_TITLE}
          </h3>
          <div className="cp-flyer-neighborhood__pitch">
            <FlyerTargetGlyph />
            <ul className="cp-flyer-neighborhood__bullets">
              {FLYER_RADIUS_BULLETS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
        <ul className="cp-flyer-neighborhood__bands">
          {FLYER_RADIUS_BANDS.map((b) => (
            <li key={b.id} className="cp-flyer-neighborhood__band">
              <FlyerRadiusBandIcon id={b.id} size={56} />
              <span className="cp-flyer-neighborhood__band-label">{b.label}</span>
              <span className="cp-flyer-neighborhood__band-homes">{b.homes}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
