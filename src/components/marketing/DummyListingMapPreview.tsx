/** Static map preview for marketing — no Google Maps API required. */
export function DummyListingMapPreview({ radiusLabel = "½ mile radius" }: { radiusLabel?: string }) {
  return (
    <div className="rz-dummy-map" role="img" aria-label={`Sample listing map with ${radiusLabel} around the property`}>
      <svg className="rz-dummy-map__svg" viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="rz-dummy-map-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0a1424" />
            <stop offset="100%" stopColor="#111d32" />
          </linearGradient>
          <pattern id="rz-dummy-map-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(138,155,181,0.12)" strokeWidth="1" />
          </pattern>
          <radialGradient id="rz-dummy-map-glow" cx="50%" cy="48%" r="42%">
            <stop offset="0%" stopColor="rgba(50,213,131,0.22)" />
            <stop offset="70%" stopColor="rgba(50,213,131,0.06)" />
            <stop offset="100%" stopColor="rgba(50,213,131,0)" />
          </radialGradient>
        </defs>
        <rect width="640" height="400" fill="url(#rz-dummy-map-bg)" />
        <rect width="640" height="400" fill="url(#rz-dummy-map-grid)" />
        <rect width="640" height="400" fill="url(#rz-dummy-map-glow)" />
        {/* stylized roads */}
        <path
          d="M-20 210 Q 120 180 220 205 T 420 195 T 680 220"
          fill="none"
          stroke="rgba(30,144,255,0.35)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 80 380 L 80 20 M 280 400 L 280 0 M 480 380 L 480 40"
          fill="none"
          stroke="rgba(26,40,64,0.9)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 0 120 L 640 120 M 0 280 L 640 280"
          fill="none"
          stroke="rgba(26,40,64,0.75)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* radius ring */}
        <circle cx="320" cy="192" r="118" fill="rgba(50,213,131,0.1)" stroke="#32d583" strokeWidth="2.5" strokeOpacity="0.85" />
        <circle cx="320" cy="192" r="118" fill="none" stroke="rgba(30,144,255,0.45)" strokeWidth="1" strokeDasharray="6 8" />
        {/* listing pin */}
        <circle cx="320" cy="192" r="10" fill="#1e90ff" stroke="#fff" strokeWidth="2.5" />
        <path d="M320 202 L320 228 M310 218 L320 228 L330 218" fill="none" stroke="#1e90ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="rz-dummy-map__badge">
        <span className="rz-dummy-map__badge-dot" aria-hidden />
        Sample listing · {radiusLabel}
      </div>
      <p className="rz-dummy-map__hint">Illustrative preview — live checkout uses your listing address</p>
    </div>
  );
}
