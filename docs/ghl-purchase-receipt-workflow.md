# GHL workflow: purchase receipt & admin alerts

After Stripe checkout, the API sends transactional mail through **one inbound webhook** (`GHL_MAIL_WEBHOOK_URL`). The same workflow handles:

1. **Customer order confirmation** (HTML receipt)
2. **Team copy** of the same HTML receipt to `info@circleprospecting.ai` (default; override with `PURCHASE_NOTIFICATION_EMAIL` on Cloud Run)

Stripe’s own “you received a payment” email is separate — that comes from Stripe, not this workflow.

---

## When emails fire

| Trigger | Code path |
|---------|-----------|
| Stripe `checkout.session.completed` | `server/stripeWebhook.ts` → `applyPaidCheckoutSessionSideEffects()` |
| Thank-you page sync (backup) | `POST /api/checkout/sync-paid-session` |

Customer subject example: `Order confirmed — CP-BMOJCRJ66W | Circle Prospecting AI`  
Team copy subject example: `[Copy] Order confirmed — CP-BMOJCRJ66W | Circle Prospecting AI`

---

## Cloud Run env (production)

| Variable | Value |
|----------|--------|
| `GHL_MAIL_WEBHOOK_URL` | Purchase-receipt inbound webhook (POST JSON only — GET in browser will error) |
| `PURCHASE_NOTIFICATION_EMAIL` | `info@circleprospecting.ai` (set on revision `00131+`) |

Optional: `GHL_BEARER_TOKEN` if the webhook requires Authorization.

Verify mail transport: `GET https://<api-host>/api/health` → `mailConfigured: true`, `mailTransport: "ghl"`.

---

## Webhook JSON payload (from our API)

Every send POSTs JSON like:

```json
{
  "source": "Circle Prospecting AI",
  "event": "transactional_email",
  "to": "customer@example.com",
  "email": "customer@example.com",
  "toEmail": "customer@example.com",
  "recipient": "customer@example.com",
  "recipientEmail": "customer@example.com",
  "contact_email": "customer@example.com",
  "subject": "Order confirmed — CP-XXXXXXXXXX | Circle Prospecting AI",
  "text": "Hi,\n\nThank you for your order...",
  "body": "Hi,\n\nThank you for your order...",
  "message": "Hi,\n\nThank you for your order...",
  "plainText": "Hi,\n\nThank you for your order...",
  "html": "<!DOCTYPE html>...",
  "htmlBody": "<!DOCTYPE html>...",
  "orderNumber": "CP-BMOJCRJ66W",
  "firstName": "Maria",
  "lastName": "Garcia",
  "listingAddress": "123 Main St, Tampa, FL 33602",
  "mls": "TB8419229",
  "amountPaid": "$300.00",
  "purchasedAmount": "$300.00",
  "purchaseType": "Lead pack",
  "logoUrl": "https://circleprospecting.ai/circle-prospecting-logo.webp",
  "loginUrl": "https://circleprospecting.ai/login",
  "dashboardUrl": "https://circleprospecting.ai/dashboard",
  "sessionId": "cs_live_..."
}
```

**Customer receipt:** `to` = buyer email from Stripe Checkout.  
**Admin alert:** `to` = `info@circleprospecting.ai` (plain text only, no `html`).

The `html` field is a **complete branded email** (logo in header, order summary, CTA). Extra top-level keys (`logoUrl`, `orderNumber`, etc.) are for GHL-native templates if you prefer building the body in GHL instead of using `html` as-is.

---

## Email template (logo placement)

### Option A — recommended (zero design work)

In the GHL **Send Email** action, set the HTML body to **only**:

```
{{inboundWebhookRequest.html}}
```

The API already embeds the logo at the top of that HTML (`circle-prospecting-logo.webp` on `circleprospecting.ai`).

### Option B — GHL-built template with logo merge field

Paste the HTML from [`docs/email-templates/order-confirmation-ghl.html`](./email-templates/order-confirmation-ghl.html) into GHL **Quick compose** (HTML mode). Map merge fields:

| GHL merge field | Webhook key |
|-----------------|-------------|
| Logo image `src` | `{{inboundWebhookRequest.logoUrl}}` |
| First name | `{{inboundWebhookRequest.first_name}}` |
| Last name | `{{inboundWebhookRequest.last_name}}` |
| Listing address | `{{inboundWebhookRequest.listing_address}}` |
| MLS | `{{inboundWebhookRequest.mls}}` |
| Purchased amount | `{{inboundWebhookRequest.purchased_amount}}` |
| Order number | `{{inboundWebhookRequest.order_number}}` |
| Login button `href` | `{{inboundWebhookRequest.login_url}}` |

GHL often exposes webhook keys as **snake_case**. The API sends both forms (`firstName` and `first_name`, etc.).

**Logo on teal header:** wrap the image in a **white box** (see paste template) — `circle-prospecting-logo.webp` has a dark background and looks black on the gradient without it.

**To** must still be `{{inboundWebhookRequest.email}}`. **Subject:** `{{inboundWebhookRequest.subject}}`.

### GHL test payload (with logo + table fields)

Use [`docs/email-templates/ghl-webhook-test-payload.json`](./email-templates/ghl-webhook-test-payload.json) on the **Inbound Webhook** trigger → **Save sample data** → **Test**. Keys must be **snake_case** for the paste template merge fields.

**Easiest path:** set email body to only `{{inboundWebhookRequest.html}}` — values are pre-filled by the API (no empty merge fields).

---

## GHL workflow setup

### 1. Create workflow

1. **Automation → Workflows → Create workflow**
2. **Trigger:** Inbound Webhook
3. Copy the webhook URL into Cloud Run as `GHL_MAIL_WEBHOOK_URL` (if not already)

### 2. Create or update contact (**required**)

Inbound webhook runs have **no contact** until you add one. Without this step, **Send Email** is skipped with:

> *This action requires a Contact and none has been provided*

Between the webhook trigger and **Send Email**, add **Create/Update Contact**:

| Field | Map from webhook |
|-------|------------------|
| **Email** | `{{inboundWebhookRequest.email}}` |
| **First name** (optional) | `Customer` or leave blank |

Use **Update existing** / **Upsert** if offered so repeat buyers reuse the same contact.

On the **Inbound Webhook** trigger, open **Mapping** / **Save sample data** and include `"email": "test@example.com"` so merge fields resolve in the builder.

### 3. Send customer email

Add **Send Email** **after** Create/Update Contact:

| Field | Map from webhook |
|-------|------------------|
| **To** | Contact email (default — uses the contact from step 2) |
| **Subject** | `{{inboundWebhookRequest.subject}}` |
| **Body (HTML)** | `{{inboundWebhookRequest.html}}` or `{{inboundWebhookRequest.htmlBody}}` |
| **Plain text fallback** | `{{inboundWebhookRequest.text}}` |

Do **not** rely on a raw `To` address alone — GHL workflow email still needs the contact from step 2.

Use the merge field picker under **Inbound Webhook** / custom values if names differ in your sub-account.

**Workflow order:**

```
Inbound Webhook → Create/Update Contact → Send Email → End
```

### 4. Optional: branch admin vs customer

If you want different templates for internal alerts:

- **If/Else:** `subject` **contains** `New purchase received`
  - **Yes** → send to `info@circleprospecting.ai` with `{{inboundWebhookRequest.body}}`
  - **No** → send customer HTML receipt as above

Or run two **Send Email** steps when subject patterns differ (admin is always plain text).

### 5. Test

1. **Workflow → Test webhook** with sample JSON (use a real test inbox for `email`)
2. Or complete a small Stripe test checkout
3. Check Cloud Run logs for `[purchase-email] Customer receipt sent` and `Admin notify sent`

---

## Troubleshooting

### Still seeing only “Order confirmed” + one line (e.g. `Order CP-TEST12345 — $300.00`)

That layout is **GHL’s email body**, not the API. Our webhook sends full HTML with logo + table; GHL is ignoring it because the **Send Email** step still has your old custom text.

**Fix (do this in the workflow builder):**

1. Open **Send Email** → select the body / message area.
2. **Delete all existing content** (`Order confirmed`, `Order … — $…`, etc.).
3. If an **Email template** is selected in a dropdown, switch to **Custom** / blank (no saved template).
4. Open **HTML / source** mode (`</>` icon in the editor).
5. Paste the full file [`docs/email-templates/order-confirmation-ghl-paste.html`](./email-templates/order-confirmation-ghl-paste.html) **or** set body to only `{{inboundWebhookRequest.html}}`.
6. **Subject:** `{{inboundWebhookRequest.subject}}`
7. **Save** and **Publish** the workflow.

After fix, a test email should show the **logo** and a **table** (First name, Last name, Listing address, MLS, Purchased amount) — not a single line.

### Table labels show but values are empty

1. On the **Inbound Webhook** trigger, **Save sample data** with snake_case keys (see `ghl-webhook-test-payload.json`).
2. In the email body, use `{{inboundWebhookRequest.first_name}}` not `firstName` (insert via GHL **Custom values** picker).
3. Or set body to only `{{inboundWebhookRequest.html}}` so the API sends pre-filled HTML.

### Logo looks black on the green header

The `.webp` logo has a dark background. Use the updated paste template — logo sits in a **white rounded box** on the header.

| Symptom | Check |
|---------|--------|
| **Send Email → Skipped** — *requires a Contact* | Add **Create/Update Contact** before **Send Email**; map `{{inboundWebhookRequest.email}}` |
| API log says “sent” but no inbox | GHL workflow missing **Send Email** or wrong merge fields |
| `info@` never gets mail | `PURCHASE_NOTIFICATION_EMAIL` on Cloud Run; admin only sends once per session |
| Customer got nothing | Stripe session must include customer email; GHL `to` mapping |
| `[MAILER:SKIPPED]` in logs | No `GHL_MAIL_WEBHOOK_URL` / Resend / SMTP on server |

### Re-send for a past order (one time)

If the first order missed admin mail before `PURCHASE_NOTIFICATION_EMAIL` was set, use Stripe Dashboard → Payment → Checkout session id, then call (with auth if required):

`POST /api/checkout/sync-paid-session` with `{ "session_id": "cs_live_..." }`

Idempotency: customer receipt and admin mail send only once per session unless flags are cleared in `purchase-confirmations` store.

---

## Related code

- `server/checkoutSessionSideEffects.ts` — receipt + admin send
- `server/mailer.ts` — `buildCustomerPurchaseEmail`, `buildAdminPurchaseEmail`, GHL webhook POST
