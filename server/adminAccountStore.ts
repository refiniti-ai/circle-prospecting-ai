import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFirestoreDb } from "./firebaseAdmin.js";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, "data", "admin-credentials.json");

const DOC_PATH = process.env.FIREBASE_ADMIN_CREDENTIALS_DOC?.trim() || "admin_credentials/main";

type Stored = {
  username: string;
  passwordHash: string;
  salt: string;
  updatedAt: string;
};

function ensureFile() {
  const dir = path.dirname(DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function getStoredAdminAuth(): Promise<Stored | null> {
  ensureFile();
  if (fs.existsSync(DATA)) {
    try {
      const raw = JSON.parse(fs.readFileSync(DATA, "utf8")) as Partial<Stored>;
      if (raw.username && raw.passwordHash && raw.salt) {
        return {
          username: String(raw.username).trim(),
          passwordHash: String(raw.passwordHash),
          salt: String(raw.salt),
          updatedAt: String(raw.updatedAt || ""),
        };
      }
    } catch {
      /* ignore */
    }
  }

  const db = getFirestoreDb();
  if (db) {
    try {
      const [col, id] = DOC_PATH.includes("/") ? DOC_PATH.split("/") : ["admin_credentials", "main"];
      const snap = await db.collection(col).doc(id).get();
      if (!snap.exists) return null;
      const d = snap.data() as Partial<Stored>;
      if (d?.username && d?.passwordHash && d?.salt) {
        return {
          username: String(d.username).trim(),
          passwordHash: String(d.passwordHash),
          salt: String(d.salt),
          updatedAt: String(d.updatedAt || ""),
        };
      }
    } catch (err) {
      console.error("[adminAccountStore] Firestore read failed", err);
    }
  }

  return null;
}

export async function upsertStoredAdminAuth(username: string, passwordHash: string, salt: string): Promise<void> {
  const u = username.trim();
  const updatedAt = new Date().toISOString();
  const rec: Stored = { username: u, passwordHash, salt, updatedAt };

  ensureFile();
  fs.writeFileSync(DATA, JSON.stringify(rec, null, 2), "utf8");

  const db = getFirestoreDb();
  if (db) {
    try {
      const [col, id] = DOC_PATH.includes("/") ? DOC_PATH.split("/") : ["admin_credentials", "main"];
      await db.collection(col).doc(id).set(rec, { merge: true });
    } catch (err) {
      console.error("[adminAccountStore] Firestore write failed; file saved", err);
    }
  }
}
