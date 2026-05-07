import { useId } from "react";

/** House + map pin on gradient tile — dark poster brand lockups. */
export function MarketingBrandMark({ size = 44, className = "" }: { size?: number; className?: string }) {
  const gid = useId().replace(/:/g, "");
  const gradId = `mbm-grad-${gid}`;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={gradId} x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#007aff" />
          <stop offset="1" stopColor="#a2d729" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#${gradId})`} />
      <g transform="translate(12 8) scale(0.92)">
        <path
          fill="rgba(255,255,255,0.94)"
          d="M12 22.5C7.86 22.5 4.5 19.14 4.5 15 4.5 10.86 7.86 7.5 12 7.5s7.5 3.36 7.5 7.5c0 4.5-7.5 12.2-7.5 12.2S4.5 19.5 4.5 15c0-4.14 3.36-7.5 7.5-7.5z"
        />
        <path
          fill="rgba(15,23,42,0.9)"
          d="M12 11.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z"
        />
      </g>
      <path
        fill="rgba(255,255,255,0.95)"
        d="M19 28.5h10v2.2H19V28.5zm5-5.4l-3.2 2.4H18l6-4.5 6 4.5h-2.8l-3.2-2.4z"
      />
    </svg>
  );
}
