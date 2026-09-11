import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import {
  adminCreateClientPasswordResetLink,
  adminSetPurchaseLeadWorkStatus,
  changeAdminPassword,
  fetchAdminCheckoutFunnel,
  fetchAdminPurchases,
  type AdminCheckoutFunnelRow,
  type AdminCheckoutFunnelSummary,
  type AdminPurchaseRow,
} from "../lib/leadsApi";
import { notifyError, notifySuccess, notifyWarning } from "../lib/notify";
import { fetchAdminSearchCatches, type AdminSearchCatchRow } from "../lib/searchCatcherApi";
import { AdminSearchCatcherPanel } from "../components/admin/AdminSearchCatcherPanel";

const KEY = "cpai_admin_jwt";
const LEGACY_KEY = "cpai_admin_key";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "purchases", label: "Purchases" },
  { id: "checkouts", label: "Checkouts" },
  { id: "searches", label: "Searches" },
  { id: "account", label: "Account" },
] as const;

const REMOVED_TAB_PARAMS = new Set(["clients", "tools", "inventory"]);

const PURCHASES_PAGE_SIZE = 10;
const CHECKOUTS_PAGE_SIZE = 10;

type TabId = (typeof TABS)[number]["id"];

function formatMoney(cents: number | null, currency: string | null) {
  if (cents == null) return "—";
  const cur = (currency || "usd").toUpperCase();
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: cur });
}

function slugLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  return raw.replace(/_/g, " ");
}

function funnelStatusLabel(status: string): string {
  if (status === "started") return "On Stripe";
  if (status === "canceled") return "Canceled";
  if (status === "expired") return "Expired";
  return status;
}

function funnelTypeLabel(checkoutType: string): string {
  if (checkoutType === "intro_campaign") return "$99 intro";
  if (checkoutType === "lead_pack") return "Buy leads";
  if (checkoutType === "ghl_pay_link") return "Pay link";
  return slugLabel(checkoutType);
}

function downloadAdminCheckoutsCsv(rows: AdminCheckoutFunnelRow[], filename: string) {
  const header = [
    "startedAt",
    "status",
    "customerEmail",
    "checkoutType",
    "serviceLine",
    "requestedLeads",
    "mls",
    "listingAddress",
    "pagePath",
    "amountCents",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.startedAt,
        funnelStatusLabel(r.status),
        r.customerEmail ?? "",
        funnelTypeLabel(r.checkoutType),
        slugLabel(r.serviceLine),
        r.requestedLeads ?? "",
        r.mls ?? "",
        r.listingAddress ?? "",
        r.pagePath ?? "",
        r.amountCents ?? "",
      ]
        .map((c) => csvEscape(String(c)))
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminFunnelUnpaidRow({ row }: { row: AdminCheckoutFunnelRow }) {
  return (
    <li className="adm-funnel-stopped__item">
      <span className="adm-funnel-stopped__status">{funnelStatusLabel(row.status)}</span>
      <div className="adm-funnel-stopped__body">
        <span>
          {row.customerEmail || "No email"} · {funnelTypeLabel(row.checkoutType)} · {slugLabel(row.serviceLine)} ·{" "}
          {row.requestedLeads?.toLocaleString() ?? "—"} homes
        </span>
        {row.listingAddress || row.mls ? (
          <span className="adm-funnel-stopped__listing">
            {row.listingAddress || `MLS ${row.mls}`}
            {row.listingAddress && row.mls ? ` · MLS ${row.mls}` : ""}
          </span>
        ) : null}
        {row.pagePath ? (
          <a className="adm-funnel-stopped__link" href={row.pagePath} target="_blank" rel="noreferrer">
            Open listing
          </a>
        ) : null}
      </div>
      <span className="adm-funnel-stopped__time">{new Date(row.startedAt).toLocaleString()}</span>
    </li>
  );
}

function csvEscape(cell: string): string {
  const s = String(cell ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadAdminPurchasesCsv(rows: AdminPurchaseRow[], filename: string) {
  const header = [
    "orderNumber",
    "sessionId",
    "notifiedAt",
    "checkoutType",
    "customerEmail",
    "amountTotalCents",
    "currency",
    "mls",
    "listingAddress",
    "agentName",
    "brokerage",
    "customerPhone",
    "leadServiceLine",
    "leadTier",
    "requestedLeads",
    "campaignType",
    "radiusLabel",
    "targetingSummary",
    "lineItems",
    "leadWorkStatus",
  ];
  const lines = [
    header.join(","),
    ...rows.map((p) =>
      [
        p.orderNumber,
        p.sessionId,
        p.notifiedAt,
        p.checkoutType,
        p.customerEmail ?? "",
        p.amountTotalCents ?? "",
        p.currency ?? "",
        p.mls ?? "",
        p.listingAddress ?? "",
        p.agentName ?? "",
        p.brokerage ?? "",
        p.customerPhone ?? "",
        p.leadServiceLine ?? "",
        p.leadTier ?? "",
        p.requestedLeads ?? "",
        p.campaignType ?? "",
        p.radiusLabel ?? "",
        p.targetingSummary ?? "",
        p.lineItems.join(" | "),
        p.leadWorkStatus === "completed" ? "completed" : p.leadWorkStatus === "pending" ? "pending" : "",
      ]
        .map((c) => csvEscape(String(c)))
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function checkoutTypeLabel(type: string): string {
  if (type === "lead_pack") return "Lead pack";
  if (type === "campaign") return "Campaign";
  return type.replace(/_/g, " ");
}

function formatShortSession(sessionId: string): string {
  if (sessionId.length <= 24) return sessionId;
  return `${sessionId.slice(0, 14)}…${sessionId.slice(-10)}`;
}

function AdminPurchaseCard({
  p,
  copiedId,
  onCopy,
  leadWorkBusy,
  onLeadWorkChange,
}: {
  p: AdminPurchaseRow;
  copiedId: string | null;
  onCopy: (id: string) => void;
  leadWorkBusy: boolean;
  onLeadWorkChange: (sessionId: string, status: "pending" | "completed") => void;
}) {
  const typeMod =
    p.checkoutType === "lead_pack"
      ? "adm-purchase-card__badge--lead"
      : p.checkoutType === "campaign"
        ? "adm-purchase-card__badge--campaign"
        : "adm-purchase-card__badge--other";

  const leadDone = p.leadWorkStatus === "completed";
  const showLeadWork = p.checkoutType === "lead_pack" || p.checkoutType === "campaign";

  return (
    <article className="adm-purchase-card">
      <div className="adm-purchase-card__header">
        <div className="adm-purchase-card__title-block">
          <span className={`adm-purchase-card__badge ${typeMod}`}>{checkoutTypeLabel(p.checkoutType)}</span>
          <h3 className="adm-purchase-card__order">{p.orderNumber}</h3>
        </div>
        <div className="adm-purchase-card__price">{formatMoney(p.amountTotalCents, p.currency)}</div>
      </div>
      <div className="adm-purchase-card__sub">
        <span className="adm-purchase-card__email">{p.customerEmail || "No email on file"}</span>
        {p.customerPhone ? <span className="adm-purchase-card__phone">{p.customerPhone}</span> : null}
        <time className="adm-purchase-card__time" dateTime={p.notifiedAt}>
          {new Date(p.notifiedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </time>
      </div>
      {p.mls || p.listingAddress || p.agentName ? (
        <div className="adm-purchase-card__listing">
          {p.mls ? (
            <p className="adm-purchase-card__mls">
              <span className="adm-chip__k">MLS</span> {p.mls}
            </p>
          ) : null}
          {p.listingAddress ? <p className="adm-purchase-card__address">{p.listingAddress}</p> : null}
          {p.agentName || p.brokerage ? (
            <p className="adm-purchase-card__agent">
              {[p.agentName, p.brokerage].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}
      {p.checkoutType === "lead_pack" || p.checkoutType === "ghl_pay_link" ? (
        <div className="adm-purchase-card__chips">
          <span className="adm-chip">
            <span className="adm-chip__k">Service</span> {slugLabel(p.leadServiceLine)}
          </span>
          <span className="adm-chip">
            <span className="adm-chip__k">Plan</span> {slugLabel(p.leadTier)}
          </span>
          <span className="adm-chip">
            <span className="adm-chip__k">Qty</span> {p.requestedLeads ?? "—"}
          </span>
          {p.campaignType ? (
            <span className="adm-chip">
              <span className="adm-chip__k">Campaign</span> {slugLabel(p.campaignType)}
            </span>
          ) : null}
          {p.radiusLabel ? (
            <span className="adm-chip">
              <span className="adm-chip__k">Radius</span> {p.radiusLabel}
            </span>
          ) : null}
          {p.targetingSummary ? (
            <span className="adm-chip adm-chip--wide">
              <span className="adm-chip__k">Area</span> {p.targetingSummary}
            </span>
          ) : null}
        </div>
      ) : null}
      <p className="adm-purchase-card__product">{p.lineItems.length ? p.lineItems.join(" · ") : "—"}</p>
      {showLeadWork ? (
        <div className="adm-purchase-card__leadwork">
          <div className="adm-purchase-card__leadwork-info">
            <span className="adm-purchase-card__leadwork-label">Lead fulfillment</span>
            <span className={leadDone ? "adm-lead-pill adm-lead-pill--done" : "adm-lead-pill"}>
              {leadDone ? "Completed" : "Open"}
            </span>
          </div>
          <button
            type="button"
            className="adm-purchase-card__leadwork-btn"
            disabled={leadWorkBusy}
            onClick={() => onLeadWorkChange(p.sessionId, leadDone ? "pending" : "completed")}
          >
            {leadWorkBusy ? "Saving…" : leadDone ? "Reopen" : "Mark complete"}
          </button>
        </div>
      ) : null}
      <div className="adm-purchase-card__stripe">
        <code className="adm-purchase-card__session" title={p.sessionId}>
          {formatShortSession(p.sessionId)}
        </code>
        <button type="button" className="adm-purchase-card__copy" onClick={() => onCopy(p.sessionId)}>
          {copiedId === p.sessionId ? "Copied" : "Copy ID"}
        </button>
      </div>
    </article>
  );
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "overview";

  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const [purchases, setPurchases] = useState<AdminPurchaseRow[] | null>(null);
  const [searchCatches, setSearchCatches] = useState<AdminSearchCatchRow[] | null>(null);
  const [checkoutFunnel, setCheckoutFunnel] = useState<AdminCheckoutFunnelSummary | null>(null);

  const [purchaseQuery, setPurchaseQuery] = useState("");
  const [purchaseListPage, setPurchaseListPage] = useState(1);
  const [checkoutQuery, setCheckoutQuery] = useState("");
  const [checkoutListPage, setCheckoutListPage] = useState(1);
  const [copiedSession, setCopiedSession] = useState<string | null>(null);

  const [resetLinkEmail, setResetLinkEmail] = useState("");
  const [resetLinkOut, setResetLinkOut] = useState<string | null>(null);
  const [resetLinkBusy, setResetLinkBusy] = useState(false);
  const [copiedResetLink, setCopiedResetLink] = useState(false);
  const [leadWorkBusyId, setLeadWorkBusyId] = useState<string | null>(null);

  const [adminPwCurrent, setAdminPwCurrent] = useState("");
  const [adminPwNew, setAdminPwNew] = useState("");
  const [adminPwNew2, setAdminPwNew2] = useState("");
  const [adminPwBusy, setAdminPwBusy] = useState(false);

  function copySessionId(id: string) {
    void navigator.clipboard.writeText(id).then(() => {
      setCopiedSession(id);
      window.setTimeout(() => {
        setCopiedSession((cur) => (cur === id ? null : cur));
      }, 2000);
    });
  }

  async function onCreateClientResetLink() {
    if (!activeKey) return;
    setResetLinkOut(null);
    setCopiedResetLink(false);
    const e = resetLinkEmail.trim();
    if (!e.includes("@")) {
      notifyError("Enter the client’s email.");
      return;
    }
    setResetLinkBusy(true);
    try {
      const r = await adminCreateClientPasswordResetLink(activeKey, e);
      setResetLinkOut(r.link);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Could not create link.");
    } finally {
      setResetLinkBusy(false);
    }
  }

  function copyResetLink() {
    if (!resetLinkOut) return;
    void navigator.clipboard.writeText(resetLinkOut).then(() => {
      setCopiedResetLink(true);
      window.setTimeout(() => setCopiedResetLink(false), 2000);
    });
  }

  async function onChangeAdminPassword() {
    if (!activeKey) return;
    if (!adminPwCurrent) {
      notifyError("Enter your current admin password.");
      return;
    }
    if (adminPwNew.length < 8) {
      notifyError("New password must be at least 8 characters.");
      return;
    }
    if (adminPwNew !== adminPwNew2) {
      notifyError("New passwords do not match.");
      return;
    }
    setAdminPwBusy(true);
    try {
      await changeAdminPassword(activeKey, adminPwCurrent, adminPwNew);
      notifySuccess("Admin password updated. Use it the next time you sign in.");
      setAdminPwCurrent("");
      setAdminPwNew("");
      setAdminPwNew2("");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setAdminPwBusy(false);
    }
  }

  async function onLeadWorkChange(sessionId: string, status: "pending" | "completed") {
    if (!activeKey) return;
    setLeadWorkBusyId(sessionId);
    try {
      await adminSetPurchaseLeadWorkStatus(activeKey, sessionId, status);
      const p = await fetchAdminPurchases(activeKey);
      setPurchases(p.purchases);
    } catch (e) {
      notifyWarning(e instanceof Error ? e.message : "Could not update fulfillment status.");
    } finally {
      setLeadWorkBusyId(null);
    }
  }

  const loadDashboard = useCallback(async (key: string) => {
    const [p, funnelRes, searchesRes] = await Promise.all([
      fetchAdminPurchases(key),
      fetchAdminCheckoutFunnel(key).catch(() => null),
      fetchAdminSearchCatches(key).catch(() => null),
    ]);
    setPurchases(p.purchases);
    setCheckoutFunnel(funnelRes?.funnel ?? null);
    setSearchCatches(searchesRes?.searches ?? []);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(KEY) ?? sessionStorage.getItem(LEGACY_KEY);
    if (!saved) {
      setAuthChecking(false);
      return;
    }
    loadDashboard(saved)
      .then(() => {
        setActiveKey(saved);
        setAuthenticated(true);
        if (sessionStorage.getItem(LEGACY_KEY) && !sessionStorage.getItem(KEY)) {
          sessionStorage.setItem(KEY, saved);
          sessionStorage.removeItem(LEGACY_KEY);
        }
      })
      .catch(() => {
        sessionStorage.removeItem(KEY);
        sessionStorage.removeItem(LEGACY_KEY);
      })
      .finally(() => setAuthChecking(false));
  }, [loadDashboard]);

  useEffect(() => {
    if (!authenticated) return;
    if (!tabParam || !REMOVED_TAB_PARAMS.has(tabParam)) return;
    navigate("/admin?tab=overview", { replace: true });
  }, [tabParam, navigate, authenticated]);

  function logout() {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(LEGACY_KEY);
    setActiveKey(null);
    setAuthenticated(false);
    setPurchases(null);
    setSearchCatches(null);
    navigate("/login?tab=admin", { replace: true });
  }

  async function refresh() {
    if (!activeKey) return;
    try {
      await loadDashboard(activeKey);
    } catch {
      notifyWarning("Could not refresh data.");
    }
  }

  const revenueCents = useMemo(() => {
    if (!purchases?.length) return 0;
    return purchases.reduce((acc, p) => acc + (p.amountTotalCents ?? 0), 0);
  }, [purchases]);

  const purchaseStats = useMemo(() => {
    if (!purchases?.length) return { leadPacks: 0, campaigns: 0, other: 0 };
    let leadPacks = 0;
    let campaigns = 0;
    let other = 0;
    for (const p of purchases) {
      if (p.checkoutType === "lead_pack") leadPacks += 1;
      else if (p.checkoutType === "campaign") campaigns += 1;
      else other += 1;
    }
    return { leadPacks, campaigns, other };
  }, [purchases]);

  const filteredPurchases = useMemo(() => {
    if (!purchases?.length) return [];
    const q = purchaseQuery.trim().toLowerCase();
    if (!q) return purchases;
    return purchases.filter((p) => {
      const blob = [
        p.orderNumber,
        p.sessionId,
        p.customerEmail,
        p.mls,
        p.listingAddress,
        p.agentName,
        p.brokerage,
        p.checkoutType,
        p.targetingSummary,
        ...p.lineItems,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [purchases, purchaseQuery]);

  useEffect(() => {
    setPurchaseListPage(1);
  }, [purchaseQuery]);

  const recentPurchases = useMemo(() => (purchases ?? []).slice(0, 6), [purchases]);

  const purchaseListTotalPages = Math.max(1, Math.ceil(filteredPurchases.length / PURCHASES_PAGE_SIZE));

  useEffect(() => {
    setPurchaseListPage((p) => Math.min(p, purchaseListTotalPages));
  }, [purchaseListTotalPages]);

  const paginatedFilteredPurchases = useMemo(() => {
    const start = (purchaseListPage - 1) * PURCHASES_PAGE_SIZE;
    return filteredPurchases.slice(start, start + PURCHASES_PAGE_SIZE);
  }, [filteredPurchases, purchaseListPage]);

  const purchaseRangeStart = filteredPurchases.length === 0 ? 0 : (purchaseListPage - 1) * PURCHASES_PAGE_SIZE + 1;
  const purchaseRangeEnd = Math.min(purchaseListPage * PURCHASES_PAGE_SIZE, filteredPurchases.length);

  const unpaidCheckouts = checkoutFunnel?.unpaid ?? checkoutFunnel?.recentStopped ?? [];

  const filteredCheckouts = useMemo(() => {
    const q = checkoutQuery.trim().toLowerCase();
    if (!q) return unpaidCheckouts;
    return unpaidCheckouts.filter((r) =>
      [
        r.customerEmail,
        r.status,
        funnelStatusLabel(r.status),
        r.checkoutType,
        funnelTypeLabel(r.checkoutType),
        r.serviceLine,
        r.mls,
        r.listingAddress,
        r.pagePath,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [unpaidCheckouts, checkoutQuery]);

  useEffect(() => {
    setCheckoutListPage(1);
  }, [checkoutQuery]);

  const checkoutListTotalPages = Math.max(1, Math.ceil(filteredCheckouts.length / CHECKOUTS_PAGE_SIZE));

  useEffect(() => {
    setCheckoutListPage((p) => Math.min(p, checkoutListTotalPages));
  }, [checkoutListTotalPages]);

  const paginatedCheckouts = useMemo(() => {
    const start = (checkoutListPage - 1) * CHECKOUTS_PAGE_SIZE;
    return filteredCheckouts.slice(start, start + CHECKOUTS_PAGE_SIZE);
  }, [filteredCheckouts, checkoutListPage]);

  const checkoutRangeStart = filteredCheckouts.length === 0 ? 0 : (checkoutListPage - 1) * CHECKOUTS_PAGE_SIZE + 1;
  const checkoutRangeEnd = Math.min(checkoutListPage * CHECKOUTS_PAGE_SIZE, filteredCheckouts.length);

  if (authChecking) {
    return (
      <>
        <SeoHead title="Admin | Dashboard" description="Operations" path="/admin" noindex />
        <div className="app-shell rz-shell rz-app">
          <SiteHeader />
          <main className="page-space rzInterior">
            <div className="container" style={{ maxWidth: 720 }}>
              <p className="muted">Loading…</p>
            </div>
          </main>
          <SiteFooter />
        </div>
      </>
    );
  }

  return (
    <>
      <SeoHead title="Admin | Dashboard" description="Purchases and operations" path="/admin" noindex />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space page-space--tight rzInterior adm-dash-premium">
          <div className="container adm-dash-container" style={{ maxWidth: 960 }}>
            {!authenticated ? (
              <Navigate to="/login?tab=admin" replace />
            ) : (
              <>
                <header className="adm-dash-hero">
                  <p className="page-breadcrumb adm-dash-hero__crumb">
                    <Link to="/">Home</Link> / Admin
                  </p>
                  <div className="adm-dash-hero__row">
                    <div>
                      <p className="adm-dash-hero__eyebrow">Operations</p>
                      <h1 className="adm-dash-hero__title adm-dash-hero__title--gradient">Dashboard</h1>
                    </div>
                    <div className="adm-dash-hero__actions">
                      <button type="button" className="adm-dash-hero__btn" onClick={() => void refresh()}>
                        Refresh
                      </button>
                      <button type="button" className="adm-dash-hero__btn adm-dash-hero__btn--primary" onClick={logout}>
                        Sign out
                      </button>
                    </div>
                  </div>
                </header>

                <nav className="adm-dash-nav" aria-label="Admin sections">
                  {TABS.map((t) => (
                    <Link
                      key={t.id}
                      to={`/admin?tab=${t.id}`}
                      className={`adm-dash-nav__link${tab === t.id ? " is-active" : ""}`}
                    >
                      {t.label}
                    </Link>
                  ))}
                </nav>

                {tab === "overview" && (
                  <section className="adm-overview" aria-label="Summary">
                    <div className="adm-overview__grid">
                      <div className="adm-stat-card">
                        <span className="adm-stat-card__label">Orders</span>
                        <span className="adm-stat-card__value">{purchases?.length ?? "—"}</span>
                      </div>
                      <div className="adm-stat-card adm-stat-card--wide">
                        <span className="adm-stat-card__label">Revenue (recorded)</span>
                        <span className="adm-stat-card__value">
                          {(revenueCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                        </span>
                      </div>
                      <div className="adm-stat-card">
                        <span className="adm-stat-card__label">Lead packs</span>
                        <span className="adm-stat-card__value">{purchaseStats.leadPacks}</span>
                      </div>
                      <div className="adm-stat-card">
                        <span className="adm-stat-card__label">Campaigns</span>
                        <span className="adm-stat-card__value">{purchaseStats.campaigns}</span>
                      </div>
                      <div className="adm-stat-card">
                        <span className="adm-stat-card__label">Continued to Stripe</span>
                        <span className="adm-stat-card__value">{checkoutFunnel?.continued ?? "—"}</span>
                      </div>
                      <div className="adm-stat-card">
                        <span className="adm-stat-card__label">Checkout paid</span>
                        <span className="adm-stat-card__value">{checkoutFunnel?.paid ?? "—"}</span>
                      </div>
                      <div className="adm-stat-card">
                        <span className="adm-stat-card__label">Stopped / abandoned</span>
                        <span className="adm-stat-card__value">{checkoutFunnel?.stopped ?? "—"}</span>
                      </div>
                      <div className="adm-stat-card">
                        <span className="adm-stat-card__label">In progress (&lt;24h)</span>
                        <span className="adm-stat-card__value">{checkoutFunnel?.inProgress ?? "—"}</span>
                      </div>
                      <div className="adm-stat-card">
                        <span className="adm-stat-card__label">Checkout conversion</span>
                        <span className="adm-stat-card__value">
                          {checkoutFunnel ? `${checkoutFunnel.conversionRate}%` : "—"}
                        </span>
                      </div>
                    </div>
                    {recentPurchases.length ? (
                      <div className="adm-recent-purchases">
                        <div className="adm-recent-purchases__head">
                          <h2 className="adm-recent-purchases__title">Recent purchases</h2>
                          <Link to="/admin?tab=purchases" className="adm-recent-purchases__link">
                            View all
                          </Link>
                        </div>
                        <ul className="adm-recent-purchases__list">
                          {recentPurchases.map((p) => (
                            <li key={p.sessionId} className="adm-recent-purchases__item">
                              <div className="adm-recent-purchases__main">
                                <strong>{p.mls ? `MLS ${p.mls}` : p.orderNumber}</strong>
                                <span>{formatMoney(p.amountTotalCents, p.currency)}</span>
                              </div>
                              <div className="adm-recent-purchases__meta">
                                <span>{p.listingAddress || p.targetingSummary || "—"}</span>
                                <span>
                                  {p.customerEmail || "No email"}
                                  {p.requestedLeads ? ` · ${p.requestedLeads.toLocaleString()} homes` : ""}
                                </span>
                              </div>
                              <time className="adm-recent-purchases__time" dateTime={p.notifiedAt}>
                                {new Date(p.notifiedAt).toLocaleString()}
                              </time>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {checkoutFunnel?.recentStopped?.length ? (
                      <div className="adm-funnel-stopped">
                        <div className="adm-recent-purchases__head">
                          <h2 className="adm-funnel-stopped__title">Went to Stripe — not paid</h2>
                          <Link to="/admin?tab=checkouts" className="adm-recent-purchases__link">
                            View all
                          </Link>
                        </div>
                        <ul className="adm-funnel-stopped__list">
                          {checkoutFunnel.recentStopped.map((row) => (
                            <AdminFunnelUnpaidRow key={row.sessionId} row={row} />
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="adm-overview__cta">
                      <Link to="/admin?tab=purchases" className="adm-cta-btn adm-cta-btn--solid">
                        Purchases
                      </Link>
                      <Link to="/admin?tab=checkouts" className="adm-cta-btn">
                        Checkouts
                      </Link>
                      <Link to="/admin?tab=account" className="adm-cta-btn">
                        Account / password
                      </Link>
                    </div>
                    <div className="adm-support">
                      <h2 className="adm-support__title">Client password reset</h2>
                      <p className="adm-support__sub">
                        If email delivery is off or the user did not get the message, create a one-time link and send it yourself (valid 1 hour).
                      </p>
                      <div className="adm-support__row">
                        <input
                          type="email"
                          className="adm-support__input"
                          placeholder="client@example.com"
                          value={resetLinkEmail}
                          onChange={(ev) => {
                            setResetLinkEmail(ev.target.value);
                            setResetLinkOut(null);
                          }}
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          className="adm-cta-btn adm-cta-btn--solid"
                          disabled={resetLinkBusy}
                          onClick={() => void onCreateClientResetLink()}
                        >
                          {resetLinkBusy ? "Creating…" : "Create link"}
                        </button>
                      </div>
                      {resetLinkOut ? (
                        <div className="adm-support__out">
                          <code className="adm-support__url" title={resetLinkOut}>
                            {resetLinkOut.length > 72 ? `${resetLinkOut.slice(0, 56)}…` : resetLinkOut}
                          </code>
                          <button type="button" className="adm-support__copy" onClick={copyResetLink}>
                            {copiedResetLink ? "Copied" : "Copy"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </section>
                )}

                {tab === "account" && (
                  <section className="adm-account" aria-label="Admin account">
                    <div className="adm-support">
                      <h2 className="adm-support__title">Change admin password</h2>
                      <p className="adm-support__sub">
                        Verifies your current password, then saves a new hash on the server (Firestore or local file, depending on
                        deployment). Use your next sign-in password after a successful update.
                      </p>
                      <div className="adm-support__stack">
                        <input
                          type="password"
                          className="adm-support__input adm-support__input--full"
                          placeholder="Current password"
                          value={adminPwCurrent}
                          onChange={(ev) => setAdminPwCurrent(ev.target.value)}
                          autoComplete="current-password"
                          disabled={adminPwBusy}
                        />
                        <input
                          type="password"
                          className="adm-support__input adm-support__input--full"
                          placeholder="New password (8+ characters)"
                          value={adminPwNew}
                          onChange={(ev) => setAdminPwNew(ev.target.value)}
                          autoComplete="new-password"
                          minLength={8}
                          disabled={adminPwBusy}
                        />
                        <input
                          type="password"
                          className="adm-support__input adm-support__input--full"
                          placeholder="Confirm new password"
                          value={adminPwNew2}
                          onChange={(ev) => setAdminPwNew2(ev.target.value)}
                          autoComplete="new-password"
                          minLength={8}
                          disabled={adminPwBusy}
                        />
                        <button
                          type="button"
                          className="adm-cta-btn adm-cta-btn--solid"
                          style={{ width: "fit-content" }}
                          disabled={adminPwBusy}
                          onClick={() => void onChangeAdminPassword()}
                        >
                          {adminPwBusy ? "Saving…" : "Update admin password"}
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {tab === "checkouts" && (
                  <section className="adm-purchases-section">
                    {!unpaidCheckouts.length ? (
                      <div className="adm-empty-state" role="status">
                        <p className="adm-empty-state__title">No unpaid checkouts</p>
                        <p className="adm-empty-state__text">People who click checkout and don’t finish will show here.</p>
                      </div>
                    ) : (
                      <>
                        <div className="adm-toolbar">
                          <label className="adm-toolbar__search">
                            <span className="adm-toolbar__label">Search</span>
                            <input
                              type="search"
                              className="adm-toolbar__input"
                              placeholder="Email, MLS, address, $99 intro…"
                              value={checkoutQuery}
                              onChange={(e) => setCheckoutQuery(e.target.value)}
                              autoComplete="off"
                            />
                          </label>
                          <button
                            type="button"
                            className="adm-toolbar__export"
                            onClick={() =>
                              downloadAdminCheckoutsCsv(
                                filteredCheckouts,
                                `admin-checkouts-${new Date().toISOString().slice(0, 10)}.csv`
                              )
                            }
                          >
                            Export CSV · {filteredCheckouts.length}
                          </button>
                        </div>
                        {filteredCheckouts.length === 0 ? (
                          <p className="muted adm-purchases-empty">No checkouts match your search.</p>
                        ) : (
                          <>
                            <div className="adm-funnel-stopped adm-funnel-stopped--tab">
                              <ul className="adm-funnel-stopped__list">
                                {paginatedCheckouts.map((row) => (
                                  <AdminFunnelUnpaidRow key={row.sessionId} row={row} />
                                ))}
                              </ul>
                            </div>
                            {filteredCheckouts.length > CHECKOUTS_PAGE_SIZE ? (
                              <div className="adm-pagination">
                                <span className="adm-pagination__meta">
                                  Showing {checkoutRangeStart}–{checkoutRangeEnd} of {filteredCheckouts.length} · Page{" "}
                                  {checkoutListPage} of {checkoutListTotalPages}
                                </span>
                                <div className="adm-pagination__btns">
                                  <button
                                    type="button"
                                    className="adm-pagination__btn"
                                    disabled={checkoutListPage <= 1}
                                    onClick={() => setCheckoutListPage((n) => Math.max(1, n - 1))}
                                  >
                                    Previous
                                  </button>
                                  <button
                                    type="button"
                                    className="adm-pagination__btn"
                                    disabled={checkoutListPage >= checkoutListTotalPages}
                                    onClick={() => setCheckoutListPage((n) => Math.min(checkoutListTotalPages, n + 1))}
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="adm-pagination__foot muted">
                                {filteredCheckouts.length} checkout{filteredCheckouts.length === 1 ? "" : "s"}
                              </p>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </section>
                )}

                {tab === "searches" && (
                  <AdminSearchCatcherPanel searches={searchCatches} />
                )}

                {tab === "purchases" && (
                  <section className="adm-purchases-section">
                    {!purchases?.length ? (
                      <div className="adm-empty-state" role="status">
                        <p className="adm-empty-state__title">No orders yet</p>
                        <p className="adm-empty-state__text">Completed checkouts will show here automatically.</p>
                      </div>
                    ) : (
                      <>
                        <div className="adm-toolbar">
                          <label className="adm-toolbar__search">
                            <span className="adm-toolbar__label">Search</span>
                            <input
                              type="search"
                              className="adm-toolbar__input"
                              placeholder="Email, order #, session, area…"
                              value={purchaseQuery}
                              onChange={(e) => setPurchaseQuery(e.target.value)}
                              autoComplete="off"
                            />
                          </label>
                          <button
                            type="button"
                            className="adm-toolbar__export"
                            onClick={() =>
                              downloadAdminPurchasesCsv(
                                filteredPurchases,
                                `admin-purchases-${new Date().toISOString().slice(0, 10)}.csv`
                              )
                            }
                          >
                            Export CSV · {filteredPurchases.length}
                          </button>
                        </div>
                        {filteredPurchases.length === 0 ? (
                          <p className="muted adm-purchases-empty">No purchases match your search.</p>
                        ) : (
                          <>
                            <div className="adm-purchase-list">
                              {paginatedFilteredPurchases.map((p) => (
                                <AdminPurchaseCard
                                  key={p.sessionId}
                                  p={p}
                                  copiedId={copiedSession}
                                  onCopy={copySessionId}
                                  leadWorkBusy={leadWorkBusyId === p.sessionId}
                                  onLeadWorkChange={onLeadWorkChange}
                                />
                              ))}
                            </div>
                            {filteredPurchases.length > PURCHASES_PAGE_SIZE ? (
                              <div className="adm-pagination">
                                <span className="adm-pagination__meta">
                                  Showing {purchaseRangeStart}–{purchaseRangeEnd} of {filteredPurchases.length} · Page {purchaseListPage} of{" "}
                                  {purchaseListTotalPages}
                                </span>
                                <div className="adm-pagination__btns">
                                  <button
                                    type="button"
                                    className="adm-pagination__btn"
                                    disabled={purchaseListPage <= 1}
                                    onClick={() => setPurchaseListPage((n) => Math.max(1, n - 1))}
                                  >
                                    Previous
                                  </button>
                                  <button
                                    type="button"
                                    className="adm-pagination__btn"
                                    disabled={purchaseListPage >= purchaseListTotalPages}
                                    onClick={() => setPurchaseListPage((n) => Math.min(purchaseListTotalPages, n + 1))}
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="adm-pagination__foot muted">{filteredPurchases.length} order{filteredPurchases.length === 1 ? "" : "s"}</p>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        </main>
        <SiteFooter />
      </div>
      <style>{`
        main.adm-dash-premium.page-space--tight {
          background: linear-gradient(185deg, rgba(232, 244, 255, 0.5) 0%, #ffffff 24%, #f5f7fb 52%, #ffffff 100%);
        }
        .adm-dash-hero {
          margin-bottom: 1.35rem;
          padding: 1.35rem 1.5rem;
          border-radius: 20px;
          border: 1px solid rgba(0, 122, 255, 0.12);
          background: linear-gradient(145deg, #ffffff 0%, #eef6ff 42%, #f8fafc 100%);
          box-shadow: 0 8px 40px rgba(0, 122, 255, 0.1), 0 4px 24px rgba(15, 23, 42, 0.05), 0 0 0 1px rgba(255, 255, 255, 0.75) inset;
        }
        .adm-dash-hero__crumb {
          margin: 0 0 0.85rem;
          font-size: 0.8125rem;
        }
        .adm-dash-hero__row {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          gap: 1rem;
        }
        .adm-dash-hero__eyebrow {
          margin: 0 0 0.2rem;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #64748b;
        }
        .adm-dash-hero__title {
          margin: 0;
          font-size: clamp(1.5rem, 4vw, 1.85rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #0f172a;
        }
        .adm-dash-hero__title--gradient {
          background: linear-gradient(105deg, #0c1222 0%, #0066dd 44%, #1a9d40 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .adm-dash-hero__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .adm-dash-hero__btn {
          padding: 0.5rem 1rem;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: rgba(255, 255, 255, 0.85);
          font: inherit;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .adm-dash-hero__btn:hover {
          background: #fff;
          border-color: rgba(15, 23, 42, 0.14);
        }
        .adm-dash-hero__btn--primary {
          color: #fff;
          border-color: transparent;
          background: linear-gradient(135deg, #007aff 0%, #34c759 100%);
          box-shadow: 0 2px 12px rgba(0, 122, 255, 0.22);
        }
        .adm-dash-hero__btn--primary:hover {
          background: linear-gradient(135deg, #0066db 0%, #2ea548 100%);
          color: #fff;
          filter: none;
        }
        .adm-overview {
          padding: 1.35rem 1.45rem 1.5rem;
          border-radius: 22px;
          border: 1px solid rgba(0, 122, 255, 0.1);
          background: linear-gradient(168deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 248, 255, 0.65) 50%, #ffffff 100%);
          box-shadow: 0 6px 32px rgba(0, 122, 255, 0.08), 0 2px 12px rgba(15, 23, 42, 0.04);
        }
        .adm-overview__grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 0.85rem;
          margin-bottom: 1rem;
        }
        @media (min-width: 640px) {
          .adm-overview__grid {
            grid-template-columns: repeat(4, 1fr);
          }
          .adm-stat-card--wide {
            grid-column: span 2;
          }
        }
        .adm-stat-card {
          position: relative;
          padding: 1.15rem 1.15rem 1.1rem;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.06);
          background: linear-gradient(165deg, #ffffff, #fafbfc);
          box-shadow: 0 2px 14px rgba(15, 23, 42, 0.04);
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          overflow: hidden;
        }
        .adm-stat-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #007aff, #34c759);
          opacity: 0.88;
        }
        .adm-stat-card__label {
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #64748b;
        }
        .adm-stat-card__value {
          font-size: 1.35rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
          line-height: 1.15;
        }
        .adm-overview__meta {
          margin: 0 0 1.1rem;
          font-size: 0.8125rem;
          color: #64748b;
        }
        .adm-recent-purchases {
          margin: 0 0 1rem;
          padding: 1rem 1.1rem;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.92);
        }
        .adm-recent-purchases__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.65rem;
        }
        .adm-recent-purchases__title {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
        }
        .adm-recent-purchases__link {
          font-size: 0.82rem;
          font-weight: 600;
          color: #007aff;
          text-decoration: none;
        }
        .adm-recent-purchases__list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }
        .adm-recent-purchases__item {
          padding-bottom: 0.65rem;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        }
        .adm-recent-purchases__item:last-child {
          padding-bottom: 0;
          border-bottom: none;
        }
        .adm-recent-purchases__main,
        .adm-recent-purchases__meta {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          font-size: 0.82rem;
          color: #334155;
        }
        .adm-recent-purchases__main {
          font-size: 0.88rem;
          margin-bottom: 0.2rem;
        }
        .adm-recent-purchases__meta span:last-child {
          color: #64748b;
          text-align: right;
        }
        .adm-recent-purchases__time {
          display: block;
          margin-top: 0.2rem;
          font-size: 0.78rem;
          color: #94a3b8;
        }
        .adm-purchase-card__listing {
          margin: 0.35rem 0 0.5rem;
        }
        .adm-purchase-card__mls {
          margin: 0 0 0.2rem;
          font-size: 0.9rem;
          font-weight: 700;
          color: #0f172a;
        }
        .adm-purchase-card__address,
        .adm-purchase-card__agent {
          margin: 0.15rem 0 0;
          font-size: 0.82rem;
          color: #475569;
          line-height: 1.4;
        }
        .adm-purchase-card__phone {
          font-size: 0.82rem;
          color: #64748b;
        }
        .adm-funnel-stopped {
          margin: 0 0 1rem;
          padding: 1rem 1.1rem;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.92);
        }
        .adm-funnel-stopped--tab {
          margin-top: 0;
        }
        .adm-funnel-stopped .adm-recent-purchases__head .adm-funnel-stopped__title {
          margin: 0;
        }
        .adm-funnel-stopped__title {
          margin: 0 0 0.65rem;
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
        }
        .adm-funnel-stopped__list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .adm-funnel-stopped__item {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 0.65rem;
          align-items: start;
          font-size: 0.82rem;
          color: #334155;
        }
        .adm-funnel-stopped__body {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          min-width: 0;
        }
        .adm-funnel-stopped__listing {
          color: #0f172a;
          font-weight: 600;
        }
        .adm-funnel-stopped__link {
          color: #1d4ed8;
          font-weight: 600;
          width: fit-content;
        }
        .adm-funnel-stopped__status {
          font-weight: 700;
          text-transform: capitalize;
          color: #b45309;
        }
        .adm-funnel-stopped__time {
          color: #64748b;
          white-space: nowrap;
        }
        .adm-overview__cta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
        }
        .adm-account {
          margin-top: 0.35rem;
        }
        .adm-cta-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.6rem 1.15rem;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: #fff;
          font-size: 0.875rem;
          font-weight: 600;
          color: #334155;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .adm-cta-btn:hover {
          background: rgba(0, 122, 255, 0.06);
          border-color: rgba(0, 122, 255, 0.22);
          color: #0f172a;
        }
        .adm-cta-btn--solid {
          color: #fff;
          border-color: transparent;
          background: linear-gradient(135deg, #007aff 0%, #34c759 100%);
          box-shadow: 0 2px 12px rgba(0, 122, 255, 0.2);
        }
        .adm-cta-btn--solid:hover {
          background: linear-gradient(135deg, #0066db 0%, #2ea548 100%);
          color: #fff;
          filter: none;
        }
        .adm-cta-btn--solid:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          filter: none;
        }
        .adm-empty-state {
          padding: 2.5rem 1.5rem;
          text-align: center;
          border-radius: 20px;
          border: 1px dashed rgba(15, 23, 42, 0.1);
          background: linear-gradient(180deg, rgba(248, 250, 252, 0.9), #fff);
        }
        .adm-empty-state__title {
          margin: 0 0 0.4rem;
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f172a;
        }
        .adm-empty-state__text {
          margin: 0;
          font-size: 0.9rem;
          color: #64748b;
          max-width: 22rem;
          margin-left: auto;
          margin-right: auto;
        }
        .adm-support {
          margin-top: 1.75rem;
          padding: 1.35rem 1.45rem;
          border-radius: 18px;
          border: 1px solid rgba(15, 23, 42, 0.07);
          background: linear-gradient(160deg, #ffffff, #f8fafc);
          box-shadow: 0 2px 16px rgba(15, 23, 42, 0.05);
        }
        .adm-support__title {
          margin: 0 0 0.35rem;
          font-size: 0.9375rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
        }
        .adm-support__sub {
          margin: 0 0 1rem;
          font-size: 0.8125rem;
          line-height: 1.5;
          color: #64748b;
        }
        .adm-support__row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
          align-items: center;
        }
        .adm-support__stack {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          max-width: 420px;
        }
        /* Base input uses flex: 1 1 for horizontal rows — in a column stack that grows inputs; keep these compact. */
        .adm-support__stack .adm-support__input.adm-support__input--full {
          flex: 0 0 auto;
          width: 100%;
          box-sizing: border-box;
          min-height: 0;
          height: 2.35rem;
          padding: 0.4rem 0.75rem;
          line-height: 1.2;
          font-size: 0.875rem;
        }
        .adm-support__input {
          flex: 1 1 200px;
          min-width: 0;
          padding: 0.6rem 0.85rem;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          font: inherit;
          font-size: 0.9rem;
        }
        .adm-support__input:focus {
          outline: none;
          border-color: rgba(0, 122, 255, 0.45);
          box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.12);
        }
        .adm-support__out {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.65rem;
          margin-top: 0.85rem;
          padding: 0.75rem 0.85rem;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.04);
          border: 1px solid rgba(15, 23, 42, 0.06);
        }
        .adm-support__url {
          flex: 1 1 200px;
          min-width: 0;
          font-size: 0.75rem;
          word-break: break-all;
          color: #475569;
        }
        .adm-support__copy {
          padding: 0.4rem 0.85rem;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          font: inherit;
          font-size: 0.78rem;
          font-weight: 600;
          color: #007aff;
          cursor: pointer;
        }
        .adm-support__copy:hover {
          background: rgba(0, 122, 255, 0.08);
        }
        .adm-dash-premium .adm-dash-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          padding: 0.35rem;
          margin-bottom: 1.5rem;
          background: linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,250,252,0.98));
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .adm-dash-nav__link {
          padding: 0.55rem 1rem;
          border-radius: 10px;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--muted, #64748b);
          text-decoration: none;
          border: 1px solid transparent;
          transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
        }
        .adm-dash-nav__link:hover {
          color: var(--text, #0f172a);
          background: rgba(0, 122, 255, 0.06);
        }
        .adm-dash-nav__link.is-active {
          color: #fff;
          background: linear-gradient(135deg, #007aff 0%, #34c759 100%);
          border-color: transparent;
          box-shadow: 0 2px 8px rgba(0, 122, 255, 0.25);
        }
        .adm-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          gap: 1rem;
          margin-bottom: 1.25rem;
          padding: 1rem 1.15rem;
          background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96));
          border: 1px solid rgba(15, 23, 42, 0.07);
          border-radius: 16px;
          box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06);
        }
        .adm-toolbar__search {
          flex: 1 1 220px;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          min-width: 0;
        }
        .adm-toolbar__label {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--muted, #64748b);
        }
        .adm-toolbar__input {
          width: 100%;
          padding: 0.65rem 0.85rem;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: #fff;
          font: inherit;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .adm-toolbar__input:focus {
          border-color: rgba(0, 122, 255, 0.45);
          box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.12);
        }
        .adm-toolbar__export {
          padding: 0.65rem 1.1rem;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          font: inherit;
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text, #0f172a);
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .adm-toolbar__export:hover {
          background: rgba(0, 122, 255, 0.06);
          border-color: rgba(0, 122, 255, 0.25);
        }
        .adm-purchase-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .adm-purchase-card {
          padding: 1.2rem 1.35rem;
          border-radius: 18px;
          border: 1px solid transparent;
          background:
            linear-gradient(165deg, #ffffff 0%, #fafbfc 100%) padding-box,
            linear-gradient(125deg, rgba(0, 122, 255, 0.45), rgba(52, 199, 89, 0.45)) border-box;
          box-shadow: 0 4px 20px rgba(0, 122, 255, 0.07), 0 2px 12px rgba(15, 23, 42, 0.05), 0 0 0 1px rgba(255, 255, 255, 0.85) inset;
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .adm-purchase-card:hover {
          box-shadow: 0 12px 36px rgba(0, 122, 255, 0.12), 0 8px 24px rgba(15, 23, 42, 0.07), 0 0 0 1px rgba(255, 255, 255, 0.95) inset;
          transform: translateY(-2px);
        }
        .adm-purchase-card__header {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem 1rem;
          margin-bottom: 0.65rem;
        }
        .adm-purchase-card__title-block {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.45rem;
        }
        .adm-purchase-card__badges {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.35rem;
        }
        .adm-purchase-card__badge {
          display: inline-block;
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .adm-purchase-card__badge--lead {
          background: linear-gradient(135deg, rgba(52, 199, 89, 0.15), rgba(0, 122, 255, 0.12));
          color: #0f5132;
          border: 1px solid rgba(52, 199, 89, 0.25);
        }
        .adm-purchase-card__badge--campaign {
          background: rgba(0, 122, 255, 0.1);
          color: #004085;
          border: 1px solid rgba(0, 122, 255, 0.2);
        }
        .adm-purchase-card__badge--other {
          background: rgba(100, 116, 139, 0.12);
          color: #334155;
          border: 1px solid rgba(100, 116, 139, 0.2);
        }
        .adm-purchase-card__badge--source {
          background: rgba(124, 58, 237, 0.1);
          color: #5b21b6;
          border: 1px solid rgba(124, 58, 237, 0.22);
        }
        .adm-purchase-card__order {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--text, #0f172a);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .adm-purchase-card__price {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text, #0f172a);
          letter-spacing: -0.02em;
        }
        .adm-purchase-card__sub {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem 1rem;
          margin-bottom: 0.85rem;
          padding-bottom: 0.85rem;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        }
        .adm-purchase-card__email {
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text, #1e293b);
        }
        .adm-purchase-card__time {
          font-size: 0.82rem;
          color: var(--muted, #64748b);
        }
        .adm-purchase-card__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          margin-bottom: 0.75rem;
        }
        .adm-chip {
          display: inline-flex;
          align-items: baseline;
          gap: 0.35rem;
          padding: 0.35rem 0.65rem;
          border-radius: 10px;
          font-size: 0.8rem;
          background: rgba(15, 23, 42, 0.04);
          border: 1px solid rgba(15, 23, 42, 0.06);
          color: var(--text, #334155);
        }
        .adm-chip--wide {
          flex: 1 1 100%;
        }
        .adm-chip__k {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--muted, #64748b);
        }
        .adm-purchase-card__product {
          margin: 0 0 0.75rem;
          font-size: 0.88rem;
          line-height: 1.45;
          color: var(--muted, #475569);
        }
        .adm-purchase-card__leadwork {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.65rem;
          margin-bottom: 0.75rem;
          padding: 0.65rem 0.75rem;
          border-radius: 12px;
          background: rgba(0, 122, 255, 0.05);
          border: 1px solid rgba(0, 122, 255, 0.12);
        }
        .adm-purchase-card__leadwork-info {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem 0.75rem;
          min-width: 0;
        }
        .adm-purchase-card__leadwork-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
        }
        .adm-lead-pill {
          font-size: 0.78rem;
          font-weight: 700;
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.15);
          color: #92400e;
          border: 1px solid rgba(245, 158, 11, 0.35);
        }
        .adm-lead-pill--done {
          background: rgba(52, 199, 89, 0.14);
          color: #0f5132;
          border-color: rgba(52, 199, 89, 0.35);
        }
        .adm-purchase-card__leadwork-btn {
          padding: 0.4rem 0.85rem;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          font: inherit;
          font-size: 0.8rem;
          font-weight: 600;
          color: #0f172a;
          cursor: pointer;
          flex-shrink: 0;
        }
        .adm-purchase-card__leadwork-btn:hover:not(:disabled) {
          background: rgba(0, 122, 255, 0.08);
          border-color: rgba(0, 122, 255, 0.25);
        }
        .adm-purchase-card__leadwork-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .adm-purchase-card__stripe {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.65rem;
          padding-top: 0.65rem;
          border-top: 1px dashed rgba(15, 23, 42, 0.08);
        }
        .adm-purchase-card__session {
          font-size: 0.75rem;
          color: #64748b;
          background: rgba(15, 23, 42, 0.04);
          padding: 0.35rem 0.55rem;
          border-radius: 8px;
          max-width: min(100%, 320px);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .adm-purchase-card__copy {
          padding: 0.35rem 0.75rem;
          border-radius: 8px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          font: inherit;
          font-size: 0.78rem;
          font-weight: 600;
          color: #007aff;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .adm-purchase-card__copy:hover {
          background: rgba(0, 122, 255, 0.08);
        }
        .adm-pagination {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.85rem;
          margin-top: 1.25rem;
          padding: 1rem 1.15rem;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.07);
          background: linear-gradient(165deg, rgba(255, 255, 255, 0.98), rgba(240, 249, 255, 0.5));
          box-shadow: 0 4px 22px rgba(15, 23, 42, 0.06);
        }
        .adm-pagination__meta {
          font-size: 0.88rem;
          color: #64748b;
        }
        .adm-pagination__btns {
          display: flex;
          gap: 0.5rem;
        }
        .adm-pagination__btn {
          padding: 0.45rem 1rem;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          font: inherit;
          font-size: 0.84rem;
          font-weight: 600;
          color: #0f172a;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .adm-pagination__btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(0, 122, 255, 0.12), rgba(52, 199, 89, 0.1));
          border-color: rgba(0, 122, 255, 0.3);
        }
        .adm-pagination__btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .adm-pagination__foot {
          margin: 0.85rem 0 0;
          font-size: 0.85rem;
        }
        .adm-purchases-empty {
          padding: 2rem;
          text-align: center;
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.03);
        }
        .adm-dash-premium .adm-dash-container {
          box-sizing: border-box;
          padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
        }
        @media (max-width: 640px) {
          .adm-dash-hero__row {
            flex-direction: column;
            align-items: stretch;
          }
          .adm-dash-hero__actions {
            justify-content: flex-start;
          }
          .adm-support__row {
            flex-direction: column;
            align-items: stretch;
          }
          .adm-support__row .adm-cta-btn--solid {
            width: 100%;
            justify-content: center;
          }
          .adm-toolbar {
            flex-direction: column;
            align-items: stretch;
          }
          .adm-toolbar__export {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
