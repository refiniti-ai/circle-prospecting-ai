import { useMemo, useState } from "react";
import type { AdminSearchCatchRow } from "../../lib/searchCatcherApi";

function csvEscape(cell: string): string {
  const s = String(cell ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadSearchCsv(rows: AdminSearchCatchRow[], filename: string) {
  const header = [
    "createdAt",
    "kind",
    "query",
    "page",
    "source",
    "found",
    "resultCount",
    "matchedName",
    "matchedEmail",
    "matchedPhone",
    "matchedMls",
    "pagePath",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.createdAt,
        r.kind,
        r.query,
        r.page,
        sourceLabel(r.source) || r.source || "",
        r.found ? "yes" : "no",
        String(r.resultCount),
        r.matchedName ?? "",
        r.matchedEmail ?? "",
        r.matchedPhone ?? "",
        r.matchedMls ?? "",
        r.pagePath ? searchLink(r.pagePath) : "",
      ]
        .map(csvEscape)
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

function kindLabel(kind: AdminSearchCatchRow["kind"]): string {
  if (kind === "mls") return "MLS";
  if (kind === "email") return "Email";
  if (kind === "phone") return "Phone";
  if (kind === "address") return "Address";
  return "Agent";
}

function pageLabel(page: string): string {
  if (page === "99promo" || page === "first-time-customer") return "$99 intro";
  if (page === "search-agent") return "Agent search";
  if (page === "buy-leads") return "Buy leads";
  return page || "—";
}

function sourceLabel(source?: string): string {
  const s = (source || "").trim().toLowerCase();
  if (s === "facebook") return "Facebook";
  if (s === "instagram") return "Instagram";
  if (s === "google") return "Google";
  if (s === "email") return "Email";
  if (s === "website") return "Website";
  return "";
}

function searchLink(pagePath?: string | null): string {
  const p = (pagePath || "").trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return p.startsWith("/") ? `https://circleprospecting.ai${p}` : "";
}

export function AdminSearchCatcherPanel({
  searches,
  loading,
}: {
  searches: AdminSearchCatchRow[] | null;
  loading?: boolean;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const rows = searches ?? [];
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter((r) =>
      [r.query, r.kind, r.page, r.pagePath, sourceLabel(r.source), r.source, r.matchedName, r.matchedEmail, r.matchedPhone, r.matchedMls]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(n)
    );
  }, [searches, q]);

  if (loading && !searches) {
    return <p className="muted">Loading searches…</p>;
  }

  if (!searches?.length) {
    return (
      <div className="adm-empty-state" role="status">
        <p className="adm-empty-state__title">No searches yet</p>
        <p className="adm-empty-state__text">Email, phone, MLS, and address lookups will show here.</p>
      </div>
    );
  }

  return (
    <section className="adm-purchases-section">
      <div className="adm-toolbar">
        <label className="adm-toolbar__search">
          <span className="adm-toolbar__label">Filter</span>
          <input
            type="search"
            className="adm-toolbar__input"
            placeholder="Email, phone, MLS, source…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          className="adm-toolbar__export"
          onClick={() =>
            downloadSearchCsv(filtered, `admin-searches-${new Date().toISOString().slice(0, 10)}.csv`)
          }
        >
          Export CSV · {filtered.length}
        </button>
      </div>
      {filtered.length === 0 ? (
        <p className="muted adm-purchases-empty">No searches match your filter.</p>
      ) : (
        <div className="adm-purchase-list">
          {filtered.map((r) => (
            <article key={r.id} className="adm-purchase-card">
              <div className="adm-purchase-card__header">
                <div className="adm-purchase-card__title-block">
                  <div className="adm-purchase-card__badges">
                    <span className="adm-purchase-card__badge">{kindLabel(r.kind)}</span>
                    {sourceLabel(r.source) ? (
                      <span className="adm-purchase-card__badge adm-purchase-card__badge--source">{sourceLabel(r.source)}</span>
                    ) : null}
                  </div>
                  <h3 className="adm-purchase-card__order">{r.query}</h3>
                </div>
                <div className="adm-purchase-card__price">{r.found ? `${r.resultCount} found` : "No match"}</div>
              </div>
              <div className="adm-purchase-card__sub">
                <span className="adm-purchase-card__email">{pageLabel(r.page)}</span>
                <time className="adm-purchase-card__time" dateTime={r.createdAt}>
                  {r.createdAt ? new Date(r.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
                </time>
              </div>
              {searchLink(r.pagePath) ? (
                <p className="adm-purchase-card__product">
                  <a href={searchLink(r.pagePath)} target="_blank" rel="noreferrer">
                    {searchLink(r.pagePath)}
                  </a>
                </p>
              ) : null}
              {r.matchedName || r.matchedEmail || r.matchedPhone || r.matchedMls ? (
                <p className="adm-purchase-card__product">
                  {[r.matchedName, r.matchedEmail, r.matchedPhone, r.matchedMls ? `MLS ${r.matchedMls}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
