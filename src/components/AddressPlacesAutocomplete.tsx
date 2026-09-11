import { useEffect, useRef, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_LOADER_ID, GOOGLE_MAPS_LIBRARIES, googleMapsApiKey } from "../lib/googleMapsConfig";
import { parseGooglePlace, type ParsedPlaceAddress } from "../lib/placesAddress";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (place: ParsedPlaceAddress) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

function AddressPlacesLoaded({
  id = "listing-address-autocomplete",
  value,
  onChange,
  onPlaceSelected,
  placeholder,
  disabled,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!inputRef.current || disabled) return;
    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "us" },
      fields: ["address_components", "geometry", "formatted_address", "name"],
      types: ["address"],
    });
    autocompleteRef.current = ac;
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const parsed = parseGooglePlace(place);
      if (!parsed) return;
      onChange(parsed.streetLine || parsed.formattedAddress);
      onPlaceSelected(parsed);
    });
    return () => {
      google.maps.event.removeListener(listener);
      autocompleteRef.current = null;
    };
  }, [disabled, onChange, onPlaceSelected]);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      className={className ?? "premium-input"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "Start typing a U.S. street address…"}
      autoComplete="off"
      disabled={disabled}
    />
  );
}

export function AddressPlacesAutocomplete(props: Props) {
  const key = googleMapsApiKey();
  const [fallback, setFallback] = useState(props.value);

  useEffect(() => {
    setFallback(props.value);
  }, [props.value]);

  if (!key) {
    return (
      <>
        <input
          id={props.id}
          type="text"
          className={props.className ?? "premium-input"}
          value={fallback}
          onChange={(e) => {
            setFallback(e.target.value);
            props.onChange(e.target.value);
          }}
          placeholder={props.placeholder ?? "Street address"}
          disabled={props.disabled}
        />
        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.8rem" }}>
          Add <code className="cp-kbd">VITE_GOOGLE_MAPS_API_KEY</code> with Places API enabled for address suggestions.
        </p>
      </>
    );
  }

  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: key,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  if (loadError) {
    return (
      <input
        id={props.id}
        type="text"
        className={props.className ?? "premium-input"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder ?? "Street address"}
        disabled={props.disabled}
      />
    );
  }

  if (!isLoaded) {
    return (
      <input
        id={props.id}
        type="text"
        className={props.className ?? "premium-input"}
        value={props.value}
        disabled
        placeholder="Loading address search…"
      />
    );
  }

  return <AddressPlacesLoaded {...props} />;
}
