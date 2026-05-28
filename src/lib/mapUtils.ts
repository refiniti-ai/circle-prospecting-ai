import type { RadiusId } from "./listingData";

/** Map listing ring or manual mile radius to a preview circle size. */
export function radiusIdFromMiles(miles: number): RadiusId {
  if (!Number.isFinite(miles) || miles <= 0.25) return "q1";
  if (miles <= 0.5) return "h1";
  if (miles <= 1) return "m1";
  return "zip";
}

const MILE_M = 1609.34;

const RADIUS_M: Record<RadiusId, number> = {
  subdivision: 180,
  q1: MILE_M * 0.25,
  h1: MILE_M * 0.5,
  m1: MILE_M * 1,
  zip: 4500,
};

export function getRadiusMeters(radius: RadiusId, milesOverride?: number): number {
  if (milesOverride != null && Number.isFinite(milesOverride) && milesOverride > 0) {
    return milesOverride * MILE_M;
  }
  return RADIUS_M[radius];
}

/** Google Maps zoom level that frames the preview circle. */
export function getMapZoomForRadiusMeters(meters: number): number {
  if (meters <= 280) return 16;
  if (meters <= 550) return 15;
  if (meters <= 1100) return 14;
  if (meters <= 2200) return 13;
  if (meters <= 4500) return 12;
  return 11;
}

/** OSM embed bbox half-span in degrees (~scales with mile radius). */
export function osmBboxDeltaMiles(miles: number): number {
  const m = Number.isFinite(miles) && miles > 0 ? miles : 1;
  return Math.max(0.008, Math.min(0.12, m * 0.018));
}

/** SVG ring radius (% of viewBox) for OSM overlay — relative to ~5 mi max manual pick. */
export function ringVisualPercentFromMiles(miles: number): number {
  const m = Number.isFinite(miles) && miles > 0 ? miles : 1;
  const t = Math.min(1, Math.max(0.12, m / 5));
  return 14 + t * 34;
}
