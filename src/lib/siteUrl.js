/** Canonical production site (Firebase Hosting + custom domain). */
export const PRODUCTION_SITE_ORIGIN = "https://circleprospecting.ai";
export const PRODUCTION_SITE_HOSTS = [
    "circleprospecting.ai",
    "www.circleprospecting.ai",
    "circle-prospecting-ai.web.app",
    "circle-prospecting-ai.firebaseapp.com",
];
export function isProductionSiteHost(hostname) {
    return PRODUCTION_SITE_HOSTS.includes(hostname);
}
export function productionSiteBase() {
    if (typeof process !== "undefined" && process.env?.APP_PUBLIC_URL?.trim()) {
        return process.env.APP_PUBLIC_URL.trim().replace(/\/$/, "");
    }
    return PRODUCTION_SITE_ORIGIN;
}
