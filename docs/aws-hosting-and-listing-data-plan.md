# Circle Prospecting AI — AWS hosting & listing data plan

**Prepared for:** Circle Prospecting  
**Purpose:** Host the website on AWS and load listing data from your AWS database instead of HighLevel.  
**Website and checkout stay the same.** We change where the app runs and where listing data comes from.

Hours are for one developer who already knows this product. Calendar time assumes timely access (AWS account, sample listing rows, DNS).

**20 hours is Phase 0 only** (setup and proof), not the full move. Full hosting + listings off HighLevel is still **120–200 hours** (about **6–8 weeks**).

---

## 1. Goal

1. **Host the webapp on AWS** — same site (`circleprospecting.ai`), same pay links, same $99 pages, same Stripe checkout.
2. **Read listings from your AWS database** — MLS, address, photo, radius counts, and agent — so you do not need HighLevel (or HighLevel’s paid inbound webhook fields) to create and open order links.

These are two related pieces of work. They can overlap. Hosting on AWS alone does **not** replace HighLevel until we can read your listing database.

---

## 2. What will not change

- How agents use the site (search, listing page, $99 offer, checkout)
- Pay link and $99 URL pattern (`/listed/mls/…`, `/99promo/listed/mls/…`)
- Stripe payment
- Emails you already send from your own tools (if you keep sending them)

**What will change (behind the scenes only):**

- Servers move from the current host to AWS
- Listing lookup talks to **your** AWS data instead of HighLevel

---

## 3. What we will do, and how

### Part A — Host the webapp on AWS

| Step | What we do |
| --- | --- |
| A1 | Put the public website on **S3 + CloudFront** (pages, images, $99 and checkout screens). |
| A2 | Run the API on **AWS App Runner** or **ECS** (same checkout, pay-link, and search APIs). |
| A3 | Put the site on a **temporary / staging URL** first (for example `staging.circleprospecting.ai` or the CloudFront URL). Today’s live site stays as it is. |
| A4 | Move secrets (Stripe, maps, mail) into AWS Secrets Manager or Parameter Store. |
| A5 | Test on the staging URL: homepage, $99, regular order links, checkout, success page. |
| A6 | **DNS cutover (later):** point `circleprospecting.ai` at CloudFront (HTTPS). `/api` and `/go` still reach our API. See Part C. |

**Existing stored records** (purchases, client logins, saved $99 listings) can stay on the current database at first so the move is safer. Moving that data onto AWS is extra (see hours below).

### Part B — Load listings from your AWS database (leave HighLevel)

| Step | What we do |
| --- | --- |
| B1 | Confirm how we read your data: **API (preferred)** or a **read-only database user**. |
| B2 | Map your fields to the listing page: MLS, address, city/state/ZIP, photo URL, radius counts (subdivision, ¼ mile, ½ mile, 1 mile, ZIP), agent name / email / phone / brokerage, Just Listed vs Just Sold, listing vs buyer agent. |
| B3 | When a pay / $99 link is opened, load that listing from **your** database and show checkout. |
| B4 | $99 search (phone, email, MLS) looks up **your** records, then Just Listed / Just Sold, then checkout. |
| B5 | Create pay / $99 links from your data (spreadsheet or automated feed). Links open from your data — no HighLevel inbound merge fields. |
| B6 | Save a small listing card when a link is created or a listing is picked, so a busy send does not depend on HighLevel. |
| B7 | Agree how emails go out after HighLevel: you send the links, or we send from our server. |

**Photos:** If photos are already on AWS S3, we keep using those URLs. We do not copy all contacts into a second giant database — only the listing fields needed for the page.

### Part C — Move DNS (after staging works)

We do **not** change `circleprospecting.ai` on day one. Staging first, DNS later. Existing pay / $99 links that already use `circleprospecting.ai` keep the same URLs; only the servers behind them change.

| Step | What we do |
| --- | --- |
| C1 | Add HTTPS certificate on CloudFront for `circleprospecting.ai` (and `www` if you use it). |
| C2 | You (or your DNS host) change DNS so the domain points at AWS. |
| C3 | Update Stripe webhook URL, Google Maps allowed domains, and our public site URL from staging to production. |
| C4 | Confirm `/api` and `/go` on the live domain. Spot-check a pay link, a $99 link, and checkout. |
| C5 | Leave the old host up briefly as fallback, then retire it when live is stable. |

**Do not send agents staging URLs.** Links created on staging use the staging host. Live links stay on `circleprospecting.ai`.

---

## 4. Suggested order

1. **Week 1–2:** AWS account access + sample listing rows. Start hosting (Part A) and field mapping (Part B).
2. **Week 2–4:** Website live on AWS (or a staging URL). Listing read from your DB on staging.
3. **Week 4–6:** $99 search + pay links on your data. Side-by-side check vs today’s links.
4. **Week 6–8:** Move DNS (`circleprospecting.ai` → AWS) and listing source. HighLevel can be turned off when you are ready.

If access is delayed, the calendar stretches; the hour counts stay in the ranges below.

---

## 5. Hours and timeline

| Work | Hours | Calendar (typical) |
| --- | ---: | --- |
| **Phase 0 — 20 hours** (we can start here) | **20** | 2–4 days |
| **A. Host webapp on AWS** (staging URL; keep current stored records at first) | **40–70** | 2–3 weeks |
| **A+. Move stored records onto AWS as well** | **+40–80** | +2–3 weeks |
| **B. Listings from your AWS DB / leave HighLevel** (clear API or tables) | **60–100** | 3–4 weeks |
| **B+. Extra if we must reverse-engineer the database** | **+40–50** | +1–2 weeks |
| **C. Move DNS** to `circleprospecting.ai` (certificate, DNS, Stripe, maps, live check) | **4–8** | 1 day (+ a few hours for DNS to spread) |
| **Typical live project: A + B + C** (after Phase 0; A and B overlap) | **125–210** | **6–8 weeks** |
| **If access is slow or data is messy: A + B+ + C** | **205–260** | **8–10 weeks** |

**How the hours add**

| | Low | High |
| --- | ---: | ---: |
| A. Staging host | 40 | 70 |
| B. Your listing DB / leave HighLevel | 60 | 100 |
| C. Move DNS (live domain) | 4 | 8 |
| **A + B + C if done one after another** | **104** | **178** |
| **Typical (A and B overlap) + C** | **125** | **210** |
| Optional A+ (move all stored records) | +40 | +80 |
| Optional B+ (unclear database) | +40 | +50 |

Phase 0 (**20 hrs**) is extra if you want a kickoff first. It is not inside A, B, or C.

**What 20 hours includes (Phase 0)**  
AWS access set up, one staging URL, one sample listing mapped to our fields, and a written go / no-go for Parts A, B, and C.

**What 20 hours does not include**  
Live `circleprospecting.ai` on AWS, **DNS cutover**, Stripe cutover, $99 search on your database, or turning HighLevel off.

**Not included in these hours:** building a new CRM to replace HighLevel contacts/pipelines, redesigning the website, or new products.

---

## 6. What we need from you

### For hosting (Part A)

- AWS account we can deploy into, **or** an IAM user/role with permission to use S3, CloudFront, App Runner or ECS, IAM, and Secrets Manager
- AWS **region** you want (for example `us-east-1` or `us-east-2`)
- Someone who can change **DNS** for `circleprospecting.ai` when we are ready to leave staging (Part C)
- Confirm Stripe stays on the current Stripe account (we only change the webhook URL)

### For listing data (Part B)

- How we should connect: **HTTPS API** (best) or **read-only** database access
- Where the rows live (service / database / table or endpoint names)
- A **sample listing** that includes:
  - MLS  
  - Property address (street, city, state, ZIP)  
  - Photo URL  
  - Radius counts: subdivision, ¼ mile, ½ mile, 1 mile, ZIP  
  - Agent name, email, phone, brokerage  
  - Just Listed or Just Sold  
  - Listing agent or buyer agent  
- Who will send order / $99 emails after HighLevel (you or us)

We cannot start Part B until we can read at least one real listing from your side.

---

## 7. What you get

- Website served from AWS (staging first, then `circleprospecting.ai` via DNS)  
- Same agent experience and same link style  
- Listing pages filled from **your** database  
- Pay / $99 links that do not depend on HighLevel inbound webhook fields  
- A path to turn HighLevel off when you are ready  

---

## 8. Next step

1. Confirm you want **both** Part A (hosting) and Part B (your listing data).  
2. Send AWS deploy access and one sample listing row (or API docs).  
3. We lock a start date and a week-by-week schedule against the hour ranges above.

Questions: reply on this thread or email **info@circleprospecting.ai**.
