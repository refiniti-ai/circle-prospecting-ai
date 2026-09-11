import type { CSSProperties } from "react";
import { Circle, GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

const MAP_LOADER_ID = "cpai-google-maps-loader";

const containerStyle: CSSProperties = {
  width: "100%",
  height: 290,
  border: "none",
  display: "block",
  borderRadius: 12,
};

function openStreetMapEmbedSrc(lat: number, lng: number, radiusMiles: number): string {
  const safeMiles = Number.isFinite(radiusMiles) ? Math.max(0.25, radiusMiles) : 1;
  const latPad = safeMiles / 69;
  const lngPad = safeMiles / Math.max(15, 69 * Math.cos((lat * Math.PI) / 180));
  const minLng = lng - lngPad;
  const minLat = lat - latPad;
  const maxLng = lng + lngPad;
  const maxLat = lat + latPad;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function zoomForRadiusMiles(miles: number): number {
  if (miles <= 0.25) return 14;
  if (miles <= 0.5) return 13;
  if (miles <= 1) return 12;
  if (miles <= 2) return 11;
  if (miles <= 3) return 10;
  return 9;
}

type Props = {
  lat: number;
  lng: number;
  radiusMiles: number;
};

function OsmPreview({ lat, lng, radiusMiles }: Props) {
  const src = openStreetMapEmbedSrc(lat, lng, radiusMiles);
  return (
    <iframe
      title="Neighborhood map preview"
      src={src}
      style={containerStyle}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

function GooglePreview({ lat, lng, radiusMiles }: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
  const { isLoaded, loadError } = useJsApiLoader({
    id: MAP_LOADER_ID,
    googleMapsApiKey: apiKey,
  });

  if (loadError) {
    return <OsmPreview lat={lat} lng={lng} radiusMiles={radiusMiles} />;
  }

  if (!isLoaded) {
    return (
      <div
        style={{
          ...containerStyle,
          display: "grid",
          placeItems: "center",
          background: "rgba(15, 23, 42, 0.04)",
          color: "var(--muted)",
          fontSize: "0.9rem",
        }}
      >
        Loading map…
      </div>
    );
  }

  const center = { lat, lng };
  const m = Number.isFinite(radiusMiles) ? Math.max(0.25, radiusMiles) : 1;
  const radiusMeters = m * 1609.344;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={zoomForRadiusMiles(m)}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        zoomControl: true,
      }}
    >
      <Marker position={center} />
      <Circle
        center={center}
        radius={radiusMeters}
        options={{
          strokeColor: "#007aff",
          strokeOpacity: 0.95,
          strokeWeight: 2,
          fillColor: "#34c759",
          fillOpacity: 0.14,
        }}
      />
    </GoogleMap>
  );
}

/** Neighborhood preview: Google Maps when `VITE_GOOGLE_MAPS_API_KEY` is set, otherwise OpenStreetMap embed. */
export function BuyLeadsMapPreview(props: Props) {
  if (import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return <GooglePreview {...props} />;
  }
  return <OsmPreview {...props} />;
}
