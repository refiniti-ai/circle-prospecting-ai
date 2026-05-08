import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { getFirestoreDb } from "./firebaseAdmin.js";

export type PasswordResetKind = "client" | "admin";

export type PasswordResetPayload = {
  kind: PasswordResetKind;
  /** Client account email, or the admin notification email used to request reset. */
  email: string;
};

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, "data", "password-reset-tokens.json");

const COLLECTION = process.env.FIREBASE_PASSWORD_RESET_COLLECTION?.trim() || "password_reset_tokens";

const TTL_MS = 60 * 60 * 1000;

type FileShape = {
  tokens: Record<string, { kind: PasswordResetKind; email: string; expiresAt: string }>;
};

function ensureFile() {
  const dir = path.dirname(DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA)) {
    fs.writeFileSync(DATA, JSON.stringify({ tokens: {} } satisfies FileShape, null, 2), "utf8");
  }
}

function readFile(): FileShape {
  ensureFile();
  const raw = JSON.parse(fs.readFileSync(DATA, "utf8")) as FileShape;
  if (!raw.tokens || typeof raw.tokens !== "object") raw.tokens = {};
  return raw;
}

function writeFile(data: FileShape) {
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2), "utf8");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createPasswordResetToken(kind: PasswordResetKind, email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const e = normalizeEmail(email);
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  const record = { kind, email: e, expiresAt };

  const log = readFile();
  log.tokens[token] = record;
  pruneExpiredFile(log);
  writeFile(log);

  const db = getFirestoreDb();
  if (db) {
    try {
      await db.collection(COLLECTION).doc(token).set(record);
    } catch (err) {
      console.error("[passwordResetStore] Firestore write failed; file saved", err);
    }
  }

  return token;
}

function pruneExpiredFile(log: FileShape) {
  const now = Date.now();
  for (const [k, v] of Object.entries(log.tokens)) {
    if (new Date(v.expiresAt).getTime() < now) delete log.tokens[k];
  }
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  const log = readFile();
  delete log.tokens[token];
  writeFile(log);
  const db = getFirestoreDb();
  if (db) {
    try {
      await db.collection(COLLECTION).doc(token).delete();
    } catch (err) {
      console.error("[passwordResetStore] Firestore delete failed", err);
    }
  }
}

/** Returns payload and deletes token (single use). Null if invalid or expired. */
export async function takePasswordResetToken(token: string): Promise<PasswordResetPayload | null> {
  if (!token || token.length < 16) return null;
  const now = Date.now();

  let row: { kind: PasswordResetKind; email: string; expiresAt: string } | null = null;

  const log = readFile();
  pruneExpiredFile(log);
  const fromFile = log.tokens[token];
  if (fromFile && new Date(fromFile.expiresAt).getTime() >= now) {
    row = fromFile;
    delete log.tokens[token];
    writeFile(log);
  }

  const db = getFirestoreDb();
  if (db) {
    try {
      const ref = db.collection(COLLECTION).doc(token);
      const snap = await ref.get();
      if (snap.exists) {
        const d = snap.data() as { kind?: string; email?: string; expiresAt?: string };
        const exp = d?.expiresAt ? new Date(d.expiresAt).getTime() : 0;
        const valid = Boolean(d?.kind && d?.email && exp >= now);
        if (valid && !row) {
          row = {
            kind: d.kind as PasswordResetKind,
            email: normalizeEmail(String(d.email)),
            expiresAt: String(d.expiresAt),
          };
        }
        await ref.delete();
      }
    } catch (err) {
      console.error("[passwordResetStore] Firestore take failed", err);
    }
  }

  if (!row || new Date(row.expiresAt).getTime() < now) return null;
  return { kind: row.kind, email: row.email };
}
