import type { RadiusId } from "./listingData";

const MILE_M = 1609.34;

const RADIUS_M: Record<RadiusId, number> = {
  subdivision: 180,
  q1: MILE_M * 0.25,
  h1: MILE_M * 0.5,
  m1: MILE_M * 1,
  zip: 4500,
};

export function getRadiusMeters(radius: RadiusId): number {
  return RADIUS_M[radius];
}
