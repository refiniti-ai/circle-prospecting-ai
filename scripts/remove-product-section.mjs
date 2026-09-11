import fs from "fs";

const p = "src/pages/BuyLeads.tsx";
let s = fs.readFileSync(p, "utf8");
const marker = '<h3 className="buy-step2-subhead">3 · Which product should we run?</h3>';
const start = s.indexOf(marker);
if (start < 0) {
  console.error("marker not found");
  process.exit(1);
}
const blockStart = s.lastIndexOf('<div className="buy-step2-block"', start);
const end = s.indexOf("{checkoutTotalCents < 50 && (", start);
if (blockStart < 0 || end < 0) {
  console.error("bounds not found", blockStart, end);
  process.exit(1);
}
s = s.slice(0, blockStart) + s.slice(end);
fs.writeFileSync(p, s);
console.log("done");
