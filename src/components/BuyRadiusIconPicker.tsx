import { FlyerRadiusBandIcon } from "./marketing/FlyerRadiusBandIcon";
import { FLYER_RADIUS_BULLETS, POSTER_RADIUS_TITLE } from "./marketing/marketingData";
import { LISTING_RADIUS_ORDER, type ListingPayload, type RadiusId } from "../lib/listingData";

const RADIUS_BAND_LABELS: Record<RadiusId, string> = {
  subdivision: "SUBDIVISION",
  q1: "1/4 MILE",
  h1: "1/2 MILE",
  m1: "1 MILE",
  zip: "ZIPCODE",
};

function TargetGlyph() {
  return (
    <svg width={48} height={48} viewBox="0 0 48 48" fill="none" aria-hidden className="buy-radius-picker__glyph">
      <circle cx="24" cy="24" r="20" stroke="#5a9320" strokeWidth="1.8" fill="none" opacity="0.35" />
      <circle cx="24" cy="24" r="12" stroke="#5a9320" strokeWidth="1.6" fill="none" opacity="0.55" />
      <path d="M24 6v36M6 24h36" stroke="#5a9320" strokeWidth="1.4" opacity="0.5" />
      <circle cx="24" cy="24" r="8" fill="#5a9320" />
      <path d="M24 20l-3-2.5v-4.5h2.5v3h1V13h2.5v3h2.5v4.5L24 20z" fill="#fff" />
    </svg>
  );
}

type Props = {
  listing: ListingPayload;
  selectedId: RadiusId;
  onSelect: (id: RadiusId) => void;
  disabled?: boolean;
};

/** Client flyer layout: intro column + five radius bands with icons, ranges, and radio selection. */
export function BuyRadiusIconPicker({ listing, selectedId, onSelect, disabled }: Props) {
  return (
    <section className="buy-radius-picker" aria-label="Choose target area">
      <div className="buy-radius-picker__box">
        <div className="buy-radius-picker__intro">
          <h2 className="buy-radius-picker__title">{POSTER_RADIUS_TITLE.toUpperCase()}</h2>
          <div className="buy-radius-picker__pitch">
            <TargetGlyph />
            <ul className="buy-radius-picker__bullets">
              {FLYER_RADIUS_BULLETS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="buy-radius-picker__bands" role="radiogroup" aria-label="Prospecting radius">
          {LISTING_RADIUS_ORDER.map((rid) => {
            const active = selectedId === rid;
            const homes = listing.radii[rid]?.count ?? 0;
            return (
              <button
                key={rid}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${RADIUS_BAND_LABELS[rid]} — ${homes.toLocaleString()} homeowners`}
                className={`buy-radius-picker__band${active ? " is-active" : ""}`}
                disabled={disabled}
                onClick={() => onSelect(rid)}
              >
                <span className="buy-radius-picker__band-label">{RADIUS_BAND_LABELS[rid]}</span>
                <span className="buy-radius-picker__icon">
                  <FlyerRadiusBandIcon id={rid} size={56} />
                </span>
                <span className="buy-radius-picker__range">{homes.toLocaleString()}</span>
                <span className="buy-radius-picker__range-unit">Homeowners</span>
                <span className="buy-radius-picker__radio" aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
