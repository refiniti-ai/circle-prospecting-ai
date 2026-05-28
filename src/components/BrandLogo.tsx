import { useCallback, useState, type CSSProperties } from "react";
import "./BrandLogo.css";

type Props = {
  variant?: "header" | "footer";
  className?: string;
  style?: CSSProperties;
};

/** Header prefers `public/circle-prospecting-logo.webp`; footer keeps PNG first for email clients / older engines. */
const HEADER_SRC_ORDER = ["/circle-prospecting-logo.webp", "/circle-prospecting-logo.png", "/logo.svg"] as const;
const FOOTER_SRC_ORDER = ["/circle-prospecting-logo.png", "/circle-prospecting-logo.webp", "/logo.svg"] as const;

/**
 * Full wordmark lockup image (header + footer). Uses WebP/PNG in `public/`.
 */
export function BrandLogo({ variant = "header", className, style }: Props) {
  const [step, setStep] = useState(0);
  const candidates = variant === "header" ? HEADER_SRC_ORDER : FOOTER_SRC_ORDER;
  const first = candidates[0];
  const src = candidates[step] ?? first;
  const lastIndex = candidates.length - 1;

  const onErr = useCallback(() => {
    setStep((i) => (i < lastIndex ? i + 1 : i));
  }, [lastIndex]);

  const h = variant === "header" ? 44 : 38;

  const rootClass = ["brand-logo", variant === "footer" ? "brand-logo--footer" : "brand-logo--header", className]
    .filter(Boolean)
    .join(" ");

  return (
    <img
      className={rootClass}
      src={src}
      alt="Circle Prospecting AI"
      width={variant === "header" ? 320 : 280}
      height={h}
      style={{
        height: h,
        width: "auto",
        maxWidth: variant === "header" ? "min(100%, min(340px, 54vw))" : "min(100%, 300px)",
        display: "block",
        objectFit: "contain",
        objectPosition: "left center",
        ...style,
      }}
      onError={step < lastIndex ? onErr : undefined}
      decoding="async"
      draggable={false}
    />
  );
}
