import { useEffect, useState } from "react";
import { DEFAULT_LISTING_PHOTO_PATH } from "../lib/listingData";
import "./ListingPhoto.css";

/** Branded “No Photo Available” placeholder — also used as GHL `listing_photo_url` default. */
export const LISTING_PHOTO_FALLBACK = DEFAULT_LISTING_PHOTO_PATH;

type Props = {
  url?: string | null;
  alt: string;
  className?: string;
  variant?: "hero" | "thumb";
  /** While listing/photo URL is still resolving — show skeleton, not the placeholder. */
  pending?: boolean;
};

function PhotoSkeleton({ variant, className }: { variant: "hero" | "thumb"; className: string }) {
  return (
    <div
      className={`listing-photo listing-photo--${variant} listing-photo--pending ${className}`.trim()}
      role="status"
      aria-busy="true"
      aria-label="Loading property photo"
    />
  );
}

/** Listing image — placeholder only when there is no photo URL after load; preloads remote URLs. */
export function ListingPhoto({ url, alt, className = "", variant = "hero", pending = false }: Props) {
  const [failed, setFailed] = useState(false);
  const [readySrc, setReadySrc] = useState<string | null>(null);
  const remote = url?.trim() || "";

  useEffect(() => {
    setFailed(false);
    setReadySrc(null);
    if (!remote) return;

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setReadySrc(remote);
    };
    img.onerror = () => {
      if (!cancelled) setFailed(true);
    };
    img.src = remote;
    return () => {
      cancelled = true;
    };
  }, [remote]);

  if (pending) {
    return <PhotoSkeleton variant={variant} className={className} />;
  }

  if (remote && !failed && !readySrc) {
    return <PhotoSkeleton variant={variant} className={className} />;
  }

  const usingFallback = !remote || failed;
  const src = usingFallback ? LISTING_PHOTO_FALLBACK : readySrc!;

  return (
    <img
      src={src}
      alt={alt}
      className={`listing-photo listing-photo--${variant}${usingFallback ? " is-fallback" : ""} ${className}`.trim()}
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
