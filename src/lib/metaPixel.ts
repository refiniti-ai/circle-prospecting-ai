declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Browser Purchase event — same eventID as server CAPI so Meta can dedupe. */
export function trackMetaPurchase(args: {
  eventId: string;
  valueCents: number | null;
  currency?: string | null;
  orderId?: string | null;
}): void {
  const eventId = args.eventId.trim();
  if (!eventId || args.valueCents == null || !Number.isFinite(args.valueCents)) return;

  const storageKey = `cpai_meta_purchase_${eventId}`;
  try {
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, "1");
  } catch {
    /* private mode — still fire once this load */
  }

  const value = args.valueCents / 100;
  const currency = (args.currency || "usd").toUpperCase();
  const orderId = args.orderId?.trim() || eventId;
  try {
    window.fbq?.(
      "track",
      "Purchase",
      {
        value,
        currency,
        content_type: "product",
        content_ids: [orderId],
        num_items: 1,
        order_id: orderId,
      },
      { eventID: eventId }
    );
  } catch {
    /* non-blocking */
  }
}
