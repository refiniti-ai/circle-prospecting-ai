export type UsCountyRow = {
  key: string;
  label: string;
  county: string;
  stateName: string;
  stateCode: string;
};

export type UsCityRow = {
  k: string;
  label: string;
  city: string;
  county: string;
  stateName: string;
  stateCode: string;
};

export type UsGeoData = {
  counties: UsCountyRow[];
  cities: Record<string, string[]>;
  citiesFlat: UsCityRow[];
};

export async function loadUsGeoData(): Promise<UsGeoData> {
  const m = await import("../data/usGeo.json");
  return m.default as UsGeoData;
}
