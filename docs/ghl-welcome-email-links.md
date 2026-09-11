# GHL welcome emails — broken links fix

Greg reported welcome emails across **3 workflows** stopped working after workflow updates. Pay links, Cal.com, and website URLs in those emails were broken.

## Root cause

1. **Pay links saved on Opportunity, emails read Contact**  
   `POST /api/generate-pay-link` writes `pay_link_url` and `final_link_url` to the **Opportunity** when one exists. Most welcome email templates still use **Contact** merge fields (`{{contact.final_link_url}}`, `{{custom_values.pay_link_url}}`), which stay empty.

2. **Static URLs not refreshed**  
   Cal.com (`book_call_url`) and site URL (`website_url`) must exist on Contact/Opportunity custom fields if templates use merge fields instead of hardcoded `href`.

3. **GHL template edits**  
   If the team changed merge field names or stripped `https://` from links, buttons break even when data exists.

4. **GHL click tracking → 404 on `circleprospecting.ai/email-tracking/...`** (Greg Jun 2026)  
   If email links look correct in the editor but clicks open `https://circleprospecting.ai/email-tracking/XXXXXXXX?contactId=...` and show **404**, the problem is **not** the href. GHL **rewrites** links for click tracking when a **Branded Domain** points at the marketing site (Firebase). Our app has no `/email-tracking` handler — only `/go` and `/api/*` are proxied to Cloud Run.

---

## Code fix (deployed)

When links are written to an **Opportunity**, the API now **mirrors** to the **Contact** (default on):

| Field | Example value |
|-------|----------------|
| `pay_link_url` | `https://circleprospecting.ai/listed/mls/TB8419229` (Just Listed) |
| | `https://circleprospecting.ai/seller/mls/TB8419229` (Just Sold / listing agent) |
| | `https://circleprospecting.ai/buyer/mls/TB8419229` (Buyer's agent) |
| `final_link_url` | `https://circleprospecting.ai/go?c=CONTACT_ID&mls=TB8419229&agent=seller` |
| `website_url` | `https://circleprospecting.ai` |
| `book_call_url` | `https://cal.com/circleprospectingai-greg/15min` |

Disable mirror: `GHL_MIRROR_PAY_LINK_TO_CONTACT=false` on Cloud Run.

---

## Fix Greg’s contact now (3 opportunities)

**Option A — one API call** (refreshes every opportunity on the contact):

```http
POST https://circle-prospecting-ai-git-724527267367.us-central1.run.app/api/refresh-welcome-links
Content-Type: application/json
X-Webhook-Token: <GENERATE_CHECKOUT_TOKEN if set>

{ "contactId": "GREG_GHL_CONTACT_ID" }
```

**Option B — re-run each welcome workflow** in GHL (must call `generate-pay-link` **before** Send Email).

**Option C — manual test** per MLS:

```http
POST /api/generate-pay-link
{ "contactId": "{{contact.id}}", "mls": "{{opportunity.mls}}", "agentRole": "{{contact.agent_type}}" }
```

---

---

## “Leads from Webhook” — pay link not on new opportunity

If webhook response shows:

```json
"opportunityId": null,
"writeTarget": "contact",
"reason": "no_mls_match_on_opportunities"
```

### Why

1. **`opportunityId` not received** — response still shows `null` even after adding `opportunity_id`. On contact workflows, use **Custom Values → ID from “Create Or Update Opportunity”** step, not a blank `{{opportunity.id}}`.
2. **Wrong step order** — if **Generate Pay Link** runs *before* **Agent Type / Listing**, the new opportunity has no MLS yet. API sees old opps only (`TESTMLS1234|TESTMLS1236`) and misses `TESTMLS1235`.
3. **Multiple empty opportunities** — agents with many past listings may have several opportunities with no MLS. API now picks the **newest** empty-MLS opportunity and backfills `mls` on it when pay-link runs (deploy API revision after this doc).
4. **Contact overwrite** — `writeTarget: "contact"` updates **contact only** (latest MLS). Old **opportunity** URLs are unchanged; the **new** opportunity stays empty.

### Fix

1. Move **Agent Type** + **Listing** steps **above** Generate Pay Link.
2. Webhook body — use **opportunity** MLS (not contact MLS) when MLS can change on retry:

```json
{
  "contactId": "{{contact.id}}",
  "opportunityId": "{{opportunity.id}}",
  "mls": "{{opportunity.mls}}"
}
```

3. Confirm response has `"opportunityId": "EVodMGqc..."` and `"writeTarget": "opportunity"`.
4. Email link: keep `{{contact.pay_link_url}}` (mirrored from API).

### MLS changed on retry (TEST9710 → TEST971056)

If the workflow re-runs after editing MLS on the opportunity, the API now:
- Finds the opportunity when **exactly one** opp has the old MLS (`matched_single_stale_mls_opportunity`)
- Or when the contact has **only one** opportunity (`matched_single_contact_opportunity`)
- **Syncs** the new MLS onto the opportunity and rewrites `pay_link_url` / `final_link_url`

Still best: pass `opportunityId` in every webhook call so lookup never guesses.

| Field | Each new lead |
|-------|----------------|
| Contact `pay_link_url` | Overwrites to **latest** MLS (for email) |
| Each opportunity `pay_link_url` | **Keeps its own** URL once `writeTarget: "opportunity"` |

### Multi-listing — 1st opportunity link “stops working” (Greg)

**Symptom:** After a 2nd opportunity, `https://circleprospecting.ai/seller/mls/TB8419229` shows empty / “search MLS” instead of listing data.

**Cause:** GHL updates **contact.mls** to the **newest** listing. Checkout searched **contacts** by MLS — TB8419229 no longer on contact → no results.

**Fix (deployed):** API searches **opportunities** by MLS (custom field + opportunity title) and loads listing data from the matching opportunity. Checkout URLs stay clean: `/seller/mls/TB8419229` (no `?c=`).

**Do not use `?c=` on checkout links** — old links with a bad contact id break checkout. Use `{{opportunity.final_link_url}}` in emails (tracked `/go`); each opportunity keeps its own URL.

**Re-run generate-pay-link** per opportunity (with `opportunityId` in webhook) after deploy.

### Pay link empty on 2nd opportunity (Greg — Jun 13)

**Symptom:** New opportunity created (e.g. TB8467648) but `pay_link_url` / `final_link_url` stay blank on the opportunity.

**Causes we found:**

1. **Allow Duplicate Contact ON** — GHL created a **new** contact (`TWl6NjYq53ZJXZoWBcnC`) instead of reusing the first (`F0eDCs2Il4VYYivDXjGE`). Old contact was deleted → API could not write fields (`Contact not found`).
2. **Webhook missing `opportunityId`** — API could not find which opportunity to write to (`opportunityLookup: none`).
3. **API returned `ok: true` even when GHL write failed** — workflow thought pay-link succeeded (fixed — now returns HTTP 502 on write failure).

**Fix (deployed):** API recovers contact by MLS search when id is stale; picks **newest** matching opportunity; fails loudly if GHL write fails.

**Greg must in GHL:**

1. Turn **OFF** “Allow Duplicate Contact” (one Greg contact per email).
2. Webhook body **must** include:
   ```json
   {
     "contactId": "{{contact.id}}",
     "opportunityId": "{{opportunity.id}}",
     "mls": "{{inboundWebhookRequest.mls}}",
     "agentRole": "{{inboundWebhookRequest.[Agent Type]}}"
   }
   ```
3. Re-run **Generate Pay Link** on blank opportunities (or `POST /api/refresh-welcome-links` with current contact id).

**Greg’s current contact id:** `TWl6NjYq53ZJXZoWBcnC` (not the older `F0eDCs2Il4VYYivDXjGE`).

### `opportunityMlsBackfill` — skipped on re-run (not pay-link skip)

`POST /api/generate-pay-link` does **two** writes:

| Step | What it does | Response field |
|------|----------------|----------------|
| 1 | Writes `pay_link_url`, `final_link_url`, `website_url`, `book_call_url` | `ghl` — **`ok: true` means pay links were written** |
| 2 | Backfills opportunity `mls` custom field if empty | `opportunityMlsBackfill` |

**`opportunityMlsBackfill: { attempted: false, skipped: true, status: 204 }` does not skip pay-link generation.** It only means step 2 did not need to run again.

| `opportunityMlsBackfill.message` | Meaning |
|----------------------------------|---------|
| `mls_already_set` | Opportunity MLS field already matches webhook MLS (normal on re-submission) |
| `protect_existing_listing_mls` | Opportunity already has a **different** MLS — API will not overwrite |
| `protect_existing_listing_name` | Opportunity title contains a **different** MLS — API will not overwrite |

On re-submission after a successful first run you will typically see:

```json
"ghl": { "ok": true, "status": 200 },
"opportunityMlsBackfill": { "attempted": false, "skipped": true, "ok": true, "status": 204, "message": "mls_already_set" }
```

Pay links are still re-written in step 1 every time the webhook runs.

**If the wrong opportunity gets the link** (e.g. `opportunityId: "06IFO…"` with `reason: "matched_newest_empty_mls_opportunity"`), the problem is **opportunity lookup**, not backfill skip. Fix: send `"opportunityId": "{{opportunity.id}}"` in the webhook body.

### Verify both opportunities + pay links (API)

```http
GET https://circleprospecting.ai/api/ghl-contacts/CONTACT_ID/opportunities
```

Returns each opportunity with `mls`, `payLinkUrl`, `finalLinkUrl`, `listingAddress`, `mlsFromPayLink` (parsed from stored URLs when MLS field was overwritten).

Re-write all pay links:

```http
POST /api/refresh-welcome-links
{ "contactId": "CONTACT_ID" }
```

### Checkout page — URL MLS is source of truth (deployed `00146`)

`/seller/mls/TB8419229` flow:

1. Path MLS `TB8419229` → `resolveListingByMls("TB8419229")`
2. API `search-by-mls?mls=TB8419229` — contact search, then **opportunity** search (MLS field, title, **pay_link_url**)
3. `prefill?mls=TB8419229` loads **that** opportunity’s fields (not contact.latest)
4. Page forces `listing.mls = TB8419229` from URL even if contact `mls` is TB8467648

---

## GHL workflow checklist (all 3 welcome workflows)

1. **Order:** Create/Update Contact → **Generate pay link** (webhook to API) → **Send Email**
2. **Generate pay link** body must include `contactId` + `mls` (and `opportunityId` if available).
3. **Email links** — use Contact merge fields (now mirrored):
   - Checkout / tracked: `{{contact.final_link_url}}` or `{{custom_values.final_link_url}}`
   - Book call: `{{contact.book_call_url}}` or hardcode `https://cal.com/circleprospectingai-greg/15min`
   - Website: `{{contact.website_url}}` or `https://circleprospecting.ai`
4. **HTML links** must be full URLs: `href="https://..."` not `href="{{field}}"` without `https://`
5. **Publish** workflow after edits.

### Long-term (opportunity-scoped emails)

If each welcome email is tied to one listing, prefer:

- `{{opportunity.final_link_url}}`
- `{{opportunity.mls}}`

and pass `"opportunityId": "{{opportunity.id}}"` to `generate-pay-link`.

---

## Fix: Cal.com / website → 404 `email-tracking` (links look correct in editor)

**Symptom:** Clicking Cal.com or website in the email opens:

`https://circleprospecting.ai/email-tracking/2a357c17e92?contactId=...` → **404**

**Cause:** GHL **Track clicks** rewrites every link through your **Branded Domain** (`circleprospecting.ai`). That domain hosts the React marketing site (Firebase), not GHL’s tracking servers. `/email-tracking/*` does not exist on our site.

Order links may still work because `final_link_url` uses `/go`, which **is** configured on our hosting — but Cal.com and `https://circleprospecting.ai/` get wrapped and break.

### Fix A — fastest (per email / workflow)

In the **Send Email** step → **Additional settings**:

- Turn **OFF** “Track clicks” (and UTM if enabled)
- **Publish** the workflow
- Send a new test email

Links will go **directly** to Cal.com / website / checkout.

### Fix B — proper branded domain (keep click tracking)

1. GHL → **Settings → Email Services → Branded Domain**
2. Use a **subdomain** only for GHL links, e.g. `link.circleprospecting.ai` — **not** the root `circleprospecting.ai` marketing domain
3. Add the DNS records GHL provides (CNAME) in GoDaddy
4. Leave `circleprospecting.ai` pointing at Firebase for the website

### Cal.com link in template

Greg’s screenshot uses:

`https://www.circleprospecting.ai/widget/bookings/intro-call-with-greg`

That is a **GHL booking widget** on `www` — not Cal.com directly. Prefer:

`https://cal.com/circleprospectingai-greg/15min`

unless the widget is intentionally hosted and DNS for `www` is set up.

---

## Verify links work

| Link | Test |
|------|------|
| `final_link_url` | Open in browser → should redirect to `/seller/mls/…` or `/buyer/mls/…` |
| `book_call_url` | Opens Cal.com booking page |
| `website_url` | Opens circleprospecting.ai |

Check GHL contact record → Custom fields after refresh API call.

---

## Client welcome template (Greg)

Full corrected copy with Opportunity merge fields and clickable links:
[`docs/email-templates/welcome-listing-email-ghl.md`](./email-templates/welcome-listing-email-ghl.md)

**Critical fixes in that template:**
- Replace plain "CLICK HERE" with `<a href="{{opportunity.final_link_url}}">…</a>`
- Cal.com: `https://cal.com/circleprospectingai-greg/15min`
- Website: `https://circleprospecting.ai`
- Listing + homeowner counts: `{{opportunity.*}}` (not contact) for multi-listing agents

---

## Related code

- `server/ghlMlsLink.ts` — `writeGhlMlsCheckoutLink`, `welcomeEmailAuxiliaryFields`, `refreshWelcomeLinksForContact`
- `server/payLinkTrack.ts` — `/go` click tracking + redirect
- `docs/ghl-workflow-test-TB8419229.json` — sample Greg / TB8419229 payloads
