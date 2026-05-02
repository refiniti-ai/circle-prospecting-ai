import { useEffect, useRef, useState } from "react";

export type UseScrollRevealOptions = {
  /** When true (default), observes viewport; disable for hero / static bands. */
  enabled?: boolean;
  rootMargin?: string;
};

/**
 * Scroll-triggered visibility: enclosing `<section>` gets `rz-scroll-reveal`
 * (+ `--visible`). Place `sentinelRef` on `.rz-reveal-sentinel` as first descendant of that section.
 * Stagger descendants with `.rz-stagger-child` and `--rz-stagger` style.
 */
export function useScrollReveal(options: UseScrollRevealOptions = {}) {
  const { enabled = true, rootMargin = "0px 0px -10% 0px" } = options;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [visible, setVisible] = useState(() => {
    if (!enabled) return true;
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (!enabled) {
      setVisible(true);
      return;
    }
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const node = sentinelRef.current;
    if (!node) return;

    const observed = (node.closest("section") ?? node) as HTMLElement;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          setVisible(true);
          observer.unobserve(observed);
        });
      },
      { threshold: [0.06, 0.12], rootMargin },
    );

    observer.observe(observed);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  const revealClassName = ["rz-scroll-reveal", visible ? "rz-scroll-reveal--visible" : ""].filter(Boolean).join(" ");

  return {
    sentinelRef,
    revealClassName,
    visible,
  };
}
