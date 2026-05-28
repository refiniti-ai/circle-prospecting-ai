type Props = { id: string; size?: number };

/** Illustrative icon per targeting ring — scales visually with reach. */
export function RadiusBandIcon({ id, size = 44 }: Props) {
  const s = size;
  const ring = (r: number, opacity = 0.85) => (
    <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" opacity={opacity} />
  );

  switch (id) {
    case "subdivision":
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" fill="none" aria-hidden className="rz-radius-band-icon__svg">
          <rect width="40" height="40" rx="12" fill="url(#rz-rad-sub-bg)" />
          <path
            d="M10 28V16l5-3 5 3v12M20 28V14l5-3 5 3v14"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M13 22h4M23 20h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
          <circle cx="20" cy="20" r="14" stroke="var(--cp-lime)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          <defs>
            <linearGradient id="rz-rad-sub-bg" x1="0" y1="0" x2="40" y2="40">
              <stop stopColor="rgba(5,12,26,0.04)" />
              <stop offset="1" stopColor="rgba(5,12,26,0.07)" />
            </linearGradient>
          </defs>
        </svg>
      );
    case "zip":
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" fill="none" aria-hidden className="rz-radius-band-icon__svg">
          <rect width="40" height="40" rx="12" fill="url(#rz-rad-zip-bg)" />
          <rect x="9" y="11" width="22" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.55" />
          {ring(15, 0.35)}
          <path
            d="M20 11c-3.3 0-6 2.7-6 6 0 4.5 6 11 6 11s6-6.5 6-11c0-3.3-2.7-6-6-6z"
            fill="var(--cp-blue)"
            stroke="#fff"
            strokeWidth="1.2"
          />
          <circle cx="20" cy="17" r="2" fill="#fff" />
          <defs>
            <linearGradient id="rz-rad-zip-bg" x1="0" y1="0" x2="40" y2="40">
              <stop stopColor="rgba(5,12,26,0.04)" />
              <stop offset="1" stopColor="rgba(5,12,26,0.07)" />
            </linearGradient>
          </defs>
        </svg>
      );
    case "q1":
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" fill="none" aria-hidden className="rz-radius-band-icon__svg">
          <rect width="40" height="40" rx="12" fill="url(#rz-rad-ring-bg)" />
          {ring(6, 0.4)}
          {ring(9)}
          <circle cx="20" cy="20" r="2.5" fill="var(--cp-lime)" />
          <defs>
            <linearGradient id="rz-rad-ring-bg" x1="0" y1="0" x2="40" y2="40">
              <stop stopColor="rgba(5,12,26,0.04)" />
              <stop offset="1" stopColor="rgba(5,12,26,0.07)" />
            </linearGradient>
          </defs>
        </svg>
      );
    case "h1":
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" fill="none" aria-hidden className="rz-radius-band-icon__svg">
          <rect width="40" height="40" rx="12" fill="url(#rz-rad-ring-bg-h)" />
          {ring(5, 0.35)}
          {ring(9, 0.55)}
          {ring(13)}
          <circle cx="20" cy="20" r="2.5" fill="var(--cp-blue)" />
          <defs>
            <linearGradient id="rz-rad-ring-bg-h" x1="0" y1="0" x2="40" y2="40">
              <stop stopColor="rgba(5,12,26,0.04)" />
              <stop offset="1" stopColor="rgba(5,12,26,0.07)" />
            </linearGradient>
          </defs>
        </svg>
      );
    case "m1":
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" fill="none" aria-hidden className="rz-radius-band-icon__svg">
          <rect width="40" height="40" rx="12" fill="url(#rz-rad-ring-bg-m)" />
          {ring(4, 0.3)}
          {ring(8, 0.45)}
          {ring(12, 0.65)}
          {ring(16)}
          <circle cx="20" cy="20" r="2.5" fill="var(--cp-lime)" stroke="#fff" strokeWidth="1" />
          <defs>
            <linearGradient id="rz-rad-ring-bg-m" x1="0" y1="0" x2="40" y2="40">
              <stop stopColor="rgba(5,12,26,0.04)" />
              <stop offset="1" stopColor="rgba(5,12,26,0.07)" />
            </linearGradient>
          </defs>
        </svg>
      );
  }
}
