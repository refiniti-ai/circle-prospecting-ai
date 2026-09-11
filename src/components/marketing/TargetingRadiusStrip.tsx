import { POSTER_RADIUS_BANDS } from "./marketingData";
import { RadiusBandIcon } from "./RadiusBandIcon";

import { POSTER_RADIUS_LEAD, POSTER_RADIUS_TITLE } from "./marketingData";

type Props = {
  /** `light` for white homepage sections; `dark` for sales-poster band. */
  variant?: "light" | "dark";
  className?: string;
  title?: string;
  lead?: string;
};

export function TargetingRadiusStrip({
  variant = "dark",
  className = "",
  title = POSTER_RADIUS_TITLE,
  lead = POSTER_RADIUS_LEAD,
}: Props) {
  const rootClass = ["rz-poster-radius", variant === "light" && "rz-poster-radius--light", className].filter(Boolean).join(" ");
  return (
    <div className={rootClass}>
      <h3 className="rz-poster-radius-h">{title}</h3>
      <p className="rz-poster-radius-lead">{lead}</p>
      <ul className="rz-poster-radius-row">
        {POSTER_RADIUS_BANDS.map((b) => (
          <li key={b.id} className="rz-poster-radius-cell" data-radius-id={b.id}>
            <span className="rz-radius-band-icon" aria-hidden>
              <RadiusBandIcon id={b.id} />
            </span>
            <span className="rz-poster-radius-miles">{b.label}</span>
            <span className="rz-poster-radius-homes">{b.homes}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
