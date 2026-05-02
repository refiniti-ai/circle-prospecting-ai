import { useMemo, useState } from "react";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { fetchWorkflowSummary, requestBooking, requestDemoCall, uploadCallTranscript, type PlatformActorHeaders } from "../lib/platformApi";

const actor: PlatformActorHeaders = {
  tenantId: "default",
  userId: "web-admin",
  role: "admin",
};

export function PlatformOpsPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [summary, setSummary] = useState<null | any>(null);
  const [callId, setCallId] = useState("");

  const nowIsoDefault = useMemo(() => new Date(Date.now() + 3600_000).toISOString().slice(0, 16), []);

  async function loadSummary() {
    setLoading(true);
    setMessage("");
    try {
      const data = await fetchWorkflowSummary(actor);
      setSummary(data);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load summary");
    } finally {
      setLoading(false);
    }
  }

  async function onDemoCall(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMessage("");
    try {
      const res = await requestDemoCall(actor, {
        name: String(fd.get("name") || ""),
        phone: String(fd.get("phone") || ""),
        email: String(fd.get("email") || "") || undefined,
        listingId: String(fd.get("listingId") || "") || undefined,
        preferredTime: String(fd.get("preferredTime") || "") || undefined,
      });
      setCallId(res?.call?.id || "");
      setMessage(`Demo call requested: ${res?.call?.id || "created"}`);
      await loadSummary();
      e.currentTarget.reset();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function onTranscript(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMessage("");
    try {
      const res = await uploadCallTranscript(actor, {
        callRequestId: String(fd.get("callRequestId") || ""),
        scriptTemplate: String(fd.get("scriptTemplate") || ""),
        transcript: String(fd.get("transcript") || ""),
      });
      setMessage(`Transcript stored. Score: ${res?.transcript?.score ?? "n/a"}`);
      await loadSummary();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Transcript failed");
    }
  }

  async function onBooking(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMessage("");
    try {
      const res = await requestBooking(actor, {
        leadName: String(fd.get("leadName") || ""),
        leadPhone: String(fd.get("leadPhone") || ""),
        leadEmail: String(fd.get("leadEmail") || "") || undefined,
        provider: String(fd.get("provider") || "google") as "google" | "outlook",
        requestedSlotIso: new Date(String(fd.get("requestedSlotIso") || "")).toISOString(),
      });
      setMessage(`Booking requested: ${res?.booking?.id || "created"}`);
      await loadSummary();
      e.currentTarget.reset();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Booking failed");
    }
  }

  return (
    <MarketingPageShell
      title="Operations | Circle Prospecting AI"
      description="Manage demo calls, AI transcripts, lead scoring outcomes, and booking requests."
      path="/operations"
      heroTitle="Operations control"
      heroLead="Run the full demo-call and booking workflow with score and outcome tracking."
    >
      <section className="section home-section">
        <div className="container section-surface" style={{ display: "grid", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
            <h2 className="premium-h2" style={{ margin: 0 }}>Workflow dashboard</h2>
            <button className="btn btn-primary" onClick={loadSummary} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
          </div>
          {message && <div className="cp-alert cp-alert-info">{message}</div>}
          {summary && (
            <div className="cp-stat-pills">
              <span>Calls: {summary.calls.total}</span>
              <span>Queued: {summary.calls.queued}</span>
              <span>Completed: {summary.calls.completed}</span>
              <span>Avg score: {summary.transcripts.avgScore}</span>
              <span>Bookings: {summary.bookings.booked}/{summary.bookings.total}</span>
            </div>
          )}
        </div>
      </section>

      <section className="section home-section">
        <div className="container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          <form className="section-surface" onSubmit={onDemoCall} style={{ display: "grid", gap: "0.6rem" }}>
            <h3 style={{ margin: 0 }}>Request demo call</h3>
            <input name="name" placeholder="Lead name" required />
            <input name="phone" placeholder="Phone" required />
            <input name="email" placeholder="Email (optional)" type="email" />
            <input name="listingId" placeholder="Listing ID (optional)" />
            <input name="preferredTime" placeholder="Preferred time note" />
            <button className="btn btn-primary" type="submit">Queue call</button>
          </form>

          <form className="section-surface" onSubmit={onTranscript} style={{ display: "grid", gap: "0.6rem" }}>
            <h3 style={{ margin: 0 }}>Upload AI transcript</h3>
            <input name="callRequestId" placeholder="Call request ID" defaultValue={callId} required />
            <input name="scriptTemplate" placeholder="Script template" defaultValue="circle-v1" required />
            <textarea name="transcript" placeholder="Paste transcript..." rows={5} required />
            <button className="btn btn-primary" type="submit">Store + score</button>
          </form>

          <form className="section-surface" onSubmit={onBooking} style={{ display: "grid", gap: "0.6rem" }}>
            <h3 style={{ margin: 0 }}>Request booking</h3>
            <input name="leadName" placeholder="Lead name" required />
            <input name="leadPhone" placeholder="Lead phone" required />
            <input name="leadEmail" placeholder="Lead email" type="email" />
            <select name="provider" defaultValue="google">
              <option value="google">Google Calendar</option>
              <option value="outlook">Outlook Calendar</option>
            </select>
            <input name="requestedSlotIso" type="datetime-local" defaultValue={nowIsoDefault} required />
            <button className="btn btn-primary" type="submit">Request slot</button>
          </form>
        </div>
      </section>
    </MarketingPageShell>
  );
}
