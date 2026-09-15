/**
 * Staging-only CRM switch. Live Cloud Run leaves this unset and keeps HighLevel.
 * App Runner: CIRCLE_CRM_MODE=aws
 */
export function isAwsCrmMode(): boolean {
  const v = (process.env.CIRCLE_CRM_MODE || "").trim().toLowerCase();
  return v === "aws" || v === "circle" || v === "1" || v === "true";
}

export function crmModeLabel(): "aws" | "ghl" {
  return isAwsCrmMode() ? "aws" : "ghl";
}
