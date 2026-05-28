import nodemailer from "nodemailer";

/** For /api/health — explains why mail is disabled when no transport is configured. */
export function getMailTransportInfo(): {
  configured: boolean;
  mode: "ghl" | "resend" | "smtp" | "none";
  /** Short hint when `configured` is false (safe to expose publicly). */
  setupHint: string;
} {
  if (process.env.GHL_MAIL_WEBHOOK_URL?.trim()) {
    return { configured: true, mode: "ghl", setupHint: "GHL inbound webhook" };
  }
  if (process.env.RESEND_API_KEY?.trim()) {
    return { configured: true, mode: "resend", setupHint: "Resend API" };
  }
  const smtpOk = Boolean(
    process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim()
  );
  if (smtpOk) {
    return { configured: true, mode: "smtp", setupHint: "SMTP" };
  }
  return {
    configured: false,
    mode: "none",
    setupHint:
      "On the API host (e.g. Cloud Run), set GHL_MAIL_WEBHOOK_URL, or RESEND_API_KEY + RESEND_FROM (verified domain), or SMTP_HOST + SMTP_USER + SMTP_PASS.",
  };
}

function firstEmailFromList(raw: string): string {
  const part = raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .find((s) => s.includes("@"));
  return part ?? raw.trim();
}

/**
 * Mail priority: GHL inbound webhook → Resend (RESEND_API_KEY) → SMTP → dev skip (log only).
 *
 * When GHL_MAIL_WEBHOOK_URL is set, transactional mail is POSTed to GHL’s Inbound Webhook.
 * Use a POST with JSON (GET / empty body will error — see GHL workflow docs).
 * @see https://help.gohighlevel.com/support/solutions/articles/155000003147-workflow-trigger-inbound-webhook
 */
async function sendViaResend(
  apiKey: string,
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<void> {
  const from =
    process.env.RESEND_FROM?.trim() || "Circle Prospecting AI <onboarding@resend.dev>";
  const recipients = to
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
  if (recipients.length === 0) throw new Error("Resend: no valid recipient");

  const body: Record<string, unknown> = { from, to: recipients, subject, text };
  if (html?.trim()) body.html = html;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`Resend failed (${r.status}) ${detail.slice(0, 200)}`);
  }
}

async function sendViaGhlMailWebhook(
  to: string,
  subject: string,
  text: string,
  html?: string,
  ghlExtras?: Record<string, string>
): Promise<void> {
  const url = process.env.GHL_MAIL_WEBHOOK_URL?.trim();
  if (!url) return;

  const token = process.env.GHL_BEARER_TOKEN?.trim();
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const email = firstEmailFromList(to);
  const safeHtml = html?.trim() || "";
  const payload = {
    source: "Circle Prospecting AI",
    event: "transactional_email",
    to,
    email,
    /** Common GHL workflow merge keys — map any of these in “Send Email”. */
    toEmail: email,
    recipient: email,
    recipientEmail: email,
    contact_email: email,
    subject,
    text,
    body: text,
    message: text,
    plainText: text,
    /** Map this in GHL “Send Email” as HTML body if your workflow supports it. */
    html: safeHtml,
    htmlBody: safeHtml,
    ...(ghlExtras && Object.keys(ghlExtras).length ? ghlExtras : {}),
  };

  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const respText = await r.text().catch(() => "");
  if (!r.ok) {
    throw new Error(`GHL mail webhook failed (${r.status}) ${respText.slice(0, 200)}`);
  }
  if (respText.length > 0 && respText.length < 500) {
    console.info("[mailer:ghl] webhook ok", r.status, respText.slice(0, 200));
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

export type SendTextEmailOptions = {
  /** Extra keys merged into GHL inbound webhook JSON (workflow custom values). */
  ghlExtras?: Record<string, string>;
};

/** @param html Optional HTML body; plain-text clients and spam filters still get `text`. */
export async function sendTextEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
  options?: SendTextEmailOptions
) {
  const ghlMail = process.env.GHL_MAIL_WEBHOOK_URL?.trim();
  if (ghlMail) {
    await sendViaGhlMailWebhook(to, subject, text, html, options?.ghlExtras);
    return { mode: "ghl" as const };
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    await sendViaResend(resendKey, to, subject, text, html);
    return { mode: "resend" as const };
  }

  const host = process.env.SMTP_HOST;
  const port = Number.parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "no-reply@circleprospecting.ai";

  if (!host || !user || !pass) {
    console.warn(
      "[MAILER:SKIPPED] No GHL_MAIL_WEBHOOK_URL, RESEND_API_KEY, or complete SMTP_* — transactional mail will not send. See GET /api/health mailSetupHint."
    );
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
    ...(html?.trim() ? { html } : {}),
  });
  return { mode: "sent" as const };
}

function formatMoney(cents: number | null | undefined, currency = "usd"): string {
  if (cents == null || !Number.isFinite(cents)) return "n/a";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Plain + HTML so GHL/Resend always get a non-empty HTML body (GHL workflows often map only `html` / `htmlBody`). */
export function buildPasswordResetEmailContent(
  resetLink: string,
  kind: "client" | "admin"
): { text: string; html: string } {
  const isClient = kind === "client";
  const intro = isClient
    ? "You asked to reset your dashboard password."
    : "You asked to reset your admin password.";
  const footer = isClient
    ? "If you did not request this, you can ignore this email."
    : "If you did not request this, ignore this email.";
  const text = `${intro}\n\nOpen this link (valid 1 hour):\n${resetLink}\n\n${footer}`;
  const href = escapeHtml(resetLink);
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:Segoe UI,system-ui,-apple-system,sans-serif;background:#f4f6f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
<tr><td style="padding:28px 24px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#334155;">${escapeHtml(intro)}</p>
<p style="margin:0 0 20px;">
<a href="${href}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#059669,#0284c7);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Reset password</a>
</p>
<p style="margin:0 0 8px;font-size:14px;color:#64748b;">This link expires in <strong>one hour</strong>. If the button does not work, copy and paste this URL into your browser:</p>
<p style="margin:0;font-size:13px;word-break:break-all;line-height:1.45;color:#0369a1;">${href}</p>
<p style="margin:20px 0 0;font-size:13px;color:#94a3b8;line-height:1.5;">${escapeHtml(footer)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { text, html };
}

/** Inbound website contact form → team inbox. */
export function buildContactFormEmail(args: { name: string; email: string; phone?: string; message: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `Website contact — ${args.name}`;
  const phoneLine = args.phone?.trim() ? args.phone.trim() : "—";
  const text = `New message from the Circle Prospecting AI contact form.

Name: ${args.name}
Email: ${args.email}
Phone: ${phoneLine}

Message:
${args.message}`;
  const safeName = escapeHtml(args.name);
  const safeEmail = escapeHtml(args.email);
  const safePhone = escapeHtml(phoneLine);
  const safeMsg = escapeHtml(args.message).replace(/\r\n|\n/g, "<br/>");
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;font-family:Segoe UI,system-ui,sans-serif;background:#f4f6f9;padding:20px;">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;">
<tr><td>
<p style="margin:0 0 12px;font-size:14px;color:#64748b;">Contact form submission</p>
<p style="margin:0 0 8px;"><strong>Name:</strong> ${safeName}</p>
<p style="margin:0 0 8px;"><strong>Email:</strong> <a href="mailto:${encodeURIComponent(args.email)}">${safeEmail}</a></p>
<p style="margin:0 0 16px;"><strong>Phone:</strong> ${safePhone}</p>
<p style="margin:0 0 8px;font-weight:600;color:#334155;">Message</p>
<p style="margin:0;font-size:15px;line-height:1.55;color:#1e293b;">${safeMsg}</p>
</td></tr></table>
</body></html>`;
  return { subject, text, html };
}

function purchaseTypeLabel(checkoutType: string): string {
  const t = checkoutType.toLowerCase();
  if (t === "lead_pack") return "Lead pack";
  if (t === "campaign") return "Campaign";
  return checkoutType || "Order";
}

function publicSiteBase(): string {
  const raw = process.env.APP_PUBLIC_URL?.trim() || "https://circle-prospecting-ai.web.app";
  return raw.replace(/\/$/, "");
}

function supportMailto(): string {
  return process.env.CONTACT_EMAIL?.trim() || process.env.SUPPORT_EMAIL?.trim() || "hello@circleprospecting.ai";
}

export function buildCustomerPurchaseEmail(args: {
  orderNumber: string;
  checkoutType: string;
  sessionId: string;
  lineItems: string[];
  amountTotalCents?: number | null;
  currency?: string | null;
}) {
  const subject = `Order confirmed — ${args.orderNumber} | Circle Prospecting AI`;
  const amount = formatMoney(args.amountTotalCents, args.currency ?? "usd");
  const typeLabel = purchaseTypeLabel(args.checkoutType);
  const lines = args.lineItems.map((line) => `- ${line}`).join("\n");
  const base = publicSiteBase();
  const logoUrl = `${base}/circle-prospecting-logo.png`;
  const loginUrl = `${base}/login`;
  const dashboardUrl = `${base}/dashboard`;
  const support = supportMailto();

  const text = `Hi,

Thank you for your order with Circle Prospecting AI. Your payment was received.

ORDER SUMMARY
-------------
Order number: ${args.orderNumber}
Purchase type: ${typeLabel}
Amount paid: ${amount}

Items:
${lines}

Reference (for support): ${args.sessionId}

NEXT STEPS
----------
• Log in to your client dashboard: ${loginUrl}
• View orders and delivery: ${dashboardUrl}

Questions? Reply to this email or write to ${support}.

— Circle Prospecting AI`;

  const safeOrder = escapeHtml(args.orderNumber);
  const safeType = escapeHtml(typeLabel);
  const safeAmount = escapeHtml(amount);
  const safeSession = escapeHtml(args.sessionId);
  const safeLogoSrc = escapeHtml(logoUrl);
  const itemsRows = args.lineItems
    .map(
      (line) =>
        `<tr><td style="padding:10px 12px;border-bottom:1px solid #e8ecf1;font-size:15px;color:#1a1d26;">${escapeHtml(line)}</td></tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f6f9;font-family:Segoe UI,system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(125deg,#059669 0%,#0d9488 38%,#0891b2 72%,#0284c7 100%);padding:28px 24px;text-align:center;">
              <img src="${safeLogoSrc}" width="200" alt="Circle Prospecting AI" style="display:block;margin:0 auto 16px;max-width:200px;width:200px;height:auto;border:0;outline:none;text-decoration:none;" />
              <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#ecfdf5;text-shadow:0 1px 2px rgba(15,23,42,0.15);">Circle Prospecting AI</div>
              <div style="margin-top:8px;font-size:14px;color:#d1fae5;opacity:0.98;">Order confirmation</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#334155;">Thank you for your purchase. Your payment was received successfully.</p>
              <table role="presentation" width="100%" style="border-collapse:collapse;background:#f8fafc;border-radius:8px;margin-bottom:20px;">
                <tr><td style="padding:14px 16px;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;font-weight:600;">Order number</td></tr>
                <tr><td style="padding:0 16px 14px;font-size:18px;font-weight:700;color:#0f172a;">${safeOrder}</td></tr>
                <tr><td colspan="2" style="border-top:1px solid #e2e8f0;padding:12px 16px;">
                  <span style="display:inline-block;width:48%;font-size:13px;color:#64748b;">Type</span>
                  <span style="display:inline-block;width:48%;text-align:right;font-size:15px;color:#1e293b;font-weight:600;">${safeType}</span>
                </td></tr>
                <tr><td colspan="2" style="padding:12px 16px 16px;">
                  <span style="display:inline-block;width:48%;font-size:13px;color:#64748b;">Total paid</span>
                  <span style="display:inline-block;width:48%;text-align:right;font-size:18px;color:#0369a1;font-weight:700;">${safeAmount}</span>
                </td></tr>
              </table>
              <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.05em;">Items</p>
              <table role="presentation" width="100%" style="border-collapse:collapse;border:1px solid #e8ecf1;border-radius:8px;overflow:hidden;margin-bottom:24px;">
                ${itemsRows}
              </table>
              <p style="margin:0 0 20px;font-size:12px;color:#94a3b8;">Support reference: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${safeSession}</code></p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:12px;">
                <tr>
                  <td style="border-radius:8px;background:linear-gradient(135deg,#0284c7,#0369a1);">
                    <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Log in to dashboard</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;line-height:1.5;color:#64748b;">
                View your orders anytime: <a href="${escapeHtml(dashboardUrl)}" style="color:#0284c7;">${escapeHtml(dashboardUrl)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 28px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:13px;line-height:1.55;color:#94a3b8;">
                Questions? Reply to this message or email <a href="mailto:${escapeHtml(support)}" style="color:#0284c7;">${escapeHtml(support)}</a>.
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:#cbd5e1;">© Circle Prospecting AI</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
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
