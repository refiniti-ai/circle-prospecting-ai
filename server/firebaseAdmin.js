import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
function parseServiceAccountFromEnv() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed.project_id || !parsed.client_email || !parsed.private_key)
            return null;
        return {
            projectId: parsed.project_id,
            clientEmail: parsed.client_email,
            privateKey: parsed.private_key.replace(/\\n/g, "\n"),
        };
    }
    catch {
        return null;
    }
}
function useApplicationDefaultCredentials() {
    if (process.env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS?.trim() === "1")
        return true;
    if (process.env.FIREBASE_USE_ADC?.trim() === "1")
        return true;
    // Managed GCP runtimes (no service-account JSON env needed)
    if (process.env.K_SERVICE)
        return true; // Cloud Run / Cloud Functions (many)
    if (process.env.FUNCTION_TARGET)
        return true;
    if (process.env.GAE_SERVICE)
        return true;
    return false;
}
function parseServiceAccountFromFile() {
    const p = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
    if (!p)
        return null;
    try {
        const text = readFileSync(p, "utf8");
        const parsed = JSON.parse(text);
        if (!parsed.project_id || !parsed.client_email || !parsed.private_key)
            return null;
        return {
            projectId: parsed.project_id,
            clientEmail: parsed.client_email,
            privateKey: parsed.private_key.replace(/\\n/g, "\n"),
        };
    }
    catch {
        return null;
    }
}
/** Firestore is optional. When credentials are absent, callers should gracefully fall back to local storage. */
export function getFirestoreDb() {
    if (getApps().length === 0) {
        const svc = parseServiceAccountFromEnv() ?? parseServiceAccountFromFile();
        if (svc) {
            initializeApp({ credential: cert(svc), projectId: svc.projectId });
        }
        else {
            const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
            if (!projectId || !useApplicationDefaultCredentials())
                return null;
            initializeApp({ credential: applicationDefault(), projectId });
        }
    }
    return getFirestore();
}
