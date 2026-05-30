import { Circle, GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useState } from "react";
import type { RadiusId } from "../lib/listingData";
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_LOADER_ID, googleMapsApiKey } from "../lib/googleMapsConfig";
import { getMapZoomForRadiusMeters, getRadiusMeters, osmBboxDeltaMiles, ringVisualPercentFromMiles } from "../lib/mapUtils";

const mapContainerStyle = { width: "100%", height: "100%" };

type Props = {
  lat: number;
  lng: number;
  radius: RadiusId;
  /** Exact mile radius for the preview ring (manual miles or listing ring). */
  radiusMiles?: number;
  /** Badge on the map, e.g. "½ Mile" or "1.0 mi". */
  radiusLabel?: string;
  /** Preview height in px (default 360). */
  height?: number;
  /** Force OpenStreetMap embed (no Google API). */
  useOsm?: boolean;
};

function RadiusRingOverlay({ miles, label }: { miles: number; label: string }) {
  const r = ringVisualPercentFromMiles(miles);
  return (
    <>
      <svg className="cp-map-radius-overlay" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="rgba(50,213,131,0.14)" stroke="#32d583" strokeWidth="0.65" strokeOpacity="0.9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(30,144,255,0.55)" strokeWidth="0.35" strokeDasharray="2 2.5" />
        <circle cx="50" cy="50" r="2.2" fill="#1e90ff" stroke="#fff" strokeWidth="0.45" />
      </svg>
      <div className="cp-map-radius-badge">
        <span className="cp-map-radius-badge-dot" aria-hidden />
        {label}
      </div>
    </>
  );
}

function MapPlaceholder({ lat, lng, radius, radiusMiles, radiusLabel, height = 360 }: Props) {
  const miles =
    radiusMiles != null && Number.isFinite(radiusMiles) && radiusMiles > 0
      ? radiusMiles
      : getRadiusMeters(radius) / 1609.34;
  const delta = osmBboxDeltaMiles(miles);
  const frameSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta * 0.75}%2C${lng + delta}%2C${lat + delta * 0.75}&layer=mapnik&marker=${lat}%2C${lng}`;
  const label = radiusLabel?.trim() || `${miles} mi radius`;

  return (
    <div className="gradient-border cp-map-with-radius" style={{ height, minHeight: height }}>
      <iframe title="OpenStreetMap preview" src={frameSrc} className="cp-map-with-radius__frame" referrerPolicy="no-referrer-when-downgrade" />
      <RadiusRingOverlay miles={miles} label={label} />
    </div>
  );
}

function ListingMapLoaded(props: Props) {
  const { lat, lng, radius, radiusMiles, radiusLabel, height = 360 } = props;
  const [authFailed, setAuthFailed] = useState(false);
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: googleMapsApiKey()!,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  useEffect(() => {
    const prev = window.gm_authFailure;
    window.gm_authFailure = () => setAuthFailed(true);
    return () => {
      window.gm_authFailure = prev;
    };
  }, []);

  useEffect(() => {
    if (loadError) setAuthFailed(true);
  }, [loadError]);

  if (loadError || authFailed) {
    return <MapPlaceholder {...props} />;
  }

  if (!isLoaded) {
    return (
      <div
        className="gradient-border"
        style={{ height, minHeight: height, display: "grid", placeItems: "center", color: "var(--muted)" }}
      >
        Loading map…
      </div>
    );
  }

  const center = { lat, lng };
  const meters = getRadiusMeters(radius, radiusMiles);
  const miles =
    radiusMiles != null && Number.isFinite(radiusMiles) && radiusMiles > 0
      ? radiusMiles
      : meters / 1609.34;
  const label = radiusLabel?.trim() || `${miles} mi radius`;

  return (
    <div className="gradient-border cp-map-with-radius" style={{ height, minHeight: height, borderRadius: "var(--radius-lg)" }}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={getMapZoomForRadiusMeters(meters)}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          zoomControl: true,
        }}
      >
        <Marker position={center} title="Subject listing" />
        <Circle
          center={center}
          radius={meters}
          options={{
            strokeColor: "#1e90ff",
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: "#32d583",
            fillOpacity: 0.12,
          }}
        />
      </GoogleMap>
      <div className="cp-map-radius-badge cp-map-radius-badge--on-gmaps">
        <span className="cp-map-radius-badge-dot" aria-hidden />
        {label}
      </div>
    </div>
  );
}

export function ListingMap({ useOsm, ...props }: Props) {
  if (useOsm || !googleMapsApiKey()) {
    return <MapPlaceholder {...props} />;
  }
  return <ListingMapLoaded {...props} />;
}
