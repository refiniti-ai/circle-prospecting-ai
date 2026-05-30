/**
 * One-time build: real JPEG preview-image.jpg (logo on white, no text on image).
 * Run manually: npm run build:preview-image
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { imageOnWhite } from "./image-on-white.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const out = path.join(root, "public", "preview-image.jpg");
const src =
  [path.join(root, "public", "favicon-source.png"), path.join(root, "public", "favicon.png")].find((p) =>
    fs.existsSync(p)
  ) ?? null;

if (!src) throw new Error("Missing public/favicon.png");

const W = 1200;
const H = 630;
const meta = await sharp(src).metadata();
/** Large logo fills the frame so WhatsApp uses the tall “image on top” card, not a tiny square thumb. */
const maxW = W - 48;
const maxH = H - 48;
const scale = Math.min(maxW / meta.width, maxH / meta.height);
const logoW = Math.round(meta.width * scale);
const logoH = Math.round(meta.height * scale);

const logo = await (await imageOnWhite(src))
  .resize(logoW, logoH, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toBuffer();

await sharp({
  create: { width: W, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } },
})
  .composite([{ input: logo, top: Math.round((H - logoH) / 2), left: Math.round((W - logoW) / 2) }])
  .jpeg({ quality: 92, mozjpeg: true })
  .toFile(out);

console.log(`Wrote ${out} (${W}×${H} JPEG, white background)`);
