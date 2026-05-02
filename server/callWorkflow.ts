import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type CallRequest = {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  listingId?: string;
  preferredTime?: string;
  status: "queued" | "in_progress" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
};

export type CallTranscript = {
  id: string;
  callRequestId: string;
  tenantId: string;
  scriptTemplate: string;
  transcript: string;
  summary: string;
  outcomeTag: "interested" | "follow_up" | "not_interested" | "wrong_number";
  score: number;
  createdAt: string;
};

export type BookingRequest = {
  id: string;
  tenantId: string;
  leadName: string;
  leadPhone: string;
  leadEmail?: string;
  provider: "google" | "outlook";
  requestedSlotIso: string;
  status: "requested" | "booked" | "failed";
  createdAt: string;
  updatedAt: string;
};

type CallDb = {
  callRequests: CallRequest[];
  transcripts: CallTranscript[];
  bookingRequests: BookingRequest[];
  updatedAt: string;
};

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, "data", "platform", "call-workflow.json");

function ensureFile() {
  const dir = path.dirname(DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA)) {
    const empty: CallDb = { callRequests: [], transcripts: [], bookingRequests: [], updatedAt: new Date().toISOString() };
    fs.writeFileSync(DATA, JSON.stringify(empty, null, 2), "utf8");
  }
}

function readDb(): CallDb {
  ensureFile();
  const db = JSON.parse(fs.readFileSync(DATA, "utf8")) as CallDb;
  if (!Array.isArray(db.callRequests)) db.callRequests = [];
  if (!Array.isArray(db.transcripts)) db.transcripts = [];
  if (!Array.isArray(db.bookingRequests)) db.bookingRequests = [];
  return db;
}

function writeDb(db: CallDb) {
  db.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA, JSON.stringify(db, null, 2), "utf8");
}

export function createCallRequest(input: Omit<CallRequest, "id" | "status" | "createdAt" | "updatedAt">) {
  const db = readDb();
  const now = new Date().toISOString();
  const req: CallRequest = {
    id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  db.callRequests.unshift(req);
  writeDb(db);
  return req;
}

export function updateCallRequestStatus(callId: string, status: CallRequest["status"]) {
  const db = readDb();
  const row = db.callRequests.find((r) => r.id === callId);
  if (!row) return null;
  row.status = status;
  row.updatedAt = new Date().toISOString();
  writeDb(db);
  return row;
}

function scoreTranscript(transcript: string) {
  const t = transcript.toLowerCase();
  let score = 45;
  if (t.includes("interested") || t.includes("yes")) score += 25;
  if (t.includes("appointment") || t.includes("book")) score += 20;
  if (t.includes("not interested") || t.includes("stop")) score -= 30;
  return Math.max(0, Math.min(100, score));
}

function outcomeFromScore(score: number): CallTranscript["outcomeTag"] {
  if (score >= 75) return "interested";
  if (score >= 50) return "follow_up";
  if (score >= 20) return "not_interested";
  return "wrong_number";
}

export function storeCallTranscript(input: {
  callRequestId: string;
  tenantId: string;
  scriptTemplate: string;
  transcript: string;
}) {
  const db = readDb();
  const score = scoreTranscript(input.transcript);
  const outcomeTag = outcomeFromScore(score);
  const row: CallTranscript = {
    id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    callRequestId: input.callRequestId,
    tenantId: input.tenantId,
    scriptTemplate: input.scriptTemplate,
    transcript: input.transcript,
    summary: input.transcript.slice(0, 220),
    outcomeTag,
    score,
    createdAt: new Date().toISOString(),
  };
  db.transcripts.unshift(row);
  writeDb(db);
  return row;
}

export function createBookingRequest(input: Omit<BookingRequest, "id" | "status" | "createdAt" | "updatedAt">) {
  const db = readDb();
  const now = new Date().toISOString();
  const row: BookingRequest = {
    id: `book_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: "requested",
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  db.bookingRequests.unshift(row);
  writeDb(db);
  return row;
}

export function confirmBookingRequest(id: string) {
  const db = readDb();
  const row = db.bookingRequests.find((r) => r.id === id);
  if (!row) return null;
  row.status = "booked";
  row.updatedAt = new Date().toISOString();
  writeDb(db);
  return row;
}

export function getCallWorkflowSummary(tenantId: string) {
  const db = readDb();
  const calls = db.callRequests.filter((r) => r.tenantId === tenantId);
  const transcripts = db.transcripts.filter((r) => r.tenantId === tenantId);
  const bookings = db.bookingRequests.filter((r) => r.tenantId === tenantId);
  const avgScore = transcripts.length ? Math.round((transcripts.reduce((a, b) => a + b.score, 0) / transcripts.length) * 10) / 10 : 0;
  return {
    calls: {
      total: calls.length,
      queued: calls.filter((c) => c.status === "queued").length,
      completed: calls.filter((c) => c.status === "completed").length,
    },
    transcripts: {
      total: transcripts.length,
      avgScore,
      topOutcomes: {
        interested: transcripts.filter((t) => t.outcomeTag === "interested").length,
        follow_up: transcripts.filter((t) => t.outcomeTag === "follow_up").length,
      },
      latest: transcripts.slice(0, 15),
    },
    bookings: {
      total: bookings.length,
      requested: bookings.filter((b) => b.status === "requested").length,
      booked: bookings.filter((b) => b.status === "booked").length,
    },
    updatedAt: db.updatedAt,
  };
}
