import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Request, Response } from "express";
import { PRODUCTION_SITE_ORIGIN } from "../src/lib/siteUrl.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadSpaIndex(): string {
  const candidates = [
    path.join(root, "dist", "index.html"),
    path.join(root, "index.html"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  throw new Error("index.html not found for share HTML");
}

const OG_TITLE = "Circle Prospecting AI";
const OG_DESCRIPTION =
  "Automated Prospecting for Modern Real Estate. Automated circle prospecting for modern real estate. Turn new listings into neighborhood campaigns in minutes.";

/** Inject canonical og:url for /pay links so Messenger shows description (matches scraped URL). */
export function shareHtmlForPay(req: Request, res: Response) {
  const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  const host = (req.get("x-forwarded-host") || req.get("host") || "circleprospecting.ai").split(",")[0].trim();
  const canonical = `${proto}://${host}${req.originalUrl}`;
  const base = PRODUCTION_SITE_ORIGIN.replace(/\/$/, "");

  let html = loadSpaIndex();
  html = html.replace(/<meta property="og:url"[^>]*>\s*/i, "");
  html = html.replace(
    /<meta property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${OG_TITLE}" />`
  );
  html = html.replace(
    /<meta property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${OG_DESCRIPTION}" />`
  );
  const ogBlock = [
    `<meta property="og:url" content="${canonical}" />`,
    `<link rel="canonical" href="${canonical}" />`,
  ].join("\n    ");
  html = html.replace(/<meta property="og:type"[^>]*>/i, `${ogBlock}\n    $&`);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.status(200).send(html);
}
