import type { Request, Response } from "express";
import {
  getIntroListingSnapshot,
  isIntroListingSnapshot,
  upsertIntroListingSnapshot,
} from "./introListingSnapshotStore.js";

/** GET /api/intro/listing-snapshot?mls= — $99 checkout only. */
export async function handleIntroListingSnapshotGet(req: Request, res: Response): Promise<void> {
  const mls = String(req.query.mls ?? "").trim();
  if (mls.length < 3) {
    res.status(400).json({ error: "invalid_mls" });
    return;
  }
  try {
    const listing = await getIntroListingSnapshot(mls);
    if (!listing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ listing });
  } catch (err) {
    console.error("[introListingSnapshot] get failed", err);
    res.status(500).json({ error: "snapshot_read_failed" });
  }
}

/** POST /api/intro/listing-snapshot — save one listing when they pick it on $99. */
export async function handleIntroListingSnapshotPut(req: Request, res: Response): Promise<void> {
  const listing = (req.body as { listing?: unknown })?.listing;
  if (!isIntroListingSnapshot(listing)) {
    res.status(400).json({ error: "invalid_listing" });
    return;
  }
  try {
    const record = await upsertIntroListingSnapshot(listing);
    res.json({ ok: true, mls: record.mls });
  } catch (err) {
    console.error("[introListingSnapshot] upsert failed", err);
    res.status(500).json({ error: "snapshot_write_failed" });
  }
}
