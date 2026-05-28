import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { apiBase } from "../lib/apiBase";
import {
  LEAD_PRICE_MATRIX,
  LEAD_SERVICE_LINES,
  LEAD_TIERS,
  formatMoneyUsd,
  pricePerLeadUsd,
  serviceLineLabel,
  tierFromLeadCount,
  type LeadServiceLine,
  type LeadTierId,
} from "../lib/leadPricing";
import { notifyError } from "../lib/notify";
import "./pay-link.css";

type FieldKey =
  | "first_name" | "last_name" | "email" | "phone" | "city" | "state"
  | "realtor_name" | "team_name" | "brokerage_name" | "homeowner_name"
  | "preferred_channel" | "listing_link" | "listing_address" | "motivation"
  | "timeline" | "referral_name" | "referral_phone" | "referral_email"
  | "referral_notes" | "subdivision_home_owners" | "zipcode_home_owners"
  | "subdivision" | "one_fourth_mile_home_owners" | "half_mile_home_owners"
  | "one_mile_home_owners" | "intent" | "has_agent" | "follow_up_date"
  | "zip_code" | "mls";

type ContactResp = {
  ok: boolean;
  contact: {
    id: string;
    email: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    fields: Record<FieldKey, string | null>;
  };
  fieldKeys: FieldKey[];
};

type RadiusOption = {
  id: "subdivision" | "q1" | "h1" | "m1" | "zip";
  label: string;
  homes: number;
};

const FIELD_LABELS: Record<FieldKey, string> = {
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  phone: "Phone",
  city: "City",
  state: "State",
  realtor_name: "Realtor",
  team_name: "Team",
  brokerage_name: "Brokerage",
  homeowner_name: "Homeowner",
  preferred_channel: "Preferred channel",
  listing_link: "Listing link",
  listing_address: "Listing address",
  motivation: "Motivation",
  timeline: "Timeline",
  referral_name: "Referral name",
  referral_phone: "Referral phone",
  referral_email: "Referral email",
  referral_notes: "Referral notes",
  subdivision_home_owners: "Subdivision",
  zipcode_home_owners: "ZIP code",
  subdivision: "Subdivision",
  one_fourth_mile_home_owners: "¼ Mile",
  half_mile_home_owners: "½ Mile",
  one_mile_home_owners: "1 Mile",
  intent: "Intent",
  has_agent: "Has agent",
  follow_up_date: "Follow-up date",
  zip_code: "ZIP code",
  mls: "MLS",
};

const MORE_DETAIL_KEYS: FieldKey[] = [
  "email",
  "phone",
  "city",
  "state",
  "zip_code",
  "realtor_name",
  "team_name",
  "brokerage_name",
  "homeowner_name",
  "subdivision",
  "motivation",
  "timeline",
  "preferred_channel",
  "follow_up_date",
  "has_agent",
  "intent",
  "referral_name",
  "referral_phone",
  "referral_email",
  "referral_notes",
];

function toInt(v: string | null | undefined): number {
  if (!v) return 0;
  const n = Number.parseInt(String(v).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function buildRadiusOptions(fields: Record<FieldKey, string | null>): RadiusOption[] {
  const opts: RadiusOption[] = [];
  const sub = toInt(fields.subdivision_home_owners);
  if (sub) opts.push({ id: "subdivision", label: "Subdivision", homes: sub });
  const q1 = toInt(fields.one_fourth_mile_home_owners);
  if (q1) opts.push({ id: "q1", label: "¼ Mile", homes: q1 });
  const h1 = toInt(fields.half_mile_home_owners);
  if (h1) opts.push({ id: "h1", label: "½ Mile", homes: h1 });
  const m1 = toInt(fields.one_mile_home_owners);
  if (m1) opts.push({ id: "m1", label: "1 Mile", homes: m1 });
  const zip = toInt(fields.zipcode_home_owners);
  if (zip) opts.push({ id: "zip", label: "ZIP code", homes: zip });
  return opts;
}

const DEFAULT_HOMES_FALLBACK = 250;

export function PayLinkPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const [sp] = useSearchParams();
  const t = sp.get("t") || "";
  const canceled = sp.get("canceled");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ContactResp | null>(null);

  const [serviceLine, setServiceLine] = useState<LeadServiceLine>("live_callers");
  const [radiusIndex, setRadiusIndex] = useState(0);
  const [requestedHomes, setRequestedHomes] = useState<number>(DEFAULT_HOMES_FALLBACK);
  const [manualTier, setManualTier] = useState<LeadTierId | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!contactId || !t) {
      setError("This pay link is missing or invalid.");
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch(
          `${apiBase()}/api/ghl-contact/${encodeURIComponent(contactId)}?t=${encodeURIComponent(t)}`,
          { signal: ac.signal }
        );
        const json = (await r.json()) as ContactResp & { error?: string; message?: string };
        if (!r.ok || !json.ok) {
          setError(json.message || json.error || `Error ${r.status}`);
          return;
        }
        setData(json);
        const opts = buildRadiusOptions(json.contact.fields);
        const defaultIdx = opts.findIndex((o) => o.id === "h1");
        const idx = defaultIdx >= 0 ? defaultIdx : 0;
        setRadiusIndex(idx);
        if (opts[idx]?.homes) {
          setRequestedHomes(opts[idx].homes);
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Could not load contact.");
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [contactId, t]);

  const radiusOptions = useMemo<RadiusOption[]>(
    () => (data ? buildRadiusOptions(data.contact.fields) : []),
    [data]
  );
  const selectedRadius = radiusOptions[radiusIndex];
  const homesCap = selectedRadius?.homes ?? 50_000;
  const safeHomes = Math.max(1, Math.min(requestedHomes || 0, homesCap || 50_000));
  const autoTier: LeadTierId = useMemo(() => tierFromLeadCount(safeHomes), [safeHomes]);
  const leadTier: LeadTierId = manualTier ?? autoTier;

  const unitPrice = pricePerLeadUsd(serviceLine, leadTier);
  const totalUsd = safeHomes * unitPrice;

  const displayName = useMemo(() => {
    if (!data) return "";
    const f = data.contact.firstName || data.contact.fields.first_name || "";
    const l = data.contact.lastName || data.contact.fields.last_name || "";
    return `${f} ${l}`.trim();
  }, [data]);

  useEffect(() => {
    if (canceled) {
      notifyError("Checkout canceled. Pick a plan and try again.", { id: "pay-canceled" });
    }
  }, [canceled]);

  function applyRadius(i: number) {
    setRadiusIndex(i);
    const opt = radiusOptions[i];
    if (opt?.homes) {
      setRequestedHomes(opt.homes);
      setManualTier(null);
    }
  }

  function applyHomeCount(n: number) {
    if (!Number.isFinite(n) || n < 1) {
      setRequestedHomes(1);
    } else {
      setRequestedHomes(Math.min(n, homesCap || 50_000));
    }
    setManualTier(null);
  }

  function pickServiceAndTier(line: LeadServiceLine, tier: LeadTierId) {
    setServiceLine(line);
    setManualTier(tier);
  }

  async function onPay() {
    if (!contactId || !data) return;
    if (safeHomes < 1) {
      notifyError("Enter at least 1 home.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${apiBase()}/api/checkout/from-contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          t,
          serviceLine,
          leadTier,
          homes: safeHomes,
          radiusLabel: selectedRadius?.label,
        }),
      });
      const json = (await r.json()) as { ok?: boolean; url?: string; error?: string; message?: string };
      if (!r.ok || !json.url) {
        notifyError(json.message || json.error || "Could not start checkout.");
        return;
      }
      window.location.assign(json.url);
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  const selectedTierMeta = LEAD_TIERS.find((row) => row.id === leadTier)!;

  return (
    <>
      <SeoHead
        title="Secure Checkout | Circle Prospecting AI"
        description="Confirm your campaign and pay securely."
        path="/pay"
        noindex
      />
      <div className="app-shell rz-shell rz-app pay-link-shell">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space rzInterior">
          <div className="container pay-link-container">
            {loading ? (
              <div className="pay-card pay-state">
                <p className="cp-loading-line">Loading your checkout…</p>
              </div>
            ) : error ? (
              <div className="pay-card pay-state">
                <h1 className="pay-h1">We couldn't load this link</h1>
                <p className="pay-error">{error}</p>
                <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
                  Contact your agent for a new payment link.
                </p>
              </div>
            ) : data ? (
              <>
                <header className="pay-header">
                  <p className="pay-eyebrow">Secure checkout</p>
                  <h1 className="pay-h1">
                    {displayName ? `Hi ${displayName}, confirm your campaign` : "Confirm your campaign"}
                  </h1>
                  <p className="pay-lead">
                    Review your details, choose a plan, and pay securely. We'll start outreach within 1 business day.
                  </p>
                </header>

                {(() => {
                  const propertyLine =
                    data.contact.fields.listing_address ||
                    [data.contact.fields.city, data.contact.fields.state, data.contact.fields.zip_code]
                      .filter(Boolean)
                      .join(", ");
                  const moreRows = MORE_DETAIL_KEYS.map((k) => ({
                    key: k,
                    label: FIELD_LABELS[k],
                    value: data.contact.fields[k],
                  })).filter((r) => r.value && r.value.trim() !== "");
                  if (!propertyLine && !moreRows.length) return null;
                  return (
                    <section className="pay-property-strip" aria-label="Campaign summary">
                      <div className="pay-property-strip__main">
                        <span className="pay-property-strip__label">Campaign for</span>
                        <strong className="pay-property-strip__addr">{propertyLine || "—"}</strong>
                        {data.contact.fields.mls ? (
                          <span className="pay-property-strip__mls">MLS {data.contact.fields.mls}</span>
                        ) : null}
                      </div>
                      {moreRows.length > 0 && (
                        <button
                          type="button"
                          className="pay-property-strip__toggle"
                          onClick={() => setShowMore((v) => !v)}
                          aria-expanded={showMore}
                        >
                          {showMore ? "Hide details" : "View details"}
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`pay-more__chevron${showMore ? " is-open" : ""}`}
                            aria-hidden="true"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      )}
                      {showMore && moreRows.length > 0 && (
                        <dl className="pay-more__list pay-property-strip__list">
                          {moreRows.map((r) => (
                            <div key={r.key} className="pay-more__row">
                              <dt>{r.label}</dt>
                              <dd>{r.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </section>
                  );
                })()}

                <section className="pay-card pay-plan" aria-labelledby="pay-plan-title">
                  <h2 id="pay-plan-title" className="pay-section-title">Choose your plan</h2>

                  {radiusOptions.length > 0 && (
                    <div className="pay-step-block">
                      <h3 className="buy-step2-subhead">Target ring</h3>
                      <p className="muted pay-subhint">
                        Sets the maximum homeowners we can call. Pick a ring then fine-tune the home count below.
                      </p>
                      <div className="pay-radius-row" role="radiogroup" aria-label="Choose target ring">
                        {radiusOptions.map((opt, i) => (
                          <button
                            key={opt.id}
                            type="button"
                            role="radio"
                            aria-checked={i === radiusIndex}
                            className={`pay-radius-chip${i === radiusIndex ? " is-on" : ""}`}
                            onClick={() => applyRadius(i)}
                          >
                            <strong>{opt.label}</strong>
                            <span>{opt.homes.toLocaleString()} homes</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pay-step-block">
                    <h3 className="buy-step2-subhead">1 · How many homes should we call?</h3>
                    <div className="buy-listing-count-banner" role="status">
                      <span className="buy-listing-count-banner__n">{safeHomes.toLocaleString()}</span>
                      <span className="buy-listing-count-banner__l">
                        homeowners in order
                        {selectedRadius ? (
                          <>
                            {" "}· {selectedRadius.label} (up to {selectedRadius.homes.toLocaleString()})
                          </>
                        ) : null}
                        {" "}· plan <strong>{selectedTierMeta.packageLabel}</strong>
                      </span>
                    </div>
                    <label className="cp-form-grid buy-home-exact pay-home-input">
                      <span className="muted-label">
                        Homes to call (1–{selectedRadius ? selectedRadius.homes.toLocaleString() : "50,000"})
                      </span>
                      <input
                        type="number"
                        className="premium-input"
                        min={1}
                        max={selectedRadius?.homes ?? 50_000}
                        value={requestedHomes}
                        onChange={(e) => applyHomeCount(Number.parseInt(e.target.value || "1", 10))}
                      />
                    </label>
                    <p className="buy-tier-auto muted pay-rate-line">
                      <strong>{formatMoneyUsd(unitPrice)}</strong> per home with{" "}
                      <strong>{serviceLineLabel(serviceLine)}</strong> ={" "}
                      <strong className="gradient-text">{formatMoneyUsd(totalUsd)}</strong> estimated total
                    </p>
                  </div>

                  <div className="pay-step-block">
                    <h3 className="buy-step2-subhead">2 · Choose your plan (4 packages)</h3>
                    <p className="muted pay-subhint">
                      <strong>Dabble</strong>, <strong>Starter</strong>, <strong>Growth</strong>, and{" "}
                      <strong>Scale</strong> — click a row to set plan band and service. Rates are per homeowner.
                    </p>
                    <div className="buy-pricing-scroll">
                      <div className="buy-pricing-stack" role="group" aria-label="Plan packages by product">
                        {LEAD_SERVICE_LINES.map((line) => {
                          const serviceSelected = serviceLine === line.id;
                          return (
                            <div
                              key={line.id}
                              className={`buy-pricing-block${serviceSelected ? " is-selected" : ""}`}
                            >
                              <table className="buy-price-table">
                                <thead>
                                  <tr>
                                    <th
                                      className="buy-price-banner buy-price-banner--hit"
                                      colSpan={4}
                                      style={{ background: line.headerBg, color: line.headerText }}
                                    >
                                      <button
                                        type="button"
                                        className="buy-price-title-btn"
                                        style={{ color: line.headerText }}
                                        onClick={() => setServiceLine(line.id)}
                                        aria-pressed={serviceSelected}
                                      >
                                        {line.label}
                                      </button>
                                    </th>
                                  </tr>
                                  <tr className="buy-price-colheads">
                                    <th scope="col" className="buy-price-col-select">Select</th>
                                    <th scope="col">Package</th>
                                    <th scope="col">Homes</th>
                                    <th scope="col">Per home</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {LEAD_TIERS.map((tier, idx) => {
                                    const planPick = serviceLine === line.id && leadTier === tier.id;
                                    const rowBg = idx % 2 === 1 ? "rgba(15,23,42,0.04)" : "#fff";
                                    const price = LEAD_PRICE_MATRIX[line.id][idx];
                                    return (
                                      <tr
                                        key={tier.id}
                                        className={`buy-price-row${planPick ? " is-plan-selected" : ""}`}
                                        onClick={() => pickServiceAndTier(line.id, tier.id)}
                                        style={{
                                          background: planPick ? line.rowAlt : rowBg,
                                          cursor: "pointer",
                                        }}
                                      >
                                        <td className="buy-price-col-select" onClick={(e) => e.stopPropagation()}>
                                          <input
                                            type="radio"
                                            name="checkout-plan"
                                            className="buy-opp-radio"
                                            checked={planPick}
                                            aria-label={`${line.label} · ${tier.packageLabel} · ${tier.homesLabel} homes`}
                                            onChange={() => pickServiceAndTier(line.id, tier.id)}
                                          />
                                        </td>
                                        <td>{tier.packageLabel}</td>
                                        <td>{tier.homesLabel}</td>
                                        <td>{formatMoneyUsd(price)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="pay-summary">
                    <div className="pay-summary-line">
                      <span>Plan</span>
                      <strong>{selectedTierMeta.packageLabel}</strong>
                    </div>
                    <div className="pay-summary-line">
                      <span>Service</span>
                      <strong>{serviceLineLabel(serviceLine)}</strong>
                    </div>
                    {selectedRadius ? (
                      <div className="pay-summary-line">
                        <span>Ring</span>
                        <strong>{selectedRadius.label}</strong>
                      </div>
                    ) : null}
                    <div className="pay-summary-line">
                      <span>Homes</span>
                      <strong>{safeHomes.toLocaleString()}</strong>
                    </div>
                    <div className="pay-summary-line">
                      <span>Rate / home</span>
                      <strong>{formatMoneyUsd(unitPrice)}</strong>
                    </div>
                    <div className="pay-summary-total">
                      <span>Total</span>
                      <strong>{formatMoneyUsd(totalUsd)}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary pay-cta"
                    disabled={busy || safeHomes < 1}
                    onClick={onPay}
                  >
                    {busy ? "Redirecting to Stripe…" : `Pay ${formatMoneyUsd(totalUsd)} securely`}
                  </button>
                  <p className="pay-fine">
                    Powered by Stripe · Encrypted card payment · Cancel anytime before payment.
                  </p>
                </section>
              </>
            ) : null}
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
