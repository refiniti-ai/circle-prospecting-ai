import { Link } from "react-router-dom";
import { BrandLogo } from "../BrandLogo";

export function IntroCampaignHeader() {
  return (
    <header className="intro-flyer-header">
      <div className="container intro-flyer-header__inner">
        <Link to="/" className="intro-flyer-header__logo">
          <BrandLogo variant="header" />
        </Link>
        <p className="intro-flyer-header__tagline">
          The #1 Neighborhood Marketing Platform for Real Estate Professionals
        </p>
      </div>
    </header>
  );
}
