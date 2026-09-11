/**
 * Send a sample order confirmation email through the configured mail transport.
 * Usage: GHL_MAIL_WEBHOOK_URL=... npx tsx scripts/send-order-email-test.ts user@example.com
 */
import { buildCustomerPurchaseEmail, sendTextEmail } from "../server/mailer.js";
const to = process.argv[2]?.trim();
if (!to || !to.includes("@")) {
    console.error("Usage: npx tsx scripts/send-order-email-test.ts recipient@example.com");
    process.exit(1);
}
const mail = buildCustomerPurchaseEmail({
    orderNumber: "CP-VERIFY-TEST",
    checkoutType: "lead_pack",
    sessionId: "cs_test_order_email_verify",
    lineItems: ["Lead pack (25 leads · AI + Live Calling)"],
    amountTotalCents: 30000,
    currency: "usd",
    firstName: "Test",
    lastName: "Buyer",
    listingAddress: "375 SEQUOIA DR, Lake Wales, FL 33859",
    mls: "O6264382",
    agentEmail: "agent@example.com",
    agentPhone: "5551234567",
    payLinkUrl: "https://circleprospecting.ai/listed/mls/O6264382",
});
const result = await sendTextEmail(to, mail.subject, mail.text, mail.html, { ghlExtras: mail.ghlFields });
console.log("Sent order confirmation preview", { to, mode: result.mode, subject: mail.subject });
