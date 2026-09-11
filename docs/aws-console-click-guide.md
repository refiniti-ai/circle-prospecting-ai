# AWS console — you click, we guide

You have the AWS login. You do every click. We only tell you **where** to click.  
**Never send the password, root login, or access keys in chat.**

After each step, tell us what you see (or send a screenshot). We give the next click.

---

## Rules (read first)

- Do **not** delete anything you did not create.
- Do **not** change **Route 53** / DNS for `circleprospecting.ai` until we say so.
- Top right: the **region** must be correct or lists look empty.
- If a page asks to create a credit card or organization, **stop** and ask us.

---

## How we work

1. You do the step below.
2. You reply: “Done — I see ___.”
3. We send the next step only.

---

## Session 1 — Region and what already exists

### 1. Set the region

1. Top **right**, click the region name (you had **Stockholm**).
2. Choose **US East (Ohio) us-east-2**.
3. If lists are empty, try **US East (N. Virginia) us-east-1**.

Tell us: which region you set.

### 2. Find listing photos (S3)

1. Top search box: type **S3** → click **S3**.
2. Open **Buckets**.
3. Look for names like `jmr-img` or other photo buckets.

Tell us: bucket names you see (or “none”).

### 3. Find the listing database (RDS)

1. Top search: **RDS** → **RDS**.
2. Left: **Databases**.

Tell us: database names, or “No databases”.

### 4. Find DynamoDB (if RDS is empty)

1. Top search: **DynamoDB** → **DynamoDB**.
2. Left: **Tables**.

Tell us: table names, or “No tables”.

### 5. See if DNS is in this account

1. Top search: **Route 53** → **Route 53**.
2. Left: **Hosted zones**.

Tell us: whether you see `circleprospecting.ai` or “No hosted zones”.  
Do **not** edit any record.

---

## What Session 1 found (done)

| Item | Result |
| --- | --- |
| Working region | **US East (Ohio) us-east-2** |
| Photo bucket | `jmr-img` — matches the photo links already used by the site |
| Database | `new-production` — MySQL, `db.t3.small`, port 3306, **Publicly accessible: No** |
| Database network | VPC `vpc-852a3dec`, security group `rds-ec2-1`, 3 subnets |
| DynamoDB | Only `*-WebRevalidationTable-*` — belongs to other sites, not listings |
| Route 53 | Cannot read — permission not granted yet (does not block staging) |

Because the database is **not** publicly accessible, the API must run **inside the same VPC**.
That is the secure setup and we are keeping it.

---

## Session 2 — Staging website (only after Session 1)

We do this **after** you finish Session 1. Live `circleprospecting.ai` stays as it is.

### 6. Create an S3 bucket for the **website files** (new bucket — not the photo bucket)

1. **S3** → **Create bucket**.
2. **Bucket name:** `circle-prospecting-web-staging` (must be globally unique; add your initials if it is taken, e.g. `-cpai`).
3. **AWS Region:** same as Session 1 (Ohio if that is where you are).
4. Leave **Block all public access** ON for now (CloudFront will read it later).
5. **Create bucket**.
6. Do **not** upload files yet. We will tell you when.

Tell us: exact bucket name.

### 7. Upload the website files

We build the files for you. They are in the project folder at `dist-aws-staging/`.

1. **S3** → open **circle-prospecting-web-staging**.
2. Click **Upload**.
3. Open `dist-aws-staging` on your computer, select **everything inside it** (`index.html`, the `assets` folder, and all the rest) and drag it in.
   - Upload the **contents**, not the `dist-aws-staging` folder itself. There must be no folder name in front of `index.html` in the list.
4. Click **Upload** and wait for **Upload succeeded**.

Tell us: the file count S3 reports.

### 8. Create the CloudFront distribution (temporary HTTPS URL)

1. Top search: **CloudFront** → **Create distribution**.
2. **Origin domain:** click the box and pick `circle-prospecting-web-staging.s3.us-east-2.amazonaws.com` from the list.
3. **Origin access:** choose **Origin access control settings (recommended)** → **Create new OAC** → **Create**.
4. **Viewer protocol policy:** **Redirect HTTP to HTTPS**.
5. **Web Application Firewall:** **Do not enable security protections** (avoids extra cost).
6. **Default root object:** type `index.html`.
7. Click **Create distribution**.
8. A blue banner appears saying the S3 bucket policy needs updating → click **Copy policy**, then **Go to S3 bucket permissions**.
9. In the bucket: **Permissions** tab → **Bucket policy** → **Edit** → paste → **Save changes**.

Tell us: the **Distribution domain name** (looks like `d1234abcd.cloudfront.net`).

### 9. Make page links work (required)

The site is a single-page app, so CloudFront must send every address to `index.html`.

1. Open the distribution → **Error pages** tab → **Create custom error response**.
2. **HTTP error code:** `403` · **Customize error response:** Yes · **Response page path:** `/index.html` · **HTTP Response code:** `200` → **Create**.
3. Repeat for **404** with the same `/index.html` and `200`.

Without this, a link like `/99promo/listed/mls/A4692040` shows an error instead of the listing.

### Staging site is live

**https://d209dfj15nbkw2.cloudfront.net**

- Website files: S3 `circle-prospecting-web-staging` (Ohio)
- HTTPS + CDN: CloudFront `d209dfj15nbkw2.cloudfront.net`
- API: still the existing server (not yet moved to AWS)

Known and expected on staging: after a Stripe payment, the browser returns to
`circleprospecting.ai` instead of the staging address. Everything before that
step works normally. This corrects itself once the site moves to the real
domain.

### 10. We connect the API

Once you send the CloudFront address, we add it to the API's allowed-origins list so checkout and listing search work from the staging URL. Then you test.

At this stage the site runs on AWS but still calls the current API. Moving the API into AWS is the next project, and it needs the client's permissions first.

---

## Session 3 — Temporary URL, then DNS later

| When | What you do |
| --- | --- |
| After staging works | You test the temporary URL only |
| You say “OK to go live” | We send **exact** DNS records |
| You (or your DNS person) | Change `circleprospecting.ai` only then |

Until Session 3, **do not** edit Route 53 for the live domain.

---

## If something looks wrong

- “Access denied” → tell us the page name.  
- Empty list → confirm region (Ohio vs N. Virginia vs Stockholm).  
- Asked to pay / create org → **stop**.

---

## Start now

Do **Session 1, steps 1–5** only. Reply with:

- Region:  
- S3 buckets:  
- RDS databases:  
- DynamoDB tables:  
- Route 53 hosted zones:  

We will give Session 2 clicks after that.
