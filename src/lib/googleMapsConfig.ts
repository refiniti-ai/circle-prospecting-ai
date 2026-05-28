/** Shared Maps JS loader id (Order / marketing map previews). */
export const GOOGLE_MAPS_LOADER_ID = "circle-prospecting-maps";

/** Must match on every `useJsApiLoader` call — mixed options crash the app. */
export const GOOGLE_MAPS_LIBRARIES: ("places")[] = ["places"];

export function googleMapsApiKey(): string | undefined {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
}
