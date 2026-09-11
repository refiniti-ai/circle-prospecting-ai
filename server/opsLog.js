/** One-line JSON logs for support (Stripe session ids only; avoid PII in fields). */
export function opsLog(event, fields) {
    const payload = { t: new Date().toISOString() };
    for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined)
            payload[k] = v;
    }
    console.info(`[ops:${event}]`, JSON.stringify(payload));
}
