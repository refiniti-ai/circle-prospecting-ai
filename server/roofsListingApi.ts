import type { Request, Response } from "express";
import { getRoofsListingByMls, isRoofsDbConfigured, type RoofsMlsStatus } from "./roofsMlsStore.js";

function parseStatus(raw: unknown): RoofsMlsStatus | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "active" || s === "coming_soon" || s === "pending" || s === "closed") return s;
  if (s === "cs" || s === "coming-soon") return "coming_soon";
  if (s === "listed" || s === "just_listed") return "active";
  if (s === "sold" || s === "just_sold") return "closed";
  return null;
}

export async function handleRoofsListingByMls(req: Request, res: Response): Promise<void> {
  const mls = String(req.query.mls ?? req.params.mls ?? "").trim();
  if (mls.length < 3 || mls.length > 40) {
    res.status(400).json({ error: "invalid_mls" });
    return;
  }
  if (!isRoofsDbConfigured()) {
    res.status(503).json({ error: "roofs_db_unconfigured" });
    return;
  }
  try {
    const listing = await getRoofsListingByMls(mls, parseStatus(req.query.status));
    if (!listing) {
      res.status(404).json({ error: "not_found", mls });
      return;
    }
    res.json({ listing });
  } catch (e) {
    console.error("[roofs] listing lookup failed", e);
    res.status(502).json({ error: "roofs_lookup_failed" });
  }
}
