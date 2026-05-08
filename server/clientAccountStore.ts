import fs from "node:fs";
import path from "node:path";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { getFirestoreDb } from "./firebaseAdmin.js";

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, "data", "client-accounts.json");

const COLLECTION = process.env.FIREBASE_CLIENT_ACCOUNTS_COLLECTION?.trim() || "client_accounts";

export type ClientAccountRecord = {
  email: string;
  passwordHash: string;
  salt: string;
  updatedAt: string;
};

type FileShape = {
  accounts: Record<string, { passwordHash: string; salt: string; updatedAt: string }>;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function ensureFile() {
  const dir = path.dirname(DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA)) {
    const empty: FileShape = { accounts: {} };
    fs.writeFileSync(DATA, JSON.stringify(empty, null, 2), "utf8");
  }
}

function readFile(): FileShape {
  ensureFile();
  const raw = JSON.parse(fs.readFileSync(DATA, "utf8")) as FileShape;
  if (!raw.accounts || typeof raw.accounts !== "object") raw.accounts = {};
  return raw;
}

function writeFile(data: FileShape) {
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2), "utf8");
}

export async function hashPassword(plain: string): Promise<{ passwordHash: string; salt: string }> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
  return { passwordHash: derived.toString("base64"), salt: salt.toString("base64") };
}

export async function verifyPassword(plain: string, saltB64: string, hashB64: string): Promise<boolean> {
  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const derived = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export async function getClientAccount(email: string): Promise<ClientAccountRecord | null> {
  const e = normalizeEmail(email);
  if (!e.includes("@")) return null;

  const log = readFile();
  const fromFile = log.accounts[e];
  if (fromFile?.passwordHash && fromFile?.salt) {
    return { email: e, passwordHash: fromFile.passwordHash, salt: fromFile.salt, updatedAt: fromFile.updatedAt };
  }

  const db = getFirestoreDb();
  if (db) {
    try {
      const snap = await db.collection(COLLECTION).doc(e).get();
      if (!snap.exists) return null;
      const d = snap.data() as { passwordHash?: string; salt?: string; updatedAt?: string };
      if (!d?.passwordHash || !d?.salt) return null;
      return {
        email: e,
        passwordHash: d.passwordHash,
        salt: d.salt,
        updatedAt: d.updatedAt || new Date().toISOString(),
      };
    } catch (err) {
      console.error("[clientAccountStore] Firestore read failed", err);
    }
  }

  return null;
}

export async function upsertClientPassword(email: string, passwordHash: string, salt: string): Promise<void> {
  const e = normalizeEmail(email);
  if (!e.includes("@")) throw new Error("invalid email");

  const updatedAt = new Date().toISOString();
  const log = readFile();
  log.accounts[e] = { passwordHash, salt, updatedAt };
  writeFile(log);

  const db = getFirestoreDb();
  if (db) {
    try {
      await db.collection(COLLECTION).doc(e).set({ email: e, passwordHash, salt, updatedAt }, { merge: true });
    } catch (err) {
      console.error("[clientAccountStore] Firestore write failed; local JSON saved", err);
    }
  }
}
