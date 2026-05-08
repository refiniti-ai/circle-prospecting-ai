/**
 * Quick sanity check for client demos: Firestore Admin env, API health, env placeholders.
 * Run: npm run workflow:check   (API need not be running for Firestore-only checks)
 */
import "dotenv/config";
import { getFirestoreDb } from "../server/firebaseAdmin.js";
const port = process.env.API_PORT || "8787";
async function pingHealth() {
    try {
        const r = await fetch(`http://127.0.0.1:${port}/api/health`);
        const body = (await r.json());
        return { ok: r.ok, body };
    }
    catch (e) {
        return { ok: false, err: e instanceof Error ? e.message : String(e) };
    }
}
async function main() {
    console.log("Circle Prospecting AI — workflow / Firestore check\n");
    const hasJson = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
    const hasPath = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim());
    const adc = process.env.FIREBASE_USE_ADC === "1" ||
        process.env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS === "1";
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    console.log("Credential hints:");
    console.log(`  FIREBASE_SERVICE_ACCOUNT_JSON: ${hasJson ? "set" : "not set"}`);
    console.log(`  FIREBASE_SERVICE_ACCOUNT_PATH: ${hasPath ? "set" : "not set"}`);
    console.log(`  FIREBASE_PROJECT_ID + ADC: ${projectId ? `projectId=${projectId}` : "no projectId"} ${adc ? "+ FIREBASE_USE_ADC=1" : ""}`);
    console.log("");
    const db = getFirestoreDb();
    if (db) {
        console.log("Firestore Admin: CONNECTED (orders + purchase_notifications can sync to Firestore)\n");
    }
    else {
        console.log("Firestore Admin: NOT CONNECTED — API still runs; orders & Stripe purchase log use local JSON under server/data/\n");
    }
    const h = await pingHealth();
    if (h.ok && h.body && typeof h.body === "object" && h.body !== null && "status" in h.body) {
        console.log(`GET /api/health (port ${port}):`, JSON.stringify(h.body));
    }
    else {
        console.log(`GET /api/health: not reachable on port ${port} (start API: npm run dev or npm run dev:api)`);
        if (h.err)
            console.log(`  (${h.err})`);
    }
    const pubBase = (process.env.WORKFLOW_PUBLIC_BASE || "https://circle-prospecting-ai.web.app").replace(/\/$/, "");
    console.log("\n--- Production API (Hosting → Cloud Run) ---");
    console.log(`  Base: ${pubBase}`);
    try {
        const pr = await fetch(`${pubBase}/api/health`);
        const ct = pr.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
            console.log(`  GET /api/health: HTTP ${pr.status} — expected JSON, got ${ct || "unknown"} (rewrite or deploy issue)`);
        }
        else {
            const body = (await pr.json());
            console.log(`  GET /api/health: HTTP ${pr.status}`, JSON.stringify(body));
        }
    }
    catch (e) {
        console.log(`  GET /api/health: failed (${e instanceof Error ? e.message : String(e)})`);
    }
    try {
        const ar = await fetch(`${pubBase}/api/auth/admin-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ username: "workflow-probe", password: "workflow-probe" }),
        });
        const act = ar.headers.get("content-type") || "";
        const isJson = act.includes("application/json");
        console.log(`  POST /api/auth/admin-login (probe): HTTP ${ar.status}, content-type=${isJson ? "application/json ✓" : act || "unknown ✗"}`);
        if (!isJson) {
            console.log("    Fix: redeploy Cloud Run with latest server; confirm firebase.json /api/** → Run rewrite.");
        }
    }
    catch (e) {
        console.log(`  POST /api/auth/admin-login: failed (${e instanceof Error ? e.message : String(e)})`);
    }
    console.log("\n--- Manual end-to-end (test Stripe + dashboard) ---");
    console.log("1. npm run dev");
    console.log("2. Set APP_PUBLIC_URL to match the browser origin (e.g. http://localhost:5173)");
    console.log("3. Open /buy-leads — lead count + checkout should hit /api (Vite proxies in dev)");
    console.log("4. Stripe test card: 4242 4242 4242 4242, any future expiry, any CVC");
    console.log("5. After payment: /order/success?session_id=… → sign in; /login Client uses email+phone (session in localStorage)");
    console.log("6. Admin: /login?tab=admin — username/password (default dev: admin / changeme); server needs ADMIN_* env on Cloud Run");
    console.log("7. Firestore write test: npm run firestore:smoke");
    console.log("8. Skip production probe: WORKFLOW_PUBLIC_BASE= npm run workflow:check\n");
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
