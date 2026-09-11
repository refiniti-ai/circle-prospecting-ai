import { useEffect } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    fpr?: (...args: unknown[]) => void;
    scheduleFPRBuyLinks?: () => void;
  }
}

/** Re-fire FirstPromoter on React Router navigations (SPA page views). */
export function FirstPromoterTracker() {
  const location = useLocation();

  useEffect(() => {
    window.fpr?.("click");
    window.scheduleFPRBuyLinks?.();
  }, [location.pathname, location.search]);

  return null;
}
