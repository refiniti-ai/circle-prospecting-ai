/**
 * Build email logo with transparent background.
 * Run: node scripts/build-email-logo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(__dirname, "..", "public");
const candidates = [
  path.join(pub, "logo.jpeg"),
  path.join(pub, "circle-prospecting-logo.png"),
].filter((p) => fs.existsSync(p));
const src = candidates[0];
if (!src) throw new Error("Missing public/circle-prospecting-logo.png or logo.jpeg");

const outWebp = path.join(pub, "logo-email.webp");
const outPng = path.join(pub, "logo-email.png");

function isBackground(r, g, b, a) {
  if (a < 16) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 48) return true;
  if (max < 80 && max - min < 28) return true;
  if (max < 95 && min < 55 && b >= r - 8 && b >= g - 8) return true;
  return false;
}

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width;
const h = info.height;
for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const a = data[i + 3];
  if (isBackground(r, g, b, a)) data[i + 3] = 0;
}

const rgba = sharp(data, { raw: { width: w, height: h, channels: 4 } });
const resized = rgba.resize({ width: 520, withoutEnlargement: false });
await resized.clone().png({ compressionLevel: 9 }).toFile(outPng);
await resized.clone().webp({ quality: 92, alphaQuality: 100 }).toFile(outWebp);
console.log("Source:", src);
console.log("Wrote", outPng, outWebp, `(${w}x${h} → 520w)`);
