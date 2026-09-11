type Props = { id: string; size?: number };

/** Client radius band SVGs in /public (Buy Leads + campaign-pricing). */
const FLYER_RADIUS_ICON_SRC: Record<string, string> = {
  subdivision: "/subdivision.svg",
  q1: "/1.4%20Mile.svg",
  h1: "/1.2%20Mile.svg",
  m1: "/1%20Mile.svg",
  zip: "/Zipcode.svg",
};

/** Radius band icons (client-supplied artwork). */
export function FlyerRadiusBandIcon({ id, size = 56 }: Props) {
  const src = FLYER_RADIUS_ICON_SRC[id] ?? FLYER_RADIUS_ICON_SRC.m1;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="cp-flyer-rad-icon cp-flyer-rad-icon-img"
      loading="eager"
      decoding="async"
    />
  );
}
