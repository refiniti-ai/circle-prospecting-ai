/** One-line JSON logs for support (Stripe session ids only; avoid PII in fields). */
export function opsLog(event: string, fields: Record<string, string | number | boolean | null | undefined>): void {
  const payload: Record<string, unknown> = { t: new Date().toISOString() };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) payload[k] = v;
  }
  console.info(`[ops:${event}]`, JSON.stringify(payload));
}
