/**
 * LEAD_PACKS: comma list of sizeCents, e.g. "10:5000,25:12000,50:20000" (cents in USD)
 */
export function getLeadPacks(): { size: number; unitAmountCents: number }[] {
  const raw = process.env.LEAD_PACKS || "10:9900,25:19900,50:34900,100:59900";
  const out: { size: number; unitAmountCents: number }[] = [];
  for (const part of raw.split(",")) {
    const [s, c] = part.split(":").map((x) => x.trim());
    const size = Number.parseInt(s || "0", 10);
    const unitAmountCents = Number.parseInt(c || "0", 10);
    if (size > 0 && unitAmountCents >= 100) {
      out.push({ size, unitAmountCents });
    }
  }
  return out.sort((a, b) => a.size - b.size);
}

export function getPackPriceCents(size: number): number | undefined {
  return getLeadPacks().find((p) => p.size === size)?.unitAmountCents;
}
