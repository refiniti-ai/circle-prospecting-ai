/**
 * Downloads US cities CSV and writes compact geo JSON for Buy Leads dropdowns.
 * Run: node scripts/build-us-geo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dir, "..");
const outPath = path.join(root, "src", "data", "usGeo.json");
const url =
  "https://raw.githubusercontent.com/kelvins/US-Cities-Database/main/csv/us_cities.csv";

async function main() {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map((h) => h.trim());
  const idx = {
    stateCode: header.indexOf("STATE_CODE"),
    stateName: header.indexOf("STATE_NAME"),
    city: header.indexOf("CITY"),
    county: header.indexOf("COUNTY"),
  };
  if (idx.stateCode < 0 || idx.city < 0 || idx.county < 0) throw new Error("Unexpected CSV columns");

  /** @type {Map<string, { county: string; stateName: string; stateCode: string }>} */
  const countyMap = new Map();
  /** @type {Map<string, Set<string>>} */
  const citiesByCountyKey = new Map();

  /** @type {{ k: string; label: string; city: string; county: string; stateName: string; stateCode: string }[]} */
  const citiesFlat = [];

  function parseLine(line) {
    const parts = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQ = !inQ;
      } else if (ch === "," && !inQ) {
        parts.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    parts.push(cur);
    return parts.map((p) => p.trim());
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const stateCode = cols[idx.stateCode];
    const stateName = cols[idx.stateName] || "";
    const city = cols[idx.city];
    const county = cols[idx.county];
    if (!stateCode || !city || !county) continue;
    const ck = `${county}|${stateCode}`;
    if (!countyMap.has(ck)) {
      countyMap.set(ck, { county, stateName, stateCode });
    }
    if (!citiesByCountyKey.has(ck)) citiesByCountyKey.set(ck, new Set());
    citiesByCountyKey.get(ck).add(city);
    const k = `${city}|${county}|${stateCode}`;
    citiesFlat.push({
      k,
      label: `${city}, ${stateCode}`,
      city,
      county,
      stateName,
      stateCode,
    });
  }

  const counties = Array.from(countyMap.entries())
    .map(([key, v]) => ({
      key,
      label: `${v.county}, ${v.stateCode}`,
      county: v.county,
      stateName: v.stateName,
      stateCode: v.stateCode,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const cities = {};
  for (const [ck, set] of citiesByCountyKey) {
    cities[ck] = Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  citiesFlat.sort((a, b) => a.label.localeCompare(b.label));

  const payload = { counties, cities, citiesFlat };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload), "utf8");
  console.log(
    `Wrote ${outPath} (${counties.length} counties, ${citiesFlat.length} city rows, grouped keys ${Object.keys(cities).length})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
