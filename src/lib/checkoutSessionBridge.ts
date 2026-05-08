/** Remembers Stripe Checkout session id after thank-you page so /login can claim without showing cs_ to the user. */
export const PENDING_CHECKOUT_SESSION_KEY = "cpai_pending_checkout_session_id";

export function rememberCheckoutSessionId(sessionId: string | null | undefined): void {
  const s = sessionId?.trim() ?? "";
  if (s.length < 10) return;
  try {
    localStorage.setItem(PENDING_CHECKOUT_SESSION_KEY, s);
  } catch {
    /* quota / private mode */
  }
}

export function readPendingCheckoutSessionId(): string {
  try {
    return localStorage.getItem(PENDING_CHECKOUT_SESSION_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function clearPendingCheckoutSessionId(): void {
  try {
    localStorage.removeItem(PENDING_CHECKOUT_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
