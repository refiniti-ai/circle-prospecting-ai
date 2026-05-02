import { useCallback, useState, type CSSProperties } from "react";

type Props = {
  variant?: "header" | "footer";
  className?: string;
  style?: CSSProperties;
};

const HEADER_LOGO_SRC = "/circle-prospecting-logo.webp";
const FOOTER_LOGO_SRC = "/circle-logo.webp";
const FALLBACKS = ["/logo.jpeg", "/logo.svg"] as const;

/**
 * Header uses `circle-prospecting-logo.webp`; footer uses `circle-logo.webp`,
 * then JPEG/SVG fallbacks if load fails.
 */
export function BrandLogo({ variant = "header", className, style }: Props) {
  const [fallbackStep, setFallbackStep] = useState(0);
  const primarySrc = variant === "footer" ? FOOTER_LOGO_SRC : HEADER_LOGO_SRC;
  const candidates = [primarySrc, ...FALLBACKS];
  const src = candidates[fallbackStep] ?? primarySrc;
  const lastIndex = candidates.length - 1;

  const onErr = useCallback(() => {
    setFallbackStep((i) => (i < lastIndex ? i + 1 : i));
  }, [lastIndex]);

  const h = variant === "header" ? 46 : 40;
  return (
    <img
      className={className}
      src={src}
      alt="Circle Prospecting AI"
      width={variant === "header" ? 320 : 280}
      height={h}
      style={{
        height: h,
        width: "auto",
        maxWidth: variant === "header" ? "min(100%, 305px)" : "100%",
        display: "block",
        ...style,
      }}
      onError={fallbackStep < lastIndex ? onErr : undefined}
    />
  );
}
