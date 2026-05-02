export type StatIconId = "subdivision" | "homes" | "trend" | "contacts";

const A = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function StatBarGlyph({ id }: { id: StatIconId }) {
  switch (id) {
    case "subdivision":
      return (
        <svg {...A}>
          <rect x="3" y="10" width="5" height="9" rx="1" fill="rgba(0, 210, 255, 0.14)" stroke="currentColor" />
          <rect x="9.5" y="5" width="5" height="14" rx="1" fill="rgba(0, 114, 255, 0.1)" stroke="currentColor" />
          <rect x="16" y="12" width="5" height="7" rx="1" fill="rgba(0, 210, 255, 0.1)" stroke="currentColor" />
        </svg>
      );
    case "homes":
      return (
        <svg {...A}>
          <path d="M3 12l9-7 9 7v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8z" />
          <path d="M9 22V12h6v10" />
        </svg>
      );
    case "trend":
      return (
        <svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 18h4l3-6 4 3 5-8" />
          <path d="M17 7h4v4" />
        </svg>
      );
    case "contacts":
      return (
        <svg {...A}>
          <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0z" />
          <path d="M4 20a8 8 0 0 1 16 0" />
        </svg>
      );
  }
}

export function IconCheck() {
  return (
    <svg className="cp-check" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 6L9 17l-5-5"
        stroke="url(#ck)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="ck" x1="0" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent-cyan)" />
          <stop offset="1" stopColor="var(--accent-blue)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function IconDoc() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M8 13h8M8 17h5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

export function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l8 3v6c0 5-3.4 9.2-8 10-4.6-.8-8-5-8-10V6l8-3z"
        stroke="url(#sh)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="sh" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent-cyan)" />
          <stop offset="1" stopColor="var(--accent-blue)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function IconTarget() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="url(#tg)" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="4" stroke="url(#tg)" strokeWidth="1.5" />
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent-cyan)" />
          <stop offset="1" stopColor="var(--accent-blue)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export const TRUST_ITEMS: { icon: "stripe" | "soc" | "data"; t: string }[] = [
  { icon: "stripe", t: "Card payments with Stripe" },
  { icon: "soc", t: "Security practices you can document" },
  { icon: "data", t: "Clean exports your team verifies" },
];

export function TrustIcon({ kind }: { kind: "stripe" | "soc" | "data" }) {
  if (kind === "stripe") {
    return (
      <span className="cp-trust-ico" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="9" width="18" height="9" rx="2" stroke="url(#t1)" strokeWidth="1.3" />
          <path d="M7 9V7a2 2 0 012-2h6a2 2 0 012 2v2" stroke="url(#t1)" strokeWidth="1.3" />
          <defs>
            <linearGradient id="t1" x1="0" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--accent-cyan)" />
              <stop offset="1" stopColor="var(--accent-blue)" />
            </linearGradient>
          </defs>
        </svg>
      </span>
    );
  }
  if (kind === "soc") {
    return (
      <span className="cp-trust-ico" aria-hidden>
        <IconShield />
      </span>
    );
  }
  return (
    <span className="cp-trust-ico" aria-hidden>
      <IconTarget />
    </span>
  );
}
