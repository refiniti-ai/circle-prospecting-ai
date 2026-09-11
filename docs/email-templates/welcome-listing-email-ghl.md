# Welcome email — new listing (GHL)

Client template (Greg) with **working links** and **Opportunity** fields for multi-listing agents.

---

## Workflow order (each of the 3 welcome workflows)

```
Opportunity created/updated
  → HTTP: POST /api/generate-pay-link
  → Send Email (template below)
```

**Generate pay link** body:

```json
{
  "contactId": "{{contact.id}}",
  "opportunityId": "{{opportunity.id}}",
  "mls": "{{opportunity.mls}}",
  "agentRole": "{{contact.agent_type}}"
}
```

Run **before** Send Email so `final_link_url` exists on the opportunity.

---

## Field mapping

| Template line | Use this merge field | Notes |
|---------------|----------------------|--------|
| First name | `{{contact.first_name}}` | Agent name — contact is fine |
| Listing address | `{{opportunity.listing_address}}` or `{{contact.listing_address}}` | Prefer **opportunity** per listing |
| Subdivision / mile counts | `{{opportunity.subdivision_home_owners}}`, etc. | Prefer **opportunity** if counts are per listing |
| Activate / CLICK HERE | `{{opportunity.final_link_url}}` | **Tracked** pay link (click logging) |
| Book a call | `https://cal.com/circleprospectingai-greg/15min` or `{{opportunity.book_call_url}}` | After generate-pay-link |
| Website | `https://circleprospecting.ai` or `{{opportunity.website_url}}` | After generate-pay-link |

GHL sometimes exposes mile fields as `14_mile_home_owners` / `12_mile_home_owners` — both work if defined in your sub-account.

---

## Plain-text version (paste in GHL)

```
Hi {{contact.first_name}}

Congratulations on your new listing!

{{opportunity.listing_address}}

Every new listing creates neighborhood attention.

Around your listing there are:

🏠 Subdivision  {{opportunity.subdivision_home_owners}} homeowners
🏘️ 1/4 Mile → {{opportunity.one_fourth_mile_home_owners}} homeowners
🎯 1/2 Mile → {{opportunity.half_mile_home_owners}} homeowners
📍 1 Mile → {{opportunity.one_mile_home_owners}} homeowners
💰 Zip Code → {{opportunity.zipcode_home_owners}} homeowners

Will those homeowners hear from you?

Start promoting your property or learn more:
{{opportunity.final_link_url}}

Most agents never contact these homeowners.

Yet many are wondering:
• What is my home worth?
• How quickly will this home sell?
• Should I move?
• Who would I call if I decided to list?

Our goal is simple:
Help agents turn active listings into:
✓ homeowner conversations
✓ seller opportunities
✓ buyer opportunities
✓ future listings

Current early access pricing:
Starting at just $.50 per homeowner with LIVE CALLERS.

We use:
✓ Live Callers
✓ Just Listed campaigns
✓ Just Sold campaigns
✓ Buyer Transaction Prospecting

Top agents use every transaction to create MORE conversations.

🚀 Activate your listing or learn more:
{{opportunity.final_link_url}}

📅 Schedule a quick call:
https://cal.com/circleprospectingai-greg/15min

Website: https://circleprospecting.ai
```

---

## HTML version (recommended — clickable links)

In GHL email editor, switch to HTML (`</>`) and use:

```html
<p>Hi {{contact.first_name}},</p>

<p><strong>Congratulations on your new listing!</strong></p>

<p>{{opportunity.listing_address}}</p>

<p>Every new listing creates neighborhood attention.</p>

<p>Around your listing there are:</p>
<ul>
  <li>🏠 Subdivision — <strong>{{opportunity.subdivision_home_owners}}</strong> homeowners</li>
  <li>🏘️ 1/4 Mile — <strong>{{opportunity.one_fourth_mile_home_owners}}</strong> homeowners</li>
  <li>🎯 1/2 Mile — <strong>{{opportunity.half_mile_home_owners}}</strong> homeowners</li>
  <li>📍 1 Mile — <strong>{{opportunity.one_mile_home_owners}}</strong> homeowners</li>
  <li>💰 Zip Code — <strong>{{opportunity.zipcode_home_owners}}</strong> homeowners</li>
</ul>

<p>Will those homeowners hear from you?</p>

<p>
  <a href="{{opportunity.final_link_url}}" style="display:inline-block;padding:12px 24px;background:#0284c7;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">
    Start promoting your property — CLICK HERE
  </a>
</p>

<p>Most agents never contact these homeowners. Yet many are wondering:</p>
<ul>
  <li>What is my home worth?</li>
  <li>How quickly will this home sell?</li>
  <li>Should I move?</li>
  <li>Who would I call if I decided to list?</li>
</ul>

<p>Our goal is simple: help agents turn active listings into homeowner conversations, seller opportunities, buyer opportunities, and future listings.</p>

<p>Current early access pricing: starting at just <strong>$0.50 per homeowner</strong> with LIVE CALLERS.</p>

<p>
  <a href="{{opportunity.final_link_url}}" style="display:inline-block;padding:12px 24px;background:#059669;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">
    🚀 Activate your listing — CLICK HERE
  </a>
</p>

<p>
  📅 <a href="https://cal.com/circleprospectingai-greg/15min">Schedule a quick call</a>
</p>

<p>
  <a href="https://circleprospecting.ai">Circle Prospecting AI</a>
</p>
```

---

## What was wrong in the original template

1. **"CLICK HERE"** was plain text — no `href`, so nothing to click.
2. **Pay link** not tied to `final_link_url` / `pay_link_url`.
3. **"book one here"** and **website** had no URLs.
4. For **multiple listings**, pay link must use **opportunity** fields, not contact (or only contact as temporary bridge).

---

## If opportunity fields are empty

Confirm custom fields exist on **Opportunity** model in GHL (Settings → Custom Fields → Opportunity), or keep listing counts on contact until migrated.

Fallback (single listing only): use `{{contact.final_link_url}}` after generate-pay-link (API mirrors to contact).
