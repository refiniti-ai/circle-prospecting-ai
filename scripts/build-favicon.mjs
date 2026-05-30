/**
 * Build public/favicon.png from favicon source (logo on white, square).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import sharp from "sharp";
import { imageOnWhite } from "./image-on-white.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const sourceBackup = path.join(root, "public", "favicon-source.png");
const outPath = path.join(root, "public", "favicon.png");
const SIZE = 512;
const PAD = 40;

let src = sourceBackup;
if (!fs.existsSync(src)) {
  if (!fs.existsSync(outPath)) {
    throw new Error("Missing public/favicon.png — add the logo file first.");
  }
  fs.copyFileSync(outPath, sourceBackup);
  src = sourceBackup;
  console.log("Saved original to public/favicon-source.png");
}

const meta = await sharp(src).metadata();
const maxInner = SIZE - PAD * 2;
const scale = Math.min(maxInner / meta.width, maxInner / meta.height);
const logoW = Math.round(meta.width * scale);
const logoH = Math.round(meta.height * scale);

const logo = await (await imageOnWhite(src))
  .resize(logoW, logoH, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toBuffer();

await sharp({
  create: { width: SIZE, height: SIZE, channels: 3, background: { r: 255, g: 255, b: 255 } },
})
  .composite([{ input: logo, top: Math.round((SIZE - logoH) / 2), left: Math.round((SIZE - logoW) / 2) }])
  .png({ compressionLevel: 9 })
  .toFile(outPath);

console.log(`Wrote ${outPath} (${SIZE}×${SIZE}, white background)`);
