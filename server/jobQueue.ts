import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type QueueJob = {
  id: string;
  tenantId: string;
  type: "call_request" | "ghl_sync" | "email" | "score_refresh";
  payload: Record<string, string>;
  status: "queued" | "processing" | "done" | "failed";
  attempts: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
};

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, "data", "platform", "queue.json");

type QueueDb = { jobs: QueueJob[]; updatedAt: string };

function ensureFile() {
  const dir = path.dirname(DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA)) {
    fs.writeFileSync(DATA, JSON.stringify({ jobs: [], updatedAt: new Date().toISOString() }, null, 2), "utf8");
  }
}

function readDb(): QueueDb {
  ensureFile();
  const db = JSON.parse(fs.readFileSync(DATA, "utf8")) as QueueDb;
  if (!Array.isArray(db.jobs)) db.jobs = [];
  return db;
}

function writeDb(db: QueueDb) {
  db.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA, JSON.stringify(db, null, 2), "utf8");
}

export function enqueueJob(input: Pick<QueueJob, "tenantId" | "type" | "payload">) {
  const db = readDb();
  const now = new Date().toISOString();
  const job: QueueJob = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId,
    type: input.type,
    payload: input.payload,
    status: "queued",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.jobs.push(job);
  writeDb(db);
  return job;
}

export function processOneQueuedJob() {
  const db = readDb();
  const job = db.jobs.find((j) => j.status === "queued");
  if (!job) return null;

  job.status = "processing";
  job.attempts += 1;
  job.updatedAt = new Date().toISOString();

  try {
    if (job.type === "call_request" && !job.payload.phone) {
      throw new Error("missing phone");
    }
    job.status = "done";
    job.error = undefined;
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "unknown";
  }

  job.updatedAt = new Date().toISOString();
  writeDb(db);
  return job;
}

export function getQueueStatus(tenantId?: string) {
  const db = readDb();
  const jobs = tenantId ? db.jobs.filter((j) => j.tenantId === tenantId) : db.jobs;
  return {
    queued: jobs.filter((j) => j.status === "queued").length,
    processing: jobs.filter((j) => j.status === "processing").length,
    done: jobs.filter((j) => j.status === "done").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    recent: jobs.slice(-30).reverse(),
    updatedAt: db.updatedAt,
  };
}
