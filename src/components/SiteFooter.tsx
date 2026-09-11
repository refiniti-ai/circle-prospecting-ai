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
                <Link to="/how-it-works">How it Works</Link>
                <Link to="/campaign-pricing">Pricing</Link>
                <Link to="/buy-leads">Start prospecting</Link>
              </nav>
            </div>
            <div>
              <p className="rz-footer-rez-col-title">Company</p>
              <nav className="rz-footer-rez-links" aria-label="Company links">
                <Link to="/contact">Contact</Link>
                <Link to="/dashboard">Client dashboard</Link>
              </nav>
            </div>
            <div>
              <p className="rz-footer-rez-col-title">Legal</p>
              <nav className="rz-footer-rez-links" aria-label="Legal links">
                <Link to="/privacy-policy">Privacy Policy</Link>
                <Link to="/terms-and-conditions">Terms &amp; Conditions</Link>
              </nav>
            </div>
          </div>
          <div className="rz-footer-rez-meta">
            <p className="rz-footer-rez-copyright">
              © {y} Circle Prospecting AI · All rights reserved
            </p>
            <nav className="rz-footer-rez-meta-links" aria-label="Footer legal links">
              <Link to="/privacy-policy">Privacy Policy</Link>
              <Link to="/terms-and-conditions">Terms &amp; Conditions</Link>
              <a href="/#faq">FAQ</a>
              <Link to="/how-it-works">How it Works</Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
