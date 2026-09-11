import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AddressAutocompleteInput } from "./AddressAutocompleteInput";
import {
  fetchGhlContactPrefill,
  geocodeAddressLine,
  MultipleGhlMlsHitsError,
  resolveListingByMls,
  searchGhlContacts,
  type GhlContactSearchHit,
  ghlSearchUserMessage,
} from "../lib/buyLeadsSearchApi";
import { geocodeUserMessage } from "../lib/geocodeAddress";
import {
  agentRoleFromGhlHit,
  agentRoleFromListingPayload,
  campaignPathFromListingPayload,
  ghlHitAgentLabel,
  resolveGhlHitsForSearch,
} from "../lib/ghlContactRole";
import { resolveCampaignPath } from "../lib/mlsCampaignPath";
import type { ListingAgentRole } from "../lib/listingAgents";
import { buildMlsLeadsUrl } from "../lib/mlsUrl";
import type { ParsedPlaceAddress } from "../lib/placesAddress";
import type { ListingFormValues, ListingPayload } from "../lib/listingData";
import { buildListingFromGhlPrefill, ghlHitToListingForm } from "../lib/listingDraft";
import {
  formatListingDisplayAddress,
  parseListingAddressLine,
} from "../lib/listingData";

export type BuyLeadsSearchResult =
  | { kind: "listing"; listing: ListingPayload }
  | { kind: "address"; form: ListingFormValues; geo: { lat: number; lng: number; county: string } };

type SearchMode = "listing" | "agent";

function searchStatusClass(message: string): string {
  const base = "buy-search-status";
  const m = message.toLowerCase();
  if (m.includes("refine the address") || m.includes("map looks wrong")) {
    return `${base} buy-search-status--notice`;
  }
  if (
    m.includes("geocode_") ||
    m.includes("no ") ||
    m.includes("could not") ||
    m.includes("failed") ||
    m.includes("not found") ||
    m.includes("enter an") ||
    m.includes("enter at least")
  ) {
    return `${base} buy-search-status--warn`;
  }
  if (
    (m.includes("loaded") || m.includes("updated") || m.includes("selected") || m.includes("found")) &&
    !m.includes("not found")
  ) {
    return `${base} buy-search-status--success`;
  }
  return base;
}

type Props = {
  disabled?: boolean;
  initialMls?: string;
  /** Sync property address when a listing loads from URL / GHL (not user typing). */
  prefillAddress?: string;
  /** Multiple GHL contacts for same MLS (from URL auto-load). */
  pendingListingHits?: GhlContactSearchHit[];
  pendingListingHitsMessage?: string;
  /** From /buyer/mls/… or /seller/mls/… — only show that agent type in MLS search. */
  searchAgentRole?: ListingAgentRole | null;
  /** From ?c= on welcome link — prefer this contact when filtering. */
  contactIdFromUrl?: string | null;
  /** Optional override — defaults to agent-first search. */
  defaultMode?: SearchMode;
  heading?: string;
  introText?: ReactNode;
  className?: string;
  agentFieldLabel?: string;
  agentPlaceholder?: string;
  agentHint?: string;
  agentSearchButtonLabel?: string;
  /** When false, loaded listings stay on this page via onResult (intro funnel). Default true = navigate to /buy-leads MLS URL. */
  navigateOnResult?: boolean;
  /** When set, agent pick navigates here instead of loading a listing inline (buy-leads entry). */
  onAgentPick?: (hit: GhlContactSearchHit) => void;
  onResult: (result: BuyLeadsSearchResult) => void;
  onError?: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
};

export function BuyLeadsSearch({
  disabled,
  initialMls,
  prefillAddress,
  pendingListingHits,
  pendingListingHitsMessage,
  searchAgentRole,
  contactIdFromUrl,
  defaultMode = "agent",
  heading = "Search for Your Listing",
  introText,
  className,
  agentFieldLabel = "Agent name, email, or phone",
  agentPlaceholder = "Maria Garcia or maria@… or 727-555-0100",
  agentHint = "Search your GoHighLevel contacts by name, email, or phone — then pick a match to pre-fill the order.",
  agentSearchButtonLabel = "Find agent",
  navigateOnResult = true,
  onAgentPick,
  onResult,
  onError,
  onBusyChange,
}: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SearchMode>(defaultMode);
  const [mls, setMls] = useState(initialMls?.trim() ?? "");
  const [addressLine, setAddressLine] = useState("");
  const [agentQuery, setAgentQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [listingHits, setListingHits] = useState<GhlContactSearchHit[]>([]);
  const [agentHits, setAgentHits] = useState<GhlContactSearchHit[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const reportError = useCallback(
    (msg: string) => {
      setStatus(msg);
      onError?.(msg);
    },
    [onError]
  );

  const applyGhlContact = useCallback(
    async (hit: GhlContactSearchHit) => {
      setBusy(true);
      setStatus(null);
      setListingHits([]);
      setAgentHits([]);
      try {
        const full = await fetchGhlContactPrefill(hit.id);
        const form = ghlHitToListingForm(full);
        if (full.mls) setMls(full.mls);
        setAddressLine(formatListingDisplayAddress(form));

        const draft = buildListingFromGhlPrefill(full);
        const mlsId = (full.mls || form.mls).trim();
        const campaignPath = resolveCampaignPath({
          listingType: full.listingType,
          agentType: full.agentType,
          agentRole: agentRoleFromGhlHit(full) ?? undefined,
        });
        setStatus(`Loaded ${full.name || "listing"}${full.mls ? ` · MLS ${full.mls}` : ""}.`);
        if (mlsId && navigateOnResult) {
          navigate(
            buildMlsLeadsUrl(mlsId, { campaignPath }),
            { replace: true, state: { preloadedListing: draft } }
          );
        } else {
          onResult({ kind: "listing", listing: draft });
        }
      } catch (e) {
        reportError(geocodeUserMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [navigate, navigateOnResult, onResult, reportError]
  );

  const handleMultipleMlsHits = useCallback(
    (hits: GhlContactSearchHit[], mlsQ: string) => {
      const { visible, autoPick } = resolveGhlHitsForSearch(hits, {
        agentRole: searchAgentRole,
        contactId: contactIdFromUrl,
      });
      if (autoPick) {
        void applyGhlContact(autoPick);
        return;
      }
      if (!visible.length) {
        const roleHint =
          searchAgentRole === "buyer"
            ? "buyer's agent"
            : searchAgentRole === "seller"
              ? "listing agent"
              : "agent";
        reportError(
          `No ${roleHint} record found for MLS ${mlsQ}. Open the personalized link from your welcome email, or search by your name under By agent.`
        );
        return;
      }
      setListingHits(visible);
      const roleNote = searchAgentRole
        ? searchAgentRole === "buyer"
          ? " (buyer's agent)"
          : " (listing agent)"
        : "";
      setStatus(`${visible.length} match${visible.length === 1 ? "" : "es"} for MLS ${mlsQ}${roleNote} — select one below.`);
    },
    [applyGhlContact, contactIdFromUrl, reportError, searchAgentRole]
  );

  const onFindListing = useCallback(async () => {
    const mlsQ = mls.trim();
    const addrQ = addressLine.trim();
    if (!mlsQ && !addrQ) {
      reportError("Enter an MLS number or property address.");
      return;
    }

    setBusy(true);
    setStatus(null);
    setListingHits([]);
    setAgentHits([]);

    try {
      if (mlsQ) {
        try {
          const listing = await resolveListingByMls(mlsQ, {
            agentRole: searchAgentRole,
            contactId: contactIdFromUrl,
            autoPickMultiple: Boolean(searchAgentRole || contactIdFromUrl),
          });
          const campaignPath =
            campaignPathFromListingPayload(listing) ??
            resolveCampaignPath({
              listingType: listing.listingType,
              agentType: listing.agentType,
              agentRole: agentRoleFromListingPayload(listing) ?? searchAgentRole ?? undefined,
            });
          setStatus(`Loaded listing ${listing.mls}.`);
          if (navigateOnResult) {
            navigate(
              buildMlsLeadsUrl(listing.mls, { campaignPath }),
              { replace: true, state: { preloadedListing: listing } }
            );
          } else {
            onResult({ kind: "listing", listing });
          }
          return;
        } catch (e) {
          if (e instanceof MultipleGhlMlsHitsError) {
            handleMultipleMlsHits(e.hits, mlsQ);
            return;
          }
          if (!addrQ) {
            reportError(
              e instanceof Error && !e.message.startsWith("geocode_")
                ? e.message
                : `No GHL contact found for MLS ${mlsQ}. Add the MLS on the contact in GoHighLevel, or enter the property address.`
            );
            return;
          }
        }
      }

      const parsed = parseListingAddressLine(addrQ);
      const form: ListingFormValues = {
        mls: mlsQ,
        agentName: "",
        email: "",
        phone: "",
        brokerage: "",
        streetAddress: parsed.streetAddress,
        city: parsed.city,
        stateCode: parsed.stateCode,
        zip: parsed.zip,
      };
      const geo = await geocodeAddressLine(addrQ);
      setStatus("Address loaded — map and checkout fields updated.");
      onResult({ kind: "address", form, geo });
    } catch (e) {
      reportError(geocodeUserMessage(e));
    } finally {
      setBusy(false);
    }
  }, [addressLine, contactIdFromUrl, handleMultipleMlsHits, mls, navigate, navigateOnResult, onResult, reportError, searchAgentRole]);

  const onAgentSearch = useCallback(async () => {
    const q = agentQuery.trim();
    if (q.length < 2) {
      reportError("Enter at least 2 characters (name, email, or phone).");
      return;
    }

    setBusy(true);
    setStatus(null);
    setListingHits([]);
    setAgentHits([]);

    try {
      const hits = await searchGhlContacts(q);
      setAgentHits(hits);
      if (!hits.length) {
        setStatus("No contacts matched. Try a different name, email, or phone.");
      } else {
        setStatus(`${hits.length} contact${hits.length === 1 ? "" : "s"} found — select one below.`);
      }
    } catch (e) {
      reportError(ghlSearchUserMessage(e));
    } finally {
      setBusy(false);
    }
  }, [agentQuery, reportError]);

  useEffect(() => {
    const id = initialMls?.trim() ?? "";
    if (id) setMls(id);
  }, [initialMls]);

  useEffect(() => {
    const line = prefillAddress?.trim() ?? "";
    if (line) setAddressLine(line);
  }, [prefillAddress]);

  useEffect(() => {
    if (!pendingListingHits?.length) return;
    setMode("listing");
    const { visible, autoPick } = resolveGhlHitsForSearch(pendingListingHits, {
      agentRole: searchAgentRole,
      contactId: contactIdFromUrl,
    });
    if (autoPick) {
      void applyGhlContact(autoPick);
      return;
    }
    if (!visible.length) return;
    setListingHits(visible);
    setStatus(
      pendingListingHitsMessage ??
        `${visible.length} match${visible.length === 1 ? "" : "es"} — select one below.`
    );
  }, [
    applyGhlContact,
    contactIdFromUrl,
    pendingListingHits,
    pendingListingHitsMessage,
    searchAgentRole,
  ]);

  const onAddressPlace = useCallback(
    (place: ParsedPlaceAddress) => {
      const form: ListingFormValues = {
        mls: mls.trim(),
        agentName: "",
        email: "",
        phone: "",
        brokerage: "",
        streetAddress: place.streetLine,
        city: place.city,
        stateCode: place.stateCode,
        zip: place.zip,
      };
      setAddressLine(place.formattedAddress);
      setStatus("Address selected — click Find listing to load the campaign.");
      onResult({
        kind: "address",
        form,
        geo: { lat: place.lat, lng: place.lng, county: place.county },
      });
    },
    [mls, onResult]
  );

  const onPickListingHit = useCallback(
    (hit: GhlContactSearchHit) => {
      void applyGhlContact(hit);
    },
    [applyGhlContact]
  );

  const onPickAgentHit = useCallback(
    (hit: GhlContactSearchHit) => {
      if (onAgentPick) {
        onAgentPick(hit);
        return;
      }
      void applyGhlContact(hit);
    },
    [applyGhlContact, onAgentPick]
  );

  const switchMode = useCallback((next: SearchMode) => {
    setMode(next);
    setStatus(null);
    setListingHits([]);
    setAgentHits([]);
  }, []);

  const resolvedIntro = introText ?? (
    <>
      Find a property by <strong>MLS #</strong> or <strong>address</strong>.
    </>
  );

  return (
    <section
      className={`buy-search section-surface buy-card${className ? ` ${className}` : ""}`}
      aria-label="Search for your listing"
    >
      {heading.trim() ? <h2 className="premium-h2">{heading}</h2> : null}
      <p className="buy-search-intro muted">{resolvedIntro}</p>

      <fieldset className="buy-search-mode" aria-label="Search mode">
        <label className="buy-search-mode__option">
          <input
            type="radio"
            name="buy-search-mode"
            checked={mode === "agent"}
            disabled={disabled || busy}
            onChange={() => switchMode("agent")}
          />
          By agent
        </label>
        <label className="buy-search-mode__option">
          <input
            type="radio"
            name="buy-search-mode"
            checked={mode === "listing"}
            disabled={disabled || busy}
            onChange={() => switchMode("listing")}
          />
          By listing
        </label>
      </fieldset>

      {mode === "listing" ? (
        <div className="buy-search-panel">
          <div className="buy-search-row buy-search-row--listing">
            <label className="cp-form-grid buy-search-field buy-search-field--mls">
              <span className="muted-label buy-search-label">MLS #</span>
              <input
                type="text"
                className="premium-input buy-search-input"
                value={mls}
                onChange={(e) => setMls(e.target.value)}
                placeholder="TB88604696"
                disabled={disabled || busy}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onFindListing();
                }}
              />
            </label>
            <span className="buy-search-or-inline muted" aria-hidden>
              or
            </span>
            <label className="cp-form-grid buy-search-field buy-search-field--address">
              <span className="muted-label buy-search-label">Property address</span>
              <AddressAutocompleteInput
                value={addressLine}
                onChange={setAddressLine}
                onPlaceSelect={onAddressPlace}
                disabled={disabled || busy}
                placeholder="Start typing street address…"
                onEnter={() => void onFindListing()}
                className="premium-input buy-search-input"
              />
            </label>
            <button
              type="button"
              className={`btn btn-primary buy-search-btn${busy ? " buy-search-btn--loading" : ""}`}
              disabled={disabled || busy}
              aria-busy={busy}
              onClick={() => void onFindListing()}
            >
              {busy ? (
                <span className="cp-loading-line buy-search-btn__loading">Loading listing…</span>
              ) : (
                "Find listing"
              )}
            </button>
          </div>
          {listingHits.length > 0 ? (
            <ul className="buy-search-hits">
              {listingHits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className="buy-search-hit"
                    disabled={disabled || busy}
                    onClick={() => onPickListingHit(hit)}
                  >
                    <strong>
                      {hit.mls ? `MLS ${hit.mls}` : "Listing match"}
                      <span className="buy-search-hit__role"> · {ghlHitAgentLabel(hit)}</span>
                    </strong>
                    <span>
                      {[hit.name, hit.listingAddress, hit.email, hit.phone].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="buy-search-hint muted">
            MLS or street address — suggestions appear as you type. You can also edit the full address in Step 1 below.
          </p>
        </div>
      ) : (
        <div className="buy-search-panel">
          <div className="buy-search-row buy-search-row--agent">
            <label className="cp-form-grid buy-search-field buy-search-field--agent">
              <span className="muted-label buy-search-label">{agentFieldLabel}</span>
              <input
                type="search"
                className="premium-input buy-search-input"
                value={agentQuery}
                onChange={(e) => setAgentQuery(e.target.value)}
                placeholder={agentPlaceholder}
                disabled={disabled || busy}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onAgentSearch();
                }}
              />
            </label>
            <button
              type="button"
              className={`btn btn-primary buy-search-btn${busy ? " buy-search-btn--loading" : ""}`}
              disabled={disabled || busy}
              aria-busy={busy}
              onClick={() => void onAgentSearch()}
            >
              {busy ? (
                <span className="cp-loading-line buy-search-btn__loading">Searching…</span>
              ) : (
                agentSearchButtonLabel
              )}
            </button>
          </div>
          {agentHits.length > 0 ? (
            <ul className="buy-search-hits">
              {agentHits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className="buy-search-hit"
                    disabled={disabled || busy}
                    onClick={() => onPickAgentHit(hit)}
                  >
                    <strong className="buy-search-hit__name">{hit.name}</strong>
                    <span className="buy-search-hit__meta">
                      {[hit.email, hit.phone].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="buy-search-hint muted">{agentHint}</p>
        </div>
      )}

      {status ? (
        <p className={searchStatusClass(status)} role="status">
          {status}
        </p>
      ) : null}
    </section>
  );
}
