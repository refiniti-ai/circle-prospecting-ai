# Moving Circle Prospecting fully to AWS — data migration plan

**Prepared for:** Circle Prospecting
**AWS account:** `381767547693` · Region **US East (Ohio) `us-east-2`**
**Goal:** the entire application — website, server, and all business data —
runs in your AWS account, with **no interruption to the live site** at any
point.

---

## 1. Where things stand today

Your application is made of four parts. They move separately.

| Part | What it is | Where it runs today | Status |
| --- | --- | --- | --- |
| **Website** | Everything a visitor sees | **Your AWS account** (S3 + CloudFront, Ohio) | ✅ **Done** |
| **Server** | Handles search, checkout, email | Google Cloud | To move |
| **Listing data** | Properties, MLS numbers, photos | **Your AWS database** (`new-production`) | To connect |
| **Business data** | Orders, customers, campaigns | Google database (Firestore) | Stage 1 started — tables go in MySQL `circle` (not `roofs`) |

A working copy of the website is already live in your account:

**https://d209dfj15nbkw2.cloudfront.net**

Your live site at `circleprospecting.ai` is untouched and unchanged.

---

## 2. What the "business data" actually is

This is the part most easily misunderstood, so it is worth being specific.
It is **not** your property listings. It is the records the application
creates as customers use it:

| Data | What it holds |
| --- | --- |
| Orders | Every campaign ordered, with property and pricing details |
| Purchase records | Completed payments, receipts, what was delivered |
| Checkout activity | Started, completed and abandoned checkouts |
| Customer accounts | Login details for the customer dashboard |
| Delivered leads | Which leads were sold to which customer |
| Link clicks | Which prospects clicked their personalised link |
| Search activity | What people searched for on the site |
| Saved listings | Cached listing details used by the $99 campaign links |
| Password resets | Short-lived reset links |
| System settings | Internal configuration |

Ten separate sets of records in total. Losing or corrupting any of the first
five would mean lost revenue or customers locked out, which is why the
approach below is deliberately cautious.

---

## 3. What we found when we examined the system

We audited every part of the application that touches the Google database
before writing this plan. Three findings make this migration **less risky and
less expensive** than a typical one.

**There is no Google login system to migrate.** Customer passwords and
sessions are handled by the application's own code, not by Google. Identity
migration is normally the hardest and highest-risk part of a move like this,
and it simply does not apply here.

**No files are stored in Google.** Listing photos are already served from
Amazon S3. Nothing to copy.

**The data is stored simply.** There are no complex database features in use —
every piece of data is either looked up by its ID, filtered on a single field,
or sorted by date. All of these translate directly to AWS's database.

**The application already writes to two places at once.** Each set of records
is written to Google *and* to a local backup file. The code was built to keep
two copies in sync, which is precisely the pattern this migration needs. We
are extending something that already exists rather than inventing it.

---

## 4. The approach: clone first, switch last

We never "move" the data. At every stage there are two complete copies, and
the live site keeps reading from the existing one until you decide otherwise.

### Stage 1 — Build the AWS database
Create the ten sets of records in AWS, with the right indexes so that
searching stays fast. Nothing is connected to the live site yet.

### Stage 2 — Start writing to both
The server begins saving every new order, payment and login to **both**
databases. Google remains the one the site reads from. If an AWS write fails
for any reason it is ignored and the site carries on normally — this stage
**cannot** break production.

### Stage 3 — Copy the history
Bulk-copy all existing records from Google into AWS. This only *reads* from
Google, so the live site is unaffected while it runs.

### Stage 4 — Prove the copies match
Compare the two databases record by record and reconcile any differences.
We do not proceed until they agree.

### Stage 5 — Switch reading over
Change one setting so the site reads from AWS instead of Google. Both
databases keep receiving writes. **If anything looks wrong, this switch is
reversed in seconds** and the site is back on Google with no data lost.

### Stage 6 — Soak, then retire Google
Run on AWS for an agreed period — typically two weeks — with Google still
receiving a copy of everything as a safety net. Only when you are satisfied do
we stop writing to Google.

At no point does the data exist in only one place, and at no point is the
site offline.

---

## 5. Hours

### Data migration

| Stage | Work | Hours |
| --- | --- | --- |
| 1 | AWS database setup, indexes, access control, secure credential storage | 16–22 |
| 2 | Rewrite all ten sets of records to work with AWS | 45–60 |
| 3 | Copy and verification tooling | 16–24 |
| 4 | Dual-write rollout and monitoring | 10–14 |
| 5 | Read switchover, soak period, rollback readiness | 8–12 |
| 6 | End-to-end testing — orders, payments, logins, email | 20–30 |
| | Subtotal | 115–162 |
| | Contingency (~10%) | 12–16 |
| | **Data migration total** | **127–178** |

### The rest of the move

| Item | Hours |
| --- | --- |
| Website to AWS | **Delivered** |
| Server to AWS (container, hosting, private database connection, secrets) | 40–60 |
| Reading listings from your `new-production` database | 60–100 |
| DNS switchover to the live domain | 4–8 |

### Totals

| Scope | Hours |
| --- | --- |
| Hosting only — site and server on AWS, data stays in Google | **44–68** |
| Above, plus reading listings from your database | **104–168** |
| **Everything on AWS, Google fully retired** | **231–346** |

At a steady pace this is roughly **6–8 weeks** for the hosting-plus-listings
scope, and **14–20 weeks** for the complete move.

---

## 6. What we need from you

| # | What | Why | Status |
| --- | --- | --- | --- |
| 1 | AWS permissions (see separate document) | To build anything in your account | ✅ Granted |
| 2 | **Read-only database user** on `new-production` | To read your listings | ✅ User `circle` (listings in `roofs`) |
| 3 | **Database/schema name and listing table name**, plus one sample MLS number | To map your data to the site | ✅ `roofs.mls_properties` (TB8546545) |
| 4 | Decision on scope (see section 5 totals) | Determines cost and timeline | ⏳ **Waiting** |
| 5 | Agreement on the switchover date | The one step with customer impact | Later |

Please send any password through a password manager rather than email.

---

## 7. Risks, and what we do about them

| Risk | How we handle it |
| --- | --- |
| Records lost during the copy | Two live copies at all times; nothing deleted from Google until you approve |
| An order placed mid-migration is missed | Both databases receive every write from Stage 2 onward |
| The new database behaves differently under load | Two-week soak period with Google still in sync as a fallback |
| Something is wrong after switching | One setting reverts it in seconds |
| Site unreachable during DNS change | The old and new sites both run during the switch; DNS moves traffic gradually |
| Payment records mismatched | Payment data is reconciled against Stripe, which is the independent source of truth |

---

## 8. Recommended order

1. **Now** — server moves to AWS, still using the existing database *(44–68 hrs)*
2. **Next** — read listings from your `new-production` database *(60–100 hrs)*
3. **Then** — switch the live domain over *(4–8 hrs)*
4. **Finally** — migrate business data and retire Google *(127–178 hrs)*

Splitting it this way means you get a fully working site on AWS early, and the
largest and most sensitive piece of work happens last, on a system already
proven in production.

---

## 9. One ongoing cost to be aware of

Your database is correctly configured as private — it is not reachable from
the internet. The server therefore has to connect to it through a private
network route, which requires an AWS component costing roughly **$35 per
month** on top of normal hosting. There is a cheaper arrangement that avoids
it but takes additional setup time; we are happy to price either.
