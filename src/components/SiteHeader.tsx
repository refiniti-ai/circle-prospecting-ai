import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";

const navItems = [
  { to: "/leads", label: "Product" },
  { to: "/how-it-works", label: "Features" },
  { to: "/campaign-pricing", label: "Pricing" },
  { to: "/coverage", label: "Coverage" },
  { to: "/content", label: "Content" },
];

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  function linkClass(active: boolean) {
    return active ? "nav-link-active" : "nav-link-muted";
  }

  return (
    <header className="site-header rz-site-header">
      <a href="#main-content" className="rz-skip-link">
        Skip to main content
      </a>
      <div className="rz-nav-slot">
        <div className="container rz-nav-outer">
          <div className="rz-nav-pill header-grid">
            <Link to="/" className="rz-nav-logo-hit" onClick={() => setOpen(false)}>
              <BrandLogo variant="header" className="header-logo-img" />
            </Link>
            <nav className="nav-desktop" aria-label="Main">
              {navItems.map((n) => (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => linkClass(isActive)} end>
                  {n.label}
                </NavLink>
              ))}
              <NavLink to="/buy-leads" className={({ isActive }) => (isActive ? "nav-link-buy-active" : "nav-link-buy")} end>
                Buy leads
              </NavLink>
            </nav>
            <div className="header-actions">
              <Link to="/content" className="btn btn-ghost rz-header-btn-demo" onClick={() => setOpen(false)}>
                Book a demo
              </Link>
              <Link to="/buy-leads" className="btn btn-primary rz-header-btn-primary" onClick={() => setOpen(false)}>
                Get started
                <IconArrow />
              </Link>
            </div>
            <button
              type="button"
              className={`nav-toggle${open ? " is-open" : ""}`}
              aria-expanded={open}
              aria-controls="rz-mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
            >
              <span aria-hidden />
              <span aria-hidden />
              <span aria-hidden />
            </button>
          </div>
          {open && (
            <div id="rz-mobile-menu" className="rz-mobile-drawer">
              {navItems.map((n) => (
                <NavLink key={n.to} to={n.to} end onClick={() => setOpen(false)} className={({ isActive }) => linkClass(isActive)}>
                  {n.label}
                </NavLink>
              ))}
              <NavLink to="/buy-leads" end onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? "nav-link-buy-active" : "nav-link-buy")}>
                Buy leads
              </NavLink>
              <Link to="/content" className="btn btn-ghost rz-mobile-btn-full" onClick={() => setOpen(false)}>
                Book a demo
              </Link>
              <Link to="/buy-leads" className="btn btn-primary rz-mobile-btn-full" onClick={() => setOpen(false)}>
                Get started <IconArrow />
              </Link>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .header-grid {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: clamp(0.75rem, 1.8vw, 1.2rem);
        }
        .rz-nav-logo-hit {
          display: flex;
          align-items: center;
          justify-self: start;
        }
        .nav-desktop {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(0.9rem, 1.8vw, 1.4rem);
          min-width: 0;
        }
        .nav-desktop a {
          font-weight: 500;
          font-size: 0.86rem;
          letter-spacing: -0.01em;
          white-space: nowrap;
        }
        .header-actions {
          justify-self: end;
          display: flex;
          align-items: center;
          gap: 0.55rem;
          flex-wrap: nowrap;
          justify-content: flex-end;
          min-width: 0;
        }
        .rz-header-btn-demo {
          padding: 0.48rem 1.05rem !important;
          font-size: 0.84rem !important;
          font-weight: 600 !important;
          border-radius: 999px !important;
          border: 1px solid rgba(5, 12, 26, 0.13) !important;
          background: #fff !important;
          color: #0f172a !important;
          white-space: nowrap;
        }
        .rz-header-btn-demo:hover:not(:disabled) {
          border-color: rgba(5, 12, 26, 0.2) !important;
          background: #fff !important;
        }
        .rz-header-btn-primary {
          padding: 0.48rem 1.05rem !important;
          font-size: 0.84rem !important;
          font-weight: 700 !important;
          gap: 0.35rem !important;
          white-space: nowrap;
        }
        .nav-toggle {
          display: none;
          justify-self: end;
          width: 40px;
          height: 40px;
          background: #fff;
          border: 1px solid rgba(5, 12, 26, 0.12);
          border-radius: 11px;
          color: var(--text);
          padding: 0;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 4px;
        }
        .nav-toggle span {
          display: block;
          width: 16px;
          height: 1.8px;
          border-radius: 2px;
          background: #0f172a;
          transition: transform 0.2s ease, opacity 0.2s ease;
          transform-origin: center;
        }
        .nav-toggle.is-open span:nth-child(1) {
          transform: translateY(5.8px) rotate(45deg);
        }
        .nav-toggle.is-open span:nth-child(2) {
          opacity: 0;
        }
        .nav-toggle.is-open span:nth-child(3) {
          transform: translateY(-5.8px) rotate(-45deg);
        }
        .rz-mobile-btn-full {
          width: 100%;
          justify-content: center !important;
        }
        .nav-link-muted { color: var(--muted); }
        .nav-link-muted:hover { color: var(--text); }
        .nav-link-active { color: var(--cp-blue, #007aff) !important; font-weight: 600 !important; }
        .nav-link-buy { color: var(--text) !important; font-weight: 600; }
        .nav-link-buy:hover { color: var(--text) !important; opacity: 0.9; }
        .nav-link-buy-active { color: var(--cp-blue, #007aff) !important; font-weight: 600 !important; }
        @media (max-width: 1280px) {
          .nav-desktop { display: none !important; }
          .header-actions { display: none !important; }
          .nav-toggle { display: inline-flex !important; }
          .header-grid { grid-template-columns: 1fr auto; gap: 0.6rem; }
        }
        @media (max-width: 420px) {
          .header-logo-img {
            max-width: 176px !important;
            height: auto !important;
          }
        }
      `}</style>
    </header>
  );
}
