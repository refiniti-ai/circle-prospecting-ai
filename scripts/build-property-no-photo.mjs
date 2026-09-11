/**
 * Build default listing placeholder (Property.webp) from PNG source.
 * Run: node scripts/build-property-no-photo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pub = path.join(root, "public");

const cursorAssets = path.join(
  root,
  "..",
  "..",
  "..",
  ".cursor",
  "projects",
  "c-Users-pudum-OneDrive-Desktop-Cursor-Projects-USA-Projects-Circle-Prospecting-AI",
  "assets"
);
const cursorPng = fs.existsSync(cursorAssets)
  ? fs
      .readdirSync(cursorAssets)
      .filter((name) => name.includes("Property_no_photo_available") && name.endsWith(".png"))
      .map((name) => path.join(cursorAssets, name))
  : [];

const candidates = [
  path.join(pub, "Property-no-photo-available.png"),
  path.join(root, "assets", "Property-no-photo-available.png"),
  ...cursorPng,
].filter((p) => fs.existsSync(p));

const src = candidates[0];
if (!src) throw new Error("Missing Property-no-photo-available.png in public/ or assets/");

const pngOut = path.join(pub, "Property-no-photo-available.png");
if (src !== pngOut) fs.copyFileSync(src, pngOut);

const webpOut = path.join(pub, "Property.webp");
const webpAlt = path.join(pub, "Property-no-photo-available.webp");

await sharp(pngOut).webp({ quality: 90 }).toFile(webpOut);
await sharp(pngOut).webp({ quality: 90 }).toFile(webpAlt);

console.log("Wrote", pngOut, webpOut, webpAlt);
