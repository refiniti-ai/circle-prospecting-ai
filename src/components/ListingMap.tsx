import { Circle, GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import type { RadiusId } from "../lib/listingData";
import { getRadiusMeters } from "../lib/mapUtils";

const darkStyles: { elementType?: string; featureType?: string; stylers: { color?: string; visibility?: string }[] }[] = [
  { elementType: "geometry", stylers: [{ color: "#0c1220" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0c1220" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a9bb5" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1628" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a2840" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
];

const mapContainerStyle = { width: "100%", height: "100%" };

type Props = {
  lat: number;
  lng: number;
  radius: RadiusId;
};

function MapPlaceholder({ lat, lng, radius }: Props) {
  const zoom = radius === "zip" ? 11 : radius === "m1" ? 13 : 14;
  const frameSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02}%2C${lat - 0.015}%2C${lng + 0.02}%2C${lat + 0.015}&layer=mapnik&marker=${lat}%2C${lng}`;
  return (
    <div
      className="gradient-border"
      style={{
        height: 360,
        overflow: "hidden",
      }}
    >
      <iframe
        title="OpenStreetMap preview"
        src={frameSrc}
        style={{ width: "100%", height: "100%", border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          padding: "0.5rem 0.75rem",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "rgba(5, 11, 18, 0.82)",
          color: "var(--text)",
          fontSize: "0.8rem",
          backdropFilter: "blur(6px)",
        }}
      >
        OSM preview · z{zoom} · radius {Math.round(getRadiusMeters(radius))}m
      </div>
    </div>
  );
}

function ListingMapLoaded({ lat, lng, radius }: Props) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "circle-prospecting-maps",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY!,
  });

  if (loadError) {
    return (
      <div
        className="gradient-border"
        style={{ height: 360, display: "grid", placeItems: "center", color: "#f87171" }}
      >
        Could not load Google Maps. Check the browser console and your API key restrictions.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className="gradient-border"
        style={{ height: 360, display: "grid", placeItems: "center", color: "var(--muted)" }}
      >
        Loading map…
      </div>
    );
  }

  const center = { lat, lng };
  const r = getRadiusMeters(radius);

  return (
    <div
      className="gradient-border"
      style={{ height: 360, borderRadius: "var(--radius-lg)", overflow: "hidden" }}
    >
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={radius === "zip" ? 11 : 14}
        options={{
          styles: darkStyles,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          zoomControl: true,
        }}
      >
        <Marker position={center} title="Subject listing" />
        <Circle
          center={center}
          radius={r}
          options={{
            strokeColor: "#1e90ff",
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: "#32d583",
            fillOpacity: 0.12,
          }}
        />
      </GoogleMap>
    </div>
  );
}

export function ListingMap(props: Props) {
  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return <MapPlaceholder {...props} />;
  }
  return <ListingMapLoaded {...props} />;
}
