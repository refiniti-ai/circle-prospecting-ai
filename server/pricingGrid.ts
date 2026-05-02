import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

export type PlanId = "ai" | "live" | "pro";

export type CampaignTier = { min: number; max: number; rates: Record<PlanId, number> };

const DEFAULT_TIERS: CampaignTier[] = [
  { min: 0, max: 250, rates: { ai: 0.25, live: 0.75, pro: 0.85 } },
  { min: 251, max: 500, rates: { ai: 0.23, live: 0.7, pro: 0.8 } },
  { min: 501, max: 1000, rates: { ai: 0.21, live: 0.65, pro: 0.75 } },
  { min: 1001, max: 2500, rates: { ai: 0.19, live: 0.6, pro: 0.7 } },
  { min: 2501, max: Number.POSITIVE_INFINITY, rates: { ai: 0.15, live: 0.5, pro: 0.6 } },
];

let cached: { tiers: CampaignTier[]; source: "file" | "default"; path: string | null } | null = null;

function resolveCsvPath(): string {
  const env = process.env.PRICING_GRID_CSV?.trim();
  if (env) return env;
  const dir = path.dirname(fileURLToPath(import.meta.url));
  /** Server-only tier file — never expose via static hosting (`public/`). */
  return path.join(dir, "data", "pricing-grid.csv");
}

function parseMoney(s: string): number {
  const t = s.replace(/[$,\s]/g, "").trim();
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
}

function normKey(k: string): string {
  return k.trim().toLowerCase().replace(/\s+/g, "");
}

function rowToTier(row: Record<string, string>): CampaignTier | null {
  const keys = Object.keys(row).reduce<Record<string, string>>((acc, k) => {
    acc[normKey(k)] = row[k];
    return acc;
  }, {});
  const minRaw = keys.min ?? keys["homesmin"];
  const maxRaw = keys.max ?? keys["homesmax"] ?? "";
  const aiRaw = keys.ai ?? keys["ai/home"] ?? keys["aiperhome"];
  const liveRaw = keys.live ?? keys["live/home"] ?? keys["liveperhome"];
  const proRaw = keys.pro ?? keys["pro/home"] ?? keys["properhome"];

  const min = Number.parseInt(String(minRaw ?? "").trim(), 10);
  if (!Number.isFinite(min) || min < 0) return null;

  const maxStr = String(maxRaw ?? "").trim();
  const max =
    maxStr === "" || maxStr === "*" || maxStr.toLowerCase() === "inf" || maxStr.toLowerCase() === "infinity"
      ? Number.POSITIVE_INFINITY
      : Number.parseInt(maxStr, 10);
  if (!Number.isFinite(max) && max !== Number.POSITIVE_INFINITY) return null;
  if (max !== Number.POSITIVE_INFINITY && max < min) return null;

  const ai = parseMoney(String(aiRaw ?? ""));
  const live = parseMoney(String(liveRaw ?? ""));
  const pro = parseMoney(String(proRaw ?? ""));
  if (![ai, live, pro].every((x) => Number.isFinite(x) && x > 0)) return null;

  return { min, max, rates: { ai, live, pro } };
}

export function loadPricingGridFromDisk(): {
  tiers: CampaignTier[];
  source: "file" | "default";
  path: string | null;
  warn?: string;
} {
  const csvPath = resolveCsvPath();
  if (!fs.existsSync(csvPath)) {
    return { tiers: DEFAULT_TIERS, source: "default", path: csvPath };
  }
  try {
    const raw = fs.readFileSync(csvPath, "utf8");
    const records = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    const tiers: CampaignTier[] = [];
    for (const row of records) {
      const t = rowToTier(row);
      if (t) tiers.push(t);
    }
    if (tiers.length === 0) {
      return { tiers: DEFAULT_TIERS, source: "default", path: csvPath, warn: "CSV had no valid tier rows" };
    }
    tiers.sort((a, b) => a.min - b.min);
    return { tiers, source: "file", path: csvPath };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { tiers: DEFAULT_TIERS, source: "default", path: csvPath, warn: msg };
  }
}

export function getCampaignTiers(): CampaignTier[] {
  if (!cached) {
    const r = loadPricingGridFromDisk();
    cached = { tiers: r.tiers, source: r.source, path: r.path };
    if (r.warn) {
      console.warn("[campaign-pricing]", r.warn, r.path ? `(${r.path})` : "");
    }
    if (r.source === "file") {
      console.info("[campaign-pricing] loaded tier grid:", r.path);
    }
  }
  return cached.tiers;
}

export function getPricingGridMeta(): { source: "file" | "default"; path: string | null } {
  if (!cached) getCampaignTiers();
  return { source: cached!.source, path: cached!.path };
}

/** For tests or hot-reload later */
export function resetPricingGridCache(): void {
  cached = null;
}
