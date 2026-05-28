/** Set before any Google Maps script loads so we can fall back without Places autocomplete. */
let authFailed = false;

export function initGoogleMapsAuthFailureHook() {
  if (typeof window === "undefined") return;
  const prev = window.gm_authFailure;
  window.gm_authFailure = () => {
    authFailed = true;
    prev?.();
  };
}

export function isGoogleMapsAuthFailed() {
  return authFailed;
}

export function markGoogleMapsAuthFailed() {
  authFailed = true;
}
