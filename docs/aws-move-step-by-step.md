# Move Circle Prospecting AI to AWS — step by step

**Order:** Host the website on AWS **first** (temporary domain). After it is tested, change **DNS** so `circleprospecting.ai` points at AWS. Live pay / $99 links stay the same. HighLevel listing data can stay until a later phase.

---

## What we are going to do

1. Put the website and API on **your AWS account**.
2. Open it on a **temporary URL** (staging). **Today’s live site does not change.**
3. You test: homepage, listing links, $99, checkout, payment.
4. When you say it looks right, we **move DNS** to `circleprospecting.ai`.
5. Existing links (`https://circleprospecting.ai/listed/mls/…` and `/99promo/…`) keep working — only the servers behind them change.

Leaving HighLevel (read listings from your AWS database) is a **second project** after this host move.

---

## What we need from you

**Do not send the main AWS password in email or chat.** Create a limited user, or stay on a call while we work.

| # | Item | Why |
| --- | --- | --- |
| 1 | AWS **account** we can deploy into (IAM user/role — not root) | So we can create S3, CloudFront, and the API |
| 2 | **Region** (Ohio `us-east-2` if that is where listings/photos already are) | Services only show in that region |
| 3 | Confirm **Stripe** stays on the current Stripe account | We only change the webhook URL at cutover |
| 4 | Who can change **DNS** for `circleprospecting.ai` (and `www` if you use it) | Needed only at the last step — not on day one |
| 5 | Optional: a name for staging, e.g. `staging.circleprospecting.ai` | Easier to share than a long CloudFront URL |

That is enough to **host** the app. Database names and sample listings are for the **later** HighLevel → your DB work.

---

## Step-by-step

### Step 1 — Access (you)

- Create an IAM user (or role) with permission for S3, CloudFront, App Runner or ECS, ACM (certificates), IAM, Secrets Manager.
- Tell us the **account ID** and **region**.
- Do not share the root login.

### Step 2 — We build on AWS (us)

- Website files → **S3**
- Fast HTTPS delivery → **CloudFront**
- Checkout / API → **App Runner** or **ECS**
- Secrets (Stripe, maps, mail) → **Secrets Manager**

### Step 3 — Temporary domain (us + you)

- We give you a **staging URL** (`staging.circleprospecting.ai` or the CloudFront URL).
- **`circleprospecting.ai` stays on the current host.** Agents keep using the live site.
- If you want `staging.circleprospecting.ai`, you add one DNS record we send you (CNAME). That is **not** moving the live domain.

### Step 4 — Test on staging (you)

Open the staging URL and check:

- Homepage  
- A regular order / pay link  
- A $99 listing page  
- Checkout (use a test card if we put Stripe in test mode)  
- Success page  

**Do not send agents the staging URL.** Those links use the staging host.

### Step 5 — Sign off (you)

Reply: staging is OK to go live.

### Step 6 — Prepare live domain (us)

- HTTPS certificate for `circleprospecting.ai` (and `www` if needed)
- CloudFront ready for the live name
- Stripe webhook, Maps allowed domains, and public site URL set to production (not staging)

### Step 7 — Change DNS (you, we guide)

- You change DNS so `circleprospecting.ai` points at AWS (we send the exact records).
- Wait for it to spread (often minutes, can be a few hours).
- We confirm `/api` and `/go`, then one pay link, one $99 link, and checkout.

### Step 8 — After DNS (us)

- Old host stays up briefly as backup, then we turn it off.
- Live links on `circleprospecting.ai` now run on AWS.

---

## What does not move in this first project

- HighLevel (search and listing fill still use HighLevel until Part B)
- Your listing database (we only **host** the webapp first)
- Redesign of the website

---

## Hours (host first + DNS)

| Work | Hours |
| --- | ---: |
| Host on AWS + staging URL | **40–70** |
| Move DNS to `circleprospecting.ai` | **4–8** |
| **This first project (A + C)** | **44–78** |

Full site + leave HighLevel later is still **125–210** hours total (see the full plan).

---

## Next step

Send items 1–4 in the table (IAM access, region, Stripe confirm, who owns DNS). We start on the staging URL. We do **not** touch live DNS until you sign off Step 5.
