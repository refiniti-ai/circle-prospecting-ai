import { useEffect, useRef, useState } from "react";
import { geocodeUSAddress } from "../../lib/geocodeAddress";
import {
  hasValidMapCoords,
  listingAddressGeocodeQuery,
  type ListingFormValues,
  type ListingPayload,
} from "../../lib/listingData";

type DraftCoords = {
  mapLat: number;
  mapLng: number;
  listing: ListingPayload;
  form: ListingFormValues;
};

function resolveInitialCoords(draft: DraftCoords): { lat: number; lng: number } {
  if (hasValidMapCoords(draft.mapLat, draft.mapLng)) {
    return { lat: draft.mapLat, lng: draft.mapLng };
  }
  if (hasValidMapCoords(draft.listing.lat, draft.listing.lng)) {
    return { lat: draft.listing.lat, lng: draft.listing.lng };
  }
  return { lat: 0, lng: 0 };
}

/** Geocode listing address when intro draft has no map pin (mirrors buy-leads map behavior). */
export function useIntroCampaignMapPreview(draft: DraftCoords | null) {
  const initial = draft ? resolveInitialCoords(draft) : { lat: 0, lng: 0 };
  const [mapLat, setMapLat] = useState(initial.lat);
  const [mapLng, setMapLng] = useState(initial.lng);
  const [locatingMap, setLocatingMap] = useState(false);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const geocodeGenRef = useRef(0);

  useEffect(() => {
    if (!draft) return;

    const start = resolveInitialCoords(draft);
    setMapLat(start.lat);
    setMapLng(start.lng);
    setMapNotice(null);

    if (hasValidMapCoords(start.lat, start.lng)) return;

    const query = listingAddressGeocodeQuery(draft.form);
    if (query.length < 10) {
      setMapNotice("Could not place this address on the map yet. Check the street, city, state, and ZIP.");
      return;
    }

    const gen = ++geocodeGenRef.current;
    setLocatingMap(true);

    void geocodeUSAddress(query, undefined, draft.form)
      .then((geo) => {
        if (gen !== geocodeGenRef.current) return;
        if (!hasValidMapCoords(geo.lat, geo.lng)) {
          setMapNotice("Could not find this address on the map. Check street, city, state, and ZIP.");
          return;
        }
        setMapLat(geo.lat);
        setMapLng(geo.lng);
        setMapNotice(
          geo.approximate
            ? "Exact address not found — map centered on the ZIP code area."
            : null
        );
      })
      .catch(() => {
        if (gen !== geocodeGenRef.current) return;
        setMapNotice("Map location could not be loaded. Try refining the address.");
      })
      .finally(() => {
        if (gen === geocodeGenRef.current) setLocatingMap(false);
      });
  }, [draft]);

  const mapHasCoords = hasValidMapCoords(mapLat, mapLng);

  return { mapLat, mapLng, mapHasCoords, locatingMap, mapNotice };
}
