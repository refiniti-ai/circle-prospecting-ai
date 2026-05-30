/**
 * Pre-warm Facebook/Messenger link preview cache (Open Graph scrape).
 * Requires env: FACEBOOK_APP_ID + FACEBOOK_APP_SECRET, or FACEBOOK_ACCESS_TOKEN
 *
 * Usage: node scripts/facebook-scrape-urls.mjs [url1] [url2] ...
 */
import "dotenv/config";

const urls = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "https://circleprospecting.ai/",
      "https://circleprospecting.ai/buy-leads",
      "https://circleprospecting.ai/pay/jlzeV24CREfQhQLX0ND7",
    ];

async function getToken() {
  if (process.env.FACEBOOK_ACCESS_TOKEN?.trim()) {
    return process.env.FACEBOOK_ACCESS_TOKEN.trim();
  }
  const id = process.env.FACEBOOK_APP_ID?.trim();
  const secret = process.env.FACEBOOK_APP_SECRET?.trim();
  if (!id || !secret) return null;
  const r = await fetch(
    `https://graph.facebook.com/oauth/access_token?client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`
  );
  if (!r.ok) throw new Error(`Token request failed: ${r.status}`);
  const j = await r.json();
  return j.access_token;
}

const token = await getToken();
if (!token) {
  console.warn(
    "Skip Facebook scrape: set FACEBOOK_ACCESS_TOKEN or FACEBOOK_APP_ID + FACEBOOK_APP_SECRET in .env"
  );
  console.warn("Greg can still refresh manually: https://developers.facebook.com/tools/debug/");
  process.exit(0);
}

for (const url of urls) {
  const api = `https://graph.facebook.com/v21.0/?id=${encodeURIComponent(url)}&scrape=true&access_token=${encodeURIComponent(token)}`;
  const r = await fetch(api, { method: "POST" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error(`FAIL ${url}`, body);
    continue;
  }
  console.log(`Scraped OK: ${url}`);
}
