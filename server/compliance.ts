import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type CompliancePolicy = {
  id: string;
  region: string;
  channel: "voice" | "sms" | "email";
  quietHoursStart: string;
  quietHoursEnd: string;
  requiresConsent: boolean;
  dncEnabled: boolean;
  scriptVersion: string;
  updatedAt: string;
};

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, "data", "platform", "compliance.json");

type ComplianceDb = { policies: CompliancePolicy[]; updatedAt: string };

function ensureFile() {
  const dir = path.dirname(DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA)) {
    const seed: ComplianceDb = {
      policies: [
        {
          id: "us-general-voice",
          region: "US",
          channel: "voice",
          quietHoursStart: "08:00",
          quietHoursEnd: "20:00",
          requiresConsent: true,
          dncEnabled: true,
          scriptVersion: "v1",
          updatedAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(DATA, JSON.stringify(seed, null, 2), "utf8");
  }
}

function readDb(): ComplianceDb {
  ensureFile();
  const db = JSON.parse(fs.readFileSync(DATA, "utf8")) as ComplianceDb;
  if (!Array.isArray(db.policies)) db.policies = [];
  return db;
}

function writeDb(db: ComplianceDb) {
  db.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA, JSON.stringify(db, null, 2), "utf8");
}

export function listCompliancePolicies() {
  return readDb().policies;
}

export function upsertCompliancePolicy(input: Omit<CompliancePolicy, "updatedAt">) {
  const db = readDb();
  const next: CompliancePolicy = { ...input, updatedAt: new Date().toISOString() };
  const idx = db.policies.findIndex((p) => p.id === next.id);
  if (idx >= 0) db.policies[idx] = next;
  else db.policies.unshift(next);
  writeDb(db);
  return next;
}

export function evaluateCompliance(args: {
  policyId: string;
  nowIso?: string;
  hasConsent: boolean;
  inDnc: boolean;
}) {
  const policy = listCompliancePolicies().find((p) => p.id === args.policyId);
  if (!policy) return { allowed: false, reason: "unknown_policy" as const };

  if (policy.requiresConsent && !args.hasConsent) {
    return { allowed: false, reason: "consent_required" as const };
  }
  if (policy.dncEnabled && args.inDnc) {
    return { allowed: false, reason: "dnc_blocked" as const };
  }

  const iso = args.nowIso || new Date().toISOString();
  const localHour = Number.parseInt(iso.slice(11, 13), 10);
  const startHour = Number.parseInt(policy.quietHoursStart.slice(0, 2), 10);
  const endHour = Number.parseInt(policy.quietHoursEnd.slice(0, 2), 10);
  const within = localHour >= startHour && localHour < endHour;
  if (!within) return { allowed: false, reason: "quiet_hours" as const };

  return { allowed: true, reason: "allowed" as const, scriptVersion: policy.scriptVersion };
}
