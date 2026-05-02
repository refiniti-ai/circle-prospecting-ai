# Firebase-Only Phase 1 Deploy

This project can run as a single-domain setup on Firebase Hosting with `/api/**` rewritten to Cloud Run.

## 1) Verify rewrite target

`firebase.json` currently points to:

- service: `circle-prospecting-api`
- region: `us-central1`

If your Cloud Run service name/region is different, edit:

- `hosting.rewrites[0].run.serviceId`
- `hosting.rewrites[0].run.region`

## 2) API runtime environment (Cloud Run)

Set these on Cloud Run:

- `API_PORT=8080`
- `APP_PUBLIC_URL=https://circle-prospecting-ai.web.app`
- `CORS_ORIGIN=https://circle-prospecting-ai.web.app`
- `STRIPE_SECRET_KEY=...`
- `STRIPE_WEBHOOK_SECRET=...`
- `ADMIN_API_KEY=...`
- `DASHBOARD_JWT_SECRET=...`
- `PURCHASE_NOTIFICATION_EMAIL=you@yourdomain.com`

Optional in Phase 1:

- `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON`

Leave for Phase 2:

- `GHL_*`
- `SMTP_*`

## 3) Frontend build env

For same-domain routing via Firebase rewrite:

- `VITE_API_BASE_URL=` (empty or unset)

Then build and deploy:

```bash
npm run build
firebase deploy --only hosting
```

## 4) Stripe webhook

Set webhook endpoint in Stripe Dashboard:

- `https://circle-prospecting-ai.web.app/api/webhooks/stripe`

Copy endpoint signing secret into API env:

- `STRIPE_WEBHOOK_SECRET=whsec_...`

## 5) Smoke test

After deploy, verify:

1. `https://circle-prospecting-ai.web.app/api/health`
2. Checkout opens Stripe page
3. Success page shows order number
4. `/admin/purchases` shows the purchase (after webhook delivery)
