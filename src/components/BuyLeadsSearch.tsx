import { useCallback, useState } from "react";
import { AddressAutocompleteInput } from "./AddressAutocompleteInput";
import {
  fetchGhlContactPrefill,
  geocodeAddressLine,
  searchGhlContacts,
  searchListingByMls,
  type GhlContactSearchHit,
} from "../lib/buyLeadsSearchApi";
import type { ParsedPlaceAddress } from "../lib/placesAddress";
import type { ListingFormValues, ListingPayload } from "../lib/listingData";
import { buildDraftListingFromForm, ghlHitToListingForm, parseListingAddressLine } from "../lib/listingDraft";
import { listingAddressGeocodeQuery } from "../lib/listingData";

export type BuyLeadsSearchResult =
  | { kind: "listing"; listing: ListingPayload }
  | { kind: "address"; form: ListingFormValues; geo: { lat: number; lng: number; county: string } };

type Tab = "listing" | "agent";

type Props = {
  disabled?: boolean;
  onResult: (result: BuyLeadsSearchResult) => void;
  onError?: (message: string) => void;
};

export function BuyLeadsSearch({ disabled, onResult, onError }: Props) {
  const [tab, setTab] = useState<Tab>("listing");
  const [mls, setMls] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [agentQuery, setAgentQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [agentHits, setAgentHits] = useState<GhlContactSearchHit[]>([]);
  const [listingHits, setListingHits] = useState<GhlContactSearchHit[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const reportError = useCallback(
    (msg: string) => {
      setStatus(msg);
      onError?.(msg);
    },
    [onError]
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
    setAgentHits([]);
    setListingHits([]);

    try {
      if (mlsQ) {
        try {
          const listing = await searchListingByMls(mlsQ);
          setStatus(`Loaded listing ${listing.mls}.`);
          onResult({ kind: "listing", listing });
          return;
        } catch {
          try {
            const hits = await searchGhlContacts(mlsQ);
            const mlsNorm = mlsQ.toUpperCase();
            const matched = hits.filter((h) => (h.mls || "").toUpperCase().includes(mlsNorm));
            const toShow = matched.length > 0 ? matched : hits;
            if (toShow.length > 0) {
              setListingHits(toShow);
              setStatus(
                `${toShow.length} match${toShow.length === 1 ? "" : "es"} for MLS ${mlsQ} — select one below.`
              );
              return;
            }
          } catch {
            /* fall through to address or error */
          }
          if (!addrQ) {
            reportError(`No listing found for MLS ${mlsQ}. Try address search or enter details manually below.`);
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
      setStatus("Address loaded — map and campaign fields updated.");
      onResult({ kind: "address", form, geo });
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Address search failed.");
    } finally {
      setBusy(false);
    }
  }, [addressLine, mls, onResult, reportError]);

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
      setStatus("Address selected — loading map and campaign fields.");
      onResult({
        kind: "address",
        form,
        geo: { lat: place.lat, lng: place.lng, county: place.county },
      });
    },
    [mls, onResult]
  );

  const onAgentSearch = useCallback(async () => {
    const q = agentQuery.trim();
    if (q.length < 2) {
      reportError("Enter at least 2 characters (name, email, or phone).");
      return;
    }
    setBusy(true);
    setStatus(null);
    setAgentHits([]);
    try {
      const hits = await searchGhlContacts(q);
      setAgentHits(hits);
      if (!hits.length) setStatus("No contacts matched. Try a different name, email, or phone.");
      else setStatus(`${hits.length} contact${hits.length === 1 ? "" : "s"} found.`);
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Agent search failed.");
    } finally {
      setBusy(false);
    }
  }, [agentQuery, reportError]);

  const applyGhlContact = useCallback(
    async (hit: GhlContactSearchHit, source: "agent" | "listing") => {
      setBusy(true);
      setStatus(null);
      setListingHits([]);
      setAgentHits([]);
      try {
        const full = await fetchGhlContactPrefill(hit.id);
        const form = ghlHitToListingForm(full);
        if (full.mls) setMls(full.mls);
        if (full.listingAddress) setAddressLine(full.listingAddress);

        let geo = { lat: 28.0356, lng: -82.7743, county: "Pinellas" };
        const geoQuery = listingAddressGeocodeQuery(form) || full.listingAddress?.trim() || "";
        let mapNote: string | null = null;
        if (geoQuery.length >= 8) {
          try {
            geo = await geocodeAddressLine(geoQuery);
          } catch {
            mapNote = "Contact loaded — refine the address if the map looks wrong.";
          }
        }

        const draft = buildDraftListingFromForm(form, geo);
        const label = full.name || "contact";
        setStatus(
          mapNote ||
            `Loaded ${label}${source === "listing" && full.mls ? ` · MLS ${full.mls}` : ""}.`
        );
        onResult({ kind: "listing", listing: draft });
      } catch (e) {
        reportError(e instanceof Error ? e.message : "Could not load contact.");
      } finally {
        setBusy(false);
      }
    },
    [onResult, reportError]
  );

  const onPickAgent = useCallback(
    (hit: GhlContactSearchHit) => {
      void applyGhlContact(hit, "agent");
    },
    [applyGhlContact]
  );

  const onPickListingHit = useCallback(
    (hit: GhlContactSearchHit) => {
      void applyGhlContact(hit, "listing");
    },
    [applyGhlContact]
  );

  return (
    <section className="buy-search section-surface buy-card" aria-label="Search your listing">
      <h2 className="premium-h2" style={{ marginBottom: "0.35rem" }}>
        Search your just listed or just sold listing
      </h2>
      <p className="muted" style={{ marginBottom: "1rem", fontSize: "0.92rem", lineHeight: 1.5 }}>
        Find a property by <strong>MLS #</strong> or <strong>address</strong>, or pull an agent from your{" "}
        <strong>GoHighLevel</strong> database by name, email, or phone.
      </p>

      <div className="buy-search-tabs" role="tablist" aria-label="Search mode">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "listing"}
          className={`buy-search-tab${tab === "listing" ? " is-active" : ""}`}
          onClick={() => setTab("listing")}
          disabled={disabled || busy}
        >
          By listing
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "agent"}
          className={`buy-search-tab${tab === "agent" ? " is-active" : ""}`}
          onClick={() => setTab("agent")}
          disabled={disabled || busy}
        >
          By agent
        </button>
      </div>

      {tab === "listing" ? (
        <div className="buy-search-panel">
          <div className="buy-search-row">
            <label className="cp-form-grid buy-search-field">
              <span className="muted-label">MLS #</span>
              <input
                type="text"
                className="premium-input"
                value={mls}
                onChange={(e) => setMls(e.target.value)}
                placeholder="TB8502524"
                disabled={disabled || busy}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onFindListing();
                }}
              />
            </label>
            <button type="button" className="btn btn-primary buy-search-btn" disabled={disabled || busy} onClick={() => void onFindListing()}>
              Find listing
            </button>
          </div>
          <p className="buy-search-or muted">or</p>
          <label className="cp-form-grid">
            <span className="muted-label">Property address</span>
            <AddressAutocompleteInput
              value={addressLine}
              onChange={setAddressLine}
              onPlaceSelect={onAddressPlace}
              disabled={disabled || busy}
              placeholder="Start typing street address…"
              onEnter={() => void onFindListing()}
            />
          </label>
          <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
            Type a street address for suggestions, or enter the full address in Step 1 below.
          </p>
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
                    <strong>{hit.mls ? `MLS ${hit.mls}` : "Listing match"}</strong>
                    <span>
                      {[hit.name, hit.listingAddress, hit.email, hit.phone].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="buy-search-panel">
          <div className="buy-search-row">
            <label className="cp-form-grid buy-search-field">
              <span className="muted-label">Agent name, email, or phone</span>
              <input
                type="search"
                className="premium-input"
                value={agentQuery}
                onChange={(e) => setAgentQuery(e.target.value)}
                placeholder="Maria Garcia or maria@… or 727-555-0100"
                disabled={disabled || busy}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onAgentSearch();
                }}
              />
            </label>
            <button type="button" className="btn btn-primary buy-search-btn" disabled={disabled || busy} onClick={() => void onAgentSearch()}>
              Find agent
            </button>
          </div>
          {agentHits.length > 0 ? (
            <ul className="buy-search-hits">
              {agentHits.map((hit) => (
                <li key={hit.id}>
                  <button type="button" className="buy-search-hit" disabled={disabled || busy} onClick={() => void onPickAgent(hit)}>
                    <strong>{hit.name}</strong>
                    <span>
                      {[hit.email, hit.phone, hit.mls ? `MLS ${hit.mls}` : null, hit.listingAddress].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {status ? (
        <p className={`buy-search-status${status.toLowerCase().includes("no ") ? " buy-search-status--warn" : ""}`} role="status">
          {status}
        </p>
      ) : null}
    </section>
  );
}
