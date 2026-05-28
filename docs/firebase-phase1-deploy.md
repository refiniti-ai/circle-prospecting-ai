# Firebase-Only Phase 1 Deploy

The SPA is on Firebase Hosting. The Express API must be reachable over HTTPS from the browser.

## Choose one

### A) API on its own URL (default `firebase.json`)

Hosting does **not** rewrite `/api/**`. The production build must include your API origin:

1. Deploy the API container (Cloud Run, Render, etc.) and copy its HTTPS base URL (no path, no trailing slash), e.g. `https://circle-prospecting-api-xxxxx-uc.a.run.app`.
2. In `.env` or `.env.production` (used when you run `npm run build`):

   ```bash
   VITE_API_BASE_URL=https://YOUR-API-ORIGIN
   ```

3. On the API set at least:

   - `APP_PUBLIC_URL=https://YOUR_PROJECT.web.app`
   - `CORS_ORIGIN=https://YOUR_PROJECT.web.app`
   - Stripe and other secrets as in `.env.example`

4. **Stripe webhook** (server-to-server) must hit the **API** URL, not Hosting:

   - `https://YOUR-API-ORIGIN/api/webhooks/stripe`

5. Build and deploy:

   ```bash
   npm run build
   firebase deploy --only hosting
   ```

### B) Same domain `/api/*` → Cloud Run

1. Deploy Cloud Run service **`circle-prospecting-ai-git`** in **`us-central1`** (must match `firebase.json`):

   ```bash
   npm run deploy:gcloud
   ```

   Or manually:

   ```bash
   gcloud run deploy circle-prospecting-ai-git --source . --region us-central1 --allow-unauthenticated --project circle-prospecting-ai --port 8080
   ```

2. `firebase.json` already rewrites `/api/**` → that service (keep this **before** the `**` SPA rule):

3. Leave **`VITE_API_BASE_URL` empty** when building; the SPA calls relative `/api/*`.
4. Stripe webhook can use the Hosting URL:

   - `https://YOUR_PROJECT.web.app/api/webhooks/stripe`

## API runtime environment (Cloud Run or other)

Set these on the API process:

- `PORT=8080` (Cloud Run sets this automatically)
- `APP_PUBLIC_URL=https://circle-prospecting-ai.web.app` (match your site)
- `CORS_ORIGIN=https://circle-prospecting-ai.web.app`
- `STRIPE_SECRET_KEY=...`
- `STRIPE_WEBHOOK_SECRET=...`
- `ADMIN_USERNAME=...` / `ADMIN_PASSWORD=...` (admin UI login; JWT signed with `DASHBOARD_JWT_SECRET`)
- `DASHBOARD_JWT_SECRET=...` (32+ random chars in production; used for client dashboard + admin session JWT)
- Optional legacy scripts: `ADMIN_API_KEY=...` (static Bearer; browser admin no longer needs this)
- `PURCHASE_NOTIFICATION_EMAIL=you@yourdomain.com`

Optional:

- `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON`
- `GHL_MAIL_WEBHOOK_URL`, `RESEND_API_KEY` (+ `RESEND_FROM`), or `SMTP_*`

## Deploy API to Cloud Run (CLI example)

From repo root, after `gcloud` auth and project set:

```bash
npm run deploy:gcloud
```

Configure env vars and secrets in the Cloud Run service (Console or `--set-env-vars` / Secret Manager). Do not bake `secrets/` into the image for production; use Secret Manager or `FIREBASE_SERVICE_ACCOUNT_JSON`.

See [Firebase Hosting + Cloud Run](https://firebase.google.com/docs/hosting/cloud-run) for linking Hosting to Run.

## Smoke test

1. Open `https://YOUR_PROJECT.web.app` — buy flow should reach checkout without network errors.
2. If using path A: `https://YOUR-API-ORIGIN/api/health`
3. If using path B: `https://YOUR_PROJECT.web.app/api/health`
4. Complete a test checkout; confirm webhook delivery in Stripe Dashboard.
