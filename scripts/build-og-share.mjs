/**
 * Build 1200×630 share card (logo on white only — title/description come from OG meta tags).
 * Outputs og-card.png (canonical for WhatsApp/Messenger) + preview-image.jpg + og-share.png.
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { imageOnWhite } from "./image-on-white.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outCard = path.join(root, "public", "og-card.png");
const outPng = path.join(root, "public", "og-share.png");
const outJpg = path.join(root, "public", "preview-image.jpg");

const srcCandidates = [
  path.join(root, "public", "favicon-source.png"),
  path.join(root, "public", "preview-image-source.webp"),
  path.join(root, "public", "preview-image.jpg"),
];
const srcPath = srcCandidates.find((p) => fs.existsSync(p));
if (!srcPath) {
  throw new Error("Missing logo source (favicon-source.png or preview-image.jpg).");
}
const logoSrc = srcPath;

const W = 1200;
const H = 630;
const MAX_LOGO_W = 920;

const meta = await sharp(logoSrc).metadata();
const scale = Math.min(MAX_LOGO_W / meta.width, (H - 80) / meta.height);
const logoW = Math.round(meta.width * scale);
const logoH = Math.round(meta.height * scale);

const logo = await (await imageOnWhite(logoSrc))
  .resize(logoW, logoH, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toBuffer();

const canvas = await sharp({
  create: { width: W, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } },
})
  .png()
  .toBuffer();

const card = await sharp(canvas)
  .composite([{ input: logo, top: Math.round((H - logoH) / 2), left: Math.round((W - logoW) / 2) }])
  .png({ compressionLevel: 9 })
  .toBuffer();

await sharp(card).png().toFile(outCard);
await sharp(card).png().toFile(outPng);
await sharp(card).jpeg({ quality: 92, mozjpeg: true }).toFile(outJpg);

console.log(`Wrote ${outCard}, ${outPng}, ${outJpg} (${W}×${H})`);
