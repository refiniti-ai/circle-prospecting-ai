import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { captureTrafficSourceFromSearch, readSearchPagePath } from "../lib/trafficSource";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Re-fire Meta Pixel PageView on React Router navigations (initial load is in index.html). */
export function MetaPixelTracker() {
  const location = useLocation();
  const isFirstLoad = useRef(true);

  useEffect(() => {
    captureTrafficSourceFromSearch(location.search);
    readSearchPagePath();
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [location.pathname, location.search]);

  return null;
}
