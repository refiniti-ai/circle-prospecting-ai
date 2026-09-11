declare global {
  interface Window {
    fpr?: (...args: unknown[]) => void;
  }
}

/** Register an opt-in / signup with FirstPromoter (referral conversion). */
export function trackFirstPromoterReferral(email: string, uid?: string): void {
  const trimmed = email.trim();
  if (!trimmed.includes("@")) return;
  try {
    const payload: { email: string; uid?: string } = { email: trimmed };
    if (uid?.trim()) payload.uid = uid.trim();
    window.fpr?.("referral", payload);
  } catch {
    /* non-blocking */
  }
}
