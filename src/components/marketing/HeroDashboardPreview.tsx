import type { ReactNode } from "react";
import { HERO_MARKET_ACTIVITY_MAP } from "./marketingData";
import "./hero-dashboard.css";

const STATS = [
  { n: "2,350", l: "Leads Contacted" },
  { n: "150", l: "Conversations" },
  { n: "58", l: "Appointments" },
  { n: "37", l: "Live Transfers" },
  { n: "$84,300", l: "Est. Commission" },
] as const;

const DONUT_SEGMENTS = [
  { label: "Connected", pct: "45%", color: "#0066ff" },
  { label: "Voicemail", pct: "30%", color: "#22c55e" },
  { label: "No Answer", pct: "15%", color: "#f97316" },
  { label: "Other", pct: "10%", color: "#cbd5e1" },
] as const;

const ACTIVITY = [
  { title: "New Just Sold in Phoenix, AZ", time: "2m ago", tone: "blue" as const, icon: "pin" as const },
  { title: "High intent lead in Dallas, TX", time: "10m ago", tone: "blue" as const, icon: "user" as const },
  { title: "Voicemail left in Nashville, TN", time: "1h ago", tone: "green" as const, icon: "vm" as const },
];

const NAV = ["home", "users", "map", "phone", "chart", "settings"] as const;

function NavIcon({ type, active }: { type: (typeof NAV)[number]; active?: boolean }) {
  const stroke = active ? "#fff" : "rgba(255,255,255,0.55)";
  const icons: Record<(typeof NAV)[number], ReactNode> = {
    home: <path d="M5 10.5 12 4l7 6.5V19a1 1 0 01-1 1h-4v-5H10v5H6a1 1 0 01-1-1v-8.5z" />,
    users: (
      <>
        <circle cx="12" cy="9" r="3.2" />
        <path d="M5 20c0-3.5 3.1-5 7-5s7 1.5 7 5" />
      </>
    ),
    map: (
      <>
        <path d="M12 3s-5 5.5-5 9a5 5 0 1010 0c0-3.5-5-9-5-9z" />
        <circle cx="12" cy="12" r="1.8" fill={active ? "#fff" : stroke} stroke="none" />
      </>
    ),
    phone: <path d="M8 4h3l1.5 3-1.8 1.2a9 9 0 004.3 4.3L15 11l3 1.5V18a2 2 0 01-2 2A12 12 0 014 6a2 2 0 012-2z" />,
    chart: <path d="M5 18V10M12 18V6M19 18v-8" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
      </>
    ),
  };
  return (
    <span className={`rz-hero-dash__nav-ico${active ? " is-active" : ""}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {icons[type]}
      </svg>
    </span>
  );
}

function ActivityIcon({ kind }: { kind: "pin" | "user" | "vm" }) {
  if (kind === "user") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="5.5" r="2.2" fill="currentColor" />
        <path d="M3 13c0-2.5 2.2-3.8 5-3.8s5 1.3 5 3.8" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "vm") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="8" cy="8" r="1.6" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M8 2.5c-2.8 3.2-4 4.8-4 7a4 4 0 108 0c0-2.2-1.2-3.8-4-7z" fill="currentColor" />
      <circle cx="8" cy="9.2" r="1.3" fill="#fff" />
    </svg>
  );
}

/** Static dashboard mock for homepage hero (matches client reference). */
export function HeroDashboardPreview() {
  const r = 30;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const donutArcs = DONUT_SEGMENTS.map((seg) => {
    const pct = parseInt(seg.pct, 10) / 100;
    const len = c * pct;
    const arc = { ...seg, len, offset };
    offset -= len;
    return arc;
  });

  return (
    <div className="rz-hero-dash" role="img" aria-label="Dashboard preview showing leads, conversations, and market activity">
      <div className="rz-hero-dash__scene" aria-hidden>
        <div className="rz-hero-dash__blob">
          <div className="rz-hero-dash__blob-dots" />
        </div>
        <div className="rz-hero-dash__dots rz-hero-dash__dots--tr" />
        <svg className="rz-hero-dash__wave rz-hero-dash__wave--green" viewBox="0 0 80 420" preserveAspectRatio="none" aria-hidden>
          <path
            d="M58 8 C42 90, 68 170, 48 250 C32 320, 55 390, 38 412"
            fill="none"
            stroke="#22c55e"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.75"
          />
        </svg>
        <svg className="rz-hero-dash__wave rz-hero-dash__wave--blue" viewBox="0 0 80 420" preserveAspectRatio="none" aria-hidden>
          <path
            d="M68 20 C52 100, 78 180, 58 260 C42 330, 62 400, 48 418"
            fill="none"
            stroke="#0066ff"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.45"
          />
        </svg>
      </div>

      <div className="rz-hero-dash__frame">
        <aside className="rz-hero-dash__nav" aria-hidden>
          <img
            className="rz-hero-dash__nav-logo"
            src="/favicon.png"
            alt="Circle Prospecting AI"
            width={32}
            height={32}
            decoding="async"
          />
          {NAV.map((id) => (
            <NavIcon key={id} type={id} active={id === "map"} />
          ))}
        </aside>
        <div className="rz-hero-dash__main">
          <p className="rz-hero-dash__title">Overview</p>
          <div className="rz-hero-dash__stats">
            {STATS.map((s) => (
              <div key={s.l} className="rz-hero-dash__stat">
                <strong>{s.n}</strong>
                <span>{s.l}</span>
              </div>
            ))}
          </div>
          <div className="rz-hero-dash__grid">
            <div className="rz-hero-dash__card rz-hero-dash__card--map">
              <span className="rz-hero-dash__card-label">Market Activity</span>
              <div className="rz-hero-dash__map-wrap">
                <img
                  className="rz-hero-dash__map-img"
                  src={HERO_MARKET_ACTIVITY_MAP}
                  alt=""
                  loading="eager"
                  decoding="async"
                />
              </div>
            </div>
            <div className="rz-hero-dash__card rz-hero-dash__card--chart">
              <span className="rz-hero-dash__card-label">Conversations</span>
              <div className="rz-hero-dash__donut-wrap">
                <svg className="rz-hero-dash__donut" viewBox="0 0 88 88" aria-hidden>
                  <circle cx="44" cy="44" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
                  {donutArcs.map((seg) => (
                    <circle
                      key={seg.label}
                      cx="44"
                      cy="44"
                      r={r}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="12"
                      strokeDasharray={`${seg.len} ${c - seg.len}`}
                      strokeDashoffset={seg.offset}
                      transform="rotate(-90 44 44)"
                    />
                  ))}
                </svg>
                <ul className="rz-hero-dash__legend">
                  {DONUT_SEGMENTS.map((seg) => (
                    <li key={seg.label}>
                      <span className="rz-hero-dash__legend-swatch" style={{ background: seg.color }} />
                      <span>
                        {seg.label} <strong>{seg.pct}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="rz-hero-dash__card rz-hero-dash__card--activity">
              <span className="rz-hero-dash__card-label">Recent Activity</span>
              <ul className="rz-hero-dash__feed">
                {ACTIVITY.map((item) => (
                  <li key={item.title}>
                    <span className={`rz-hero-dash__feed-ico rz-hero-dash__feed-ico--${item.tone}`}>
                      <ActivityIcon kind={item.icon} />
                    </span>
                    <span className="rz-hero-dash__feed-text">{item.title}</span>
                    <span className="rz-hero-dash__feed-time">{item.time}</span>
                  </li>
                ))}
              </ul>
              <span className="rz-hero-dash__feed-link">View all activity →</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
