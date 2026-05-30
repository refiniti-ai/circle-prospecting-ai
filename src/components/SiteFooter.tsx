import { Link } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";

export function SiteFooter() {
  const y = new Date().getFullYear();
  return (
    <footer className="rezora-site-footer rz-footer-rez rz-footer-rez--dark">
      <div className="rz-footer-rez-main">
        <div className="container rz-footer-rez-shell">
          <div className="rz-footer-rez-grid">
            <div className="rz-footer-rez-brand">
              <BrandLogo variant="footer" className="rz-footer-rez-logo" />
              <p className="rz-footer-rez-tagline">
                Data, dialer, and live callers—done-for-you prospecting that turns your market into conversations, appointments, and deals.
              </p>
            </div>
            <div>
              <p className="rz-footer-rez-col-title">Product</p>
              <nav className="rz-footer-rez-links" aria-label="Product links">
                <Link to="/leads">Product</Link>
                <Link to="/how-it-works">Features</Link>
                <Link to="/campaign-pricing">Pricing</Link>
                <Link to="/coverage">Coverage</Link>
                <Link to="/buy-leads">Start prospecting</Link>
              </nav>
            </div>
            <div>
              <p className="rz-footer-rez-col-title">Company</p>
              <nav className="rz-footer-rez-links" aria-label="Company links">
                <Link to="/contact">Contact</Link>
                <Link to="/dashboard">Client dashboard</Link>
                <Link to="/coverage">Areas</Link>
              </nav>
            </div>
            <div>
              <p className="rz-footer-rez-col-title">Legal</p>
              <nav className="rz-footer-rez-links" aria-label="Legal links">
                <Link to="/privacy">Privacy</Link>
                <Link to="/terms">Terms</Link>
              </nav>
            </div>
          </div>
          <div className="rz-footer-rez-meta">
            <p className="rz-footer-rez-copyright">
              © {y} Circle Prospecting AI · All rights reserved
            </p>
            <nav className="rz-footer-rez-meta-links" aria-label="Footer legal links">
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
              <a href="/#faq">FAQ</a>
              <Link to="/coverage">Coverage</Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
