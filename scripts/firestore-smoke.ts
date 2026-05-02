import "dotenv/config";
import { getFirestoreDb } from "../server/firebaseAdmin.js";

const COL = "_smoke";
const DOC = "api-smoke";

async function main() {
  const db = getFirestoreDb();
  if (!db) {
    console.error(`Firestore Admin is not initialized.
Add one of:
  - FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON (local / most servers)
  - FIREBASE_PROJECT_ID + FIREBASE_USE_ADC=1 + Application Default Credentials (gcloudADC / GCP runtime)
Smoke write target: "${COL}/${DOC}"`);
    process.exit(2);
    return;
  }
  const ref = db.collection(COL).doc(DOC);
  const payload = { at: new Date().toISOString(), source: "npm run firestore:smoke" };
  await ref.set(payload, { merge: true });
  const snap = await ref.get();
  if (!snap.exists) throw new Error("read after write returned no document");
  console.log(JSON.stringify({ ok: true, path: `${COL}/${DOC}`, data: snap.data() }, null, 2));
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
