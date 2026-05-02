/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  /** Set to 1 to show /admin/leads in production builds (dev always shows) */
  readonly VITE_SHOW_ADMIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
