/**
 * Print links to refresh WhatsApp / Messenger link-preview cache after deploy.
 */
const urls = [
  "https://circleprospecting.ai/",
  "https://circleprospecting.ai/buy-leads",
  "https://circleprospecting.ai/pay/jlzeV24CREfQhQLX0ND7",
];

console.log("\nShare preview image (must load in browser):");
console.log("  https://circleprospecting.ai/og-card.png\n");
console.log("Messenger / Facebook — paste each URL, click Scrape Again twice:");
console.log("  https://developers.facebook.com/tools/debug/\n");
for (const url of urls) {
  console.log(`  ${url}`);
}
console.log(
  "\nWhatsApp caches per URL. After deploy, use Sharing Debugger above, then send the link in a NEW chat (or wait ~24h).\n"
);
