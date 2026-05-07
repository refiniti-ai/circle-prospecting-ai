import { useCallback, useState, type CSSProperties } from "react";

type Props = {
  variant?: "header" | "footer";
  className?: string;
  style?: CSSProperties;
};

const BRAND_LOGO_SRC = "/circle-prospecting-logo.png";
const FALLBACKS = ["/circle-prospecting-logo.webp", "/circle-prospecting-logo.svg", "/logo.svg", "/logo.jpeg"] as const;

/**
 * Primary mark: wide PNG in `public/circle-prospecting-logo.png` (header + footer),
 * then webp/svg/jpeg fallbacks if load fails.
 */
export function BrandLogo({ variant = "header", className, style }: Props) {
  const [fallbackStep, setFallbackStep] = useState(0);
  const candidates = [BRAND_LOGO_SRC, ...FALLBACKS];
  const src = candidates[fallbackStep] ?? BRAND_LOGO_SRC;
  const lastIndex = candidates.length - 1;

  const onErr = useCallback(() => {
    setFallbackStep((i) => (i < lastIndex ? i + 1 : i));
  }, [lastIndex]);

  const h = variant === "header" ? 44 : 38;
  return (
    <img
      className={className}
      src={src}
      alt="Circle Prospecting AI"
      width={variant === "header" ? 220 : 200}
      height={h}
      style={{
        height: h,
        width: "auto",
        maxWidth: variant === "header" ? "min(100%, min(320px, 52vw))" : "min(100%, 280px)",
        display: "block",
        ...style,
      }}
      onError={fallbackStep < lastIndex ? onErr : undefined}
    />
  );
}
