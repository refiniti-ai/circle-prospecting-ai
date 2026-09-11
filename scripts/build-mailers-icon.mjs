import sharp from "sharp";

/** Mailer icon: green envelope, transparent background (no black square). */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="7" y="13" width="50" height="38" fill="#52c41a" stroke="#1a1a1a" stroke-width="4"/>
  <polyline points="7,17 32,36 57,17" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linejoin="miter"/>
  <line x1="7" y1="51" x2="22" y2="36" stroke="#1a1a1a" stroke-width="4"/>
  <line x1="57" y1="51" x2="42" y2="36" stroke="#1a1a1a" stroke-width="4"/>
</svg>`;

await sharp(Buffer.from(svg)).webp({ quality: 92, alphaQuality: 100 }).toFile("public/Mailers.webp");
console.log("Wrote public/Mailers.webp");
