import { useEffect, useRef, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import {
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_LOADER_ID,
  googleMapsApiKey,
} from "../lib/googleMapsConfig";
import { isGoogleMapsAuthFailed, markGoogleMapsAuthFailed } from "../lib/googleMapsAuth";
import { parseGooglePlace, type ParsedPlaceAddress } from "../lib/placesAddress";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: ParsedPlaceAddress) => void;
  onEnter?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

function AddressAutocompletePlain({
  id,
  value,
  onChange,
  onEnter,
  disabled,
  placeholder,
  className,
}: Omit<Props, "onPlaceSelect">) {
  return (
    <input
      id={id}
      type="text"
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onEnter?.();
      }}
      disabled={disabled}
      autoComplete="street-address"
      placeholder={placeholder}
      aria-label="Property address search"
    />
  );
}

function AddressAutocompleteWithMaps({
  id = "buy-listing-address-search",
  value,
  onChange,
  onPlaceSelect,
  onEnter,
  disabled,
  placeholder = "Start typing a property address…",
  className = "premium-input",
  apiKey,
}: Props & { apiKey: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [authFailed, setAuthFailed] = useState(false);
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  useEffect(() => {
    const prev = window.gm_authFailure;
    window.gm_authFailure = () => {
      markGoogleMapsAuthFailed();
      setAuthFailed(true);
    };
    return () => {
      window.gm_authFailure = prev;
    };
  }, []);

  useEffect(() => {
    if (loadError) {
      markGoogleMapsAuthFailed();
      setAuthFailed(true);
    }
  }, [loadError]);

  useEffect(() => {
    if (!isLoaded || authFailed || loadError || isGoogleMapsAuthFailed() || !inputRef.current || disabled) return;
    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "us" },
      fields: ["address_components", "geometry", "formatted_address", "name"],
      types: ["address"],
    });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const parsed = parseGooglePlace(place);
      if (parsed) {
        onPlaceSelect(parsed);
      } else if (place.formatted_address) {
        onChange(place.formatted_address);
      }
    });
    return () => {
      google.maps.event.clearInstanceListeners(ac);
    };
  }, [isLoaded, authFailed, loadError, disabled, onChange, onPlaceSelect]);

  if (authFailed || loadError || isGoogleMapsAuthFailed()) {
    return <AddressAutocompletePlain {...{ id, value, onChange, onEnter, disabled, placeholder, className }} />;
  }

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onEnter?.();
      }}
      disabled={disabled}
      autoComplete="off"
      placeholder={placeholder}
      aria-label="Property address search"
    />
  );
}

export function AddressAutocompleteInput(props: Props) {
  const key = googleMapsApiKey();
  if (!key || isGoogleMapsAuthFailed()) {
    return <AddressAutocompletePlain {...props} />;
  }
  return <AddressAutocompleteWithMaps {...props} apiKey={key} />;
}
