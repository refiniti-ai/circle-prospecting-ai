import nodemailer from "nodemailer";

function firstEmailFromList(raw: string): string {
  const part = raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .find((s) => s.includes("@"));
  return part ?? raw.trim();
}

/**
 * When GHL_MAIL_WEBHOOK_URL is set, transactional mail is POSTed to GHL’s Inbound Webhook.
 * Use a POST with JSON (GET / empty body will error — see GHL workflow docs).
 * @see https://help.gohighlevel.com/support/solutions/articles/155000003147-workflow-trigger-inbound-webhook
 */
async function sendViaGhlMailWebhook(to: string, subject: string, text: string): Promise<void> {
  const url = process.env.GHL_MAIL_WEBHOOK_URL?.trim();
  if (!url) return;

  const token = process.env.GHL_BEARER_TOKEN?.trim();
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const email = firstEmailFromList(to);
  const payload = {
    source: "Circle Prospecting AI",
    event: "transactional_email",
    to,
    email,
    subject,
    text,
    body: text,
    message: text,
  };

  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`GHL mail webhook failed (${r.status}) ${detail.slice(0, 200)}`);
  }
}

export function buildMarketingEmail(args: {
  agentName: string;
  address: string;
  cityStateZip: string;
  counts: { subdivision: number; q1: number; h1: number; m1: number; zip: number };
  orderLink: string;
}) {
  const subject = `New Listing Detected – Promote ${args.address}`;
  const body = `Hi ${args.agentName},

Congratulations on your new listing at:

${args.address}, ${args.cityStateZip}

This is a perfect opportunity to generate additional buyer and seller leads by targeting nearby homeowners.

Here are your available targeting options:
- Subdivision: ${args.counts.subdivision.toLocaleString()} homes
- 1/4 Mile: ${args.counts.q1.toLocaleString()} homes
- 1/2 Mile: ${args.counts.h1.toLocaleString()} homes
- 1 Mile: ${args.counts.m1.toLocaleString()} homes
- ZIP Code: ${args.counts.zip.toLocaleString()} homes

Our Pro Plan (AI + Live Calling) is recommended for maximum results.

Click below to launch your campaign in minutes:

${args.orderLink}

No setup required — your listing is already loaded.

Let’s turn this listing into more deals.

– Circle Prospecting AI Team`;

  return { subject, body };
}

export async function sendMarketingEmail(to: string, subject: string, text: string) {
  return sendTextEmail(to, subject, text);
}

export async function sendTextEmail(to: string, subject: string, text: string) {
  const ghlMail = process.env.GHL_MAIL_WEBHOOK_URL?.trim();
  if (ghlMail) {
    await sendViaGhlMailWebhook(to, subject, text);
    return { mode: "ghl" as const };
  }

  const host = process.env.SMTP_HOST;
  const port = Number.parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "no-reply@circleprospecting.ai";

  if (!host || !user || !pass) {
    // Dev-safe fallback: logs email content
    console.info("[MAILER:SKIPPED]", { to, subject, preview: text.slice(0, 200) });
    return { mode: "skipped" as const };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from,
    to,
    subject,
    text,
  });
  return { mode: "sent" as const };
}

function formatMoney(cents: number | null | undefined, currency = "usd"): string {
  if (cents == null || !Number.isFinite(cents)) return "n/a";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export function buildCustomerPurchaseEmail(args: {
  orderNumber: string;
  checkoutType: string;
  sessionId: string;
  lineItems: string[];
  amountTotalCents?: number | null;
  currency?: string | null;
}) {
  const subject = `Thanks for your purchase — Order ${args.orderNumber}`;
  const body = `Thank you for your purchase.

Order number: ${args.orderNumber}
Session: ${args.sessionId}
Purchase type: ${args.checkoutType}
Amount paid: ${formatMoney(args.amountTotalCents, args.currency ?? "usd")}

Items:
${args.lineItems.map((line) => `- ${line}`).join("\n")}

If you have questions, reply to this email.

- Circle Prospecting AI`;
  return { subject, body };
}

export function buildAdminPurchaseEmail(args: {
  orderNumber: string;
  checkoutType: string;
  sessionId: string;
  customerEmail?: string;
  lineItems: string[];
  amountTotalCents?: number | null;
  currency?: string | null;
}) {
  const subject = `New purchase received — ${args.orderNumber}`;
  const body = `A new purchase has been completed.

Order number: ${args.orderNumber}
Session: ${args.sessionId}
Purchase type: ${args.checkoutType}
Customer email: ${args.customerEmail || "n/a"}
Amount paid: ${formatMoney(args.amountTotalCents, args.currency ?? "usd")}

Items:
${args.lineItems.map((line) => `- ${line}`).join("\n")}

This notification was sent by Circle Prospecting AI.`;
  return { subject, body };
}
