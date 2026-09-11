import fs from "fs";

const p = "src/pages/BuyLeads.tsx";
let s = fs.readFileSync(p, "utf8");

const startMarker = '              <div className="buy-summary-grid">';
const endMarker =
  '              <motion style={{ marginTop: "1rem", display: "grid", gap: "0.85rem" }}>';

const endMarkerReal = endMarker.replace("<motion", "<div");

const start = s.indexOf(startMarker);
const end = s.indexOf(endMarkerReal, start);
if (start < 0 || end < 0) {
  console.error("markers not found", { start, end });
  process.exit(1);
}

const lines = [
  '              <div className="buy-summary-grid">',
  "                {listing ? (",
  '                  <div className="buy-summary-span2">',
  "                    <span>Listing</span>",
  "                    <strong>",
  "                      {listing.mls} · {listing.address}, {listing.cityStateZip}",
  "                    </strong>",
  "                  </div>",
  "                ) : null}",
  "                <div>",
  "                  <span>Campaign</span>",
  '                  <strong>{campaignType === "just_listed" ? "Just listed" : "Just sold"}</strong>',
  "                </div>",
  "                <div>",
  '                  <span>{listing ? "Target ring" : "Target area"}</span>',
  "                  <strong>",
  "                    {listing && selectedListingRing",
  "                      ? selectedListingRing.label",
  '                      : `${city}, ${county} ${zip} · ${radius} mi`}',
  "                  </strong>",
  "                </div>",
  "                <div>",
  "                  <span>Homes in order</span>",
  "                  <strong>{requestedLeads.toLocaleString()}</strong>",
  "                </div>",
  "                <motion>",
  '                  <span>Service (product)</span>',
  "                  <strong>{serviceLineLabel(serviceLine)}</strong>",
  "                </div>",
  "                <div>",
  "                  <span>Plan band</span>",
  "                  <strong>",
  "                    {selectedTierMeta.packageLabel} · {formatMoneyUsd(pricePerLeadUsd(serviceLine, selectedTier))}/home",
  "                  </strong>",
  "                </div>",
  "                {!listing ? (",
  "                  <>",
  "                    <div>",
  "                      <span>Homeowners matched</span>",
  "                      <strong>{formatHomeownersMatchedDisplay(estimatedAvailable)}</strong>",
  "                    </div>",
  "                    <div>",
  "                      <span>Inventory base</span>",
  "                      <strong>{inventoryBaseAvailable.toLocaleString(\"en-US\")}</strong>",
  "                    </motion>",
  "                  </>",
  "                ) : null}",
  "                <div>",
  "                  <span>Campaign total (est.)</span>",
  '                  <strong className="gradient-text">{formatMoneyUsd(checkoutTotalCents / 100)}</strong>',
  "                </div>",
  "              </div>",
  "",
];

// Build clean - replace any accidental motion with div
let newBlock = lines.join("\n");
newBlock = newBlock.replaceAll("<motion>", "<div>").replaceAll("</motion>", "</div>");

if (newBlock.includes("motion")) {
  console.error("still has motion");
  process.exit(1);
}

s = s.slice(0, start) + newBlock + s.slice(end);
fs.writeFileSync(p, s);
console.log("patched review grid OK");
