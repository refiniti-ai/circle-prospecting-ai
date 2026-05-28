import { useState, type FormEvent } from "react";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { apiBase } from "../lib/apiBase";
import { notifyError, notifySuccess } from "../lib/notify";
import "./generate-checkout.css";

type GenerateResponse = {
  ok: boolean;
  url: string;
  sessionId: string;
  amountCents: number;
  currency: string;
  ghl: { mode: string; status?: number; reason?: string; message?: string };
};

const PLAN_PRESETS: { label: string; amount: number }[] = [
  { label: "Just Listed AI · 250 homes", amount: 199 },
  { label: "Just Listed AI · 500 homes", amount: 349 },
  { label: "Just Sold Live Caller · 500 homes", amount: 599 },
  { label: "Just Sold Live Caller · 1,000 homes", amount: 1099 },
  { label: "Hybrid (AI + Live) · 1,000 homes", amount: 1399 },
];

export function GenerateCheckoutPage() {
  const [contactId, setContactId] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState(PLAN_PRESETS[0].label);
  const [amount, setAmount] = useState(String(PLAN_PRESETS[0].amount));
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyPreset(p: { label: string; amount: number }) {
    setPlan(p.label);
    setAmount(String(p.amount));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch(`${apiBase()}/api/generate-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Webhook-Token": token } : {}),
        },
        body: JSON.stringify({
          contactId: contactId.trim(),
          email: email.trim(),
          plan: plan.trim(),
          amount: Number(amount),
        }),
      });
      const data = (await r.json()) as GenerateResponse & { error?: string; message?: string };
      if (!r.ok || !data.url) {
        const msg = data.message || data.error || `Server error (${r.status})`;
        setError(msg);
        notifyError(msg);
        return;
      }
      setResult(data);
      notifySuccess("Checkout link created");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setError(msg);
      notifyError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    if (!result?.url) return;
    try {
      await navigator.clipboard.writeText(result.url);
      notifySuccess("URL copied");
    } catch {
      notifyError("Could not copy URL");
    }
  }

  return (
    <>
      <SeoHead
        title="Generate Checkout Link | Circle Prospecting AI"
        description="Internal tool: generate a Stripe checkout link for a GHL contact."
        path="/admin/generate-checkout"
        noindex
      />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space rzInterior">
          <div className="container gc-container">
            <header className="gc-header">
              <h1 className="gc-title">Generate Checkout Link</h1>
              <p className="gc-lead">
                Creates a one-off Stripe checkout URL and (when configured) writes it back to the GHL contact's
                custom field <code>stripe_checkout_url</code>.
              </p>
            </header>

            <section className="gc-card">
              <form className="gc-form" onSubmit={onSubmit}>
                <div className="gc-row">
                  <label className="gc-label">
                    <span>GHL Contact ID</span>
                    <input
                      className="gc-input"
                      value={contactId}
                      onChange={(e) => setContactId(e.target.value)}
                      placeholder="e.g. ocQHyuzHvysMo5N5VsXc"
                      required
                    />
                  </label>
                  <label className="gc-label">
                    <span>Email</span>
                    <input
                      className="gc-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="buyer@example.com"
                      required
                    />
                  </label>
                </div>

                <div className="gc-row">
                  <label className="gc-label gc-label--wide">
                    <span>Plan label (shown to buyer)</span>
                    <input
                      className="gc-input"
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                      placeholder="Just Listed AI · 500 homes"
                      required
                    />
                  </label>
                  <label className="gc-label">
                    <span>Amount (USD)</span>
                    <input
                      className="gc-input"
                      type="number"
                      min={0.5}
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </label>
                </div>

                <details className="gc-presets">
                  <summary>Quick presets</summary>
                  <div className="gc-preset-grid">
                    {PLAN_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className="gc-preset-btn"
                        onClick={() => applyPreset(p)}
                      >
                        <strong>{p.label}</strong>
                        <span>${p.amount.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </details>

                <details className="gc-presets">
                  <summary>Webhook token (only if server requires one)</summary>
                  <label className="gc-label gc-label--wide" style={{ marginTop: "0.5rem" }}>
                    <span>X-Webhook-Token</span>
                    <input
                      className="gc-input"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Matches GENERATE_CHECKOUT_TOKEN on the server"
                    />
                  </label>
                </details>

                <div className="gc-actions">
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy ? "Creating checkout link…" : "Generate checkout link"}
                  </button>
                </div>
              </form>
            </section>

            {error ? (
              <div className="cp-alert cp-alert--warn" role="alert" style={{ marginTop: "1rem" }}>
                {error}
              </div>
            ) : null}

            {result ? (
              <section className="gc-card gc-result" aria-live="polite">
                <h2 className="gc-result-title">Sample checkout link ready</h2>
                <p className="gc-result-meta">
                  Stripe session <code>{result.sessionId}</code> · Total{" "}
                  <strong>${(result.amountCents / 100).toFixed(2)}</strong>
                </p>

                <div className="gc-url-row">
                  <input className="gc-input gc-url-input" readOnly value={result.url} onFocus={(e) => e.currentTarget.select()} />
                  <button type="button" className="btn btn-ghost" onClick={copyUrl}>
                    Copy
                  </button>
                  <a className="btn btn-primary" href={result.url} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                </div>

                <p className="gc-ghl">
                  GHL update:{" "}
                  <strong>{result.ghl.mode}</strong>
                  {result.ghl.status ? ` (HTTP ${result.ghl.status})` : ""}
                  {result.ghl.reason ? ` — ${result.ghl.reason}` : ""}
                  {result.ghl.message ? ` — ${result.ghl.message}` : ""}
                </p>
              </section>
            ) : null}

            <section className="gc-card gc-curl">
              <h2 className="gc-result-title">For your GHL automation</h2>
              <p className="gc-result-meta">POST to this endpoint from a GHL Webhook action:</p>
              <pre className="gc-pre">
{`POST ${apiBase() || "https://YOUR-API"}/api/generate-checkout
Content-Type: application/json
X-Webhook-Token: <optional, matches GENERATE_CHECKOUT_TOKEN>

{
  "contactId": "{{contact.id}}",
  "email":     "{{contact.email}}",
  "plan":      "{{contact.plan}}",
  "amount":    {{contact.amount}}
}`}
              </pre>
            </section>
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
