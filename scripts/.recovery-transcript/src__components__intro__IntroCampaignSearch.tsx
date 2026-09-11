import { useCallback, useEffect, useRef, useState } from "react";
import { AddressAutocompleteInput } from "../AddressAutocompleteInput";
import type { BuyLeadsSearchResult } from "../BuyLeadsSearch";
import { IntroCampaignAgentListingPicker, type IntroListingPick } from "./IntroCampaignAgentListingPicker";
import {
  INTRO_MAX_AGENT_SEARCH_HITS,
  fetchIntroContactOpportunities,
  pickIntroListingOptions,
  type IntroListingOption,
} from "../../lib/introAgentListings";
import {
  fetchGhlContactPrefill,
  geocodeAddressLine,
  resolveListingByMls,
  searchGhlContacts,
  searchGhlContactsByMls,
  ghlSearchUserMessage,
  type GhlContactSearchHit,
} from "../../lib/buyLeadsSearchApi";
import { ghlHitAgentLabel } from "../../lib/ghlContactRole";
import { buildListingFromGhlPrefill, ghlHitToListingForm } from "../../lib/listingDraft";
import type { ListingFormValues } from "../../lib/listingData";
import { campaignTypeFromListingType } from "../../lib/listingCampaignType";
import type { ParsedPlaceAddress } from "../../lib/placesAddress";
import { geocodeUserMessage } from "../../lib/geocodeAddress";
import { normalizeAgentPhoneParam, phonesMatch } from "../../lib/introAgentPhone";
import "../../pages/buy-leads.css";

type SearchMode = "listing" | "agent";
type AgentStep = "search" | "pick-listings";

type Props = {
  onResult: (result: BuyLeadsSearchResult) => void;
  onError?: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
  /** When set (e.g. from `/first-time-customer/:phone`), auto-search and show listing cards. */
  initialAgentPhone?: string;
  className?: string;
};

function searchStatusClass(msg: string): string {
  if (/found|loaded|select|continuing/i.test(msg)) return "buy-search-status buy-search-status--ok";
  return "buy-search-status";
}

function formatAgentHitMeta(hit: GhlContactSearchHit): string {
  return [hit.email, hit.phone].filter(Boolean).join(" · ");
}

async function enrichListingPicks(contactId: string, options: IntroListingOption[]): Promise<IntroListingPick[]> {
  const picks = await Promise.all(
    options.map(async (option) => {
      const mls = option.mls?.trim();
      if (!mls) return null;
      const full = await fetchGhlContactPrefill(contactId, undefined, mls);
      return {
        option,
        listing: buildListingFromGhlPrefill(full),
        form: ghlHitToListingForm(full),
      };
    })
  );
  return picks.filter((p): p is IntroListingPick => p !== null);
}

/** First-time customer search — agent listings from GHL opportunities (intro funnel only). */
export function IntroCampaignSearch({
  onResult,
  onError,
  onBusyChange,
  initialAgentPhone,
  className,
}: Props) {
  const autoPhoneLoaded = useRef(false);
  const [mode, setMode] = useState<SearchMode>("agent");
  const [agentStep, setAgentStep] = useState<AgentStep>("search");
  const [agentQuery, setAgentQuery] = useState("");
  const [mls, setMls] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [agentHits, setAgentHits] = useState<GhlContactSearchHit[]>([]);
  const [listingHits, setListingHits] = useState<GhlContactSearchHit[]>([]);
  const [pickedAgent, setPickedAgent] = useState<GhlContactSearchHit | null>(null);
  const [listedPicks, setListedPicks] = useState<IntroListingPick[]>([]);
  const [soldPicks, setSoldPicks] = useState<IntroListingPick[]>([]);
  const [buyerPicks, setBuyerPicks] = useState<IntroListingPick[]>([]);

  const setBusyState = useCallback(
    (next: boolean) => {
      setBusy(next);
      onBusyChange?.(next);
    },
    [onBusyChange]
  );

  const reportError = useCallback(
    (msg: string) => {
      setStatus(msg);
      onError?.(msg);
    },
    [onError]
  );

  const resetAgentFlow = useCallback(() => {
    setAgentStep("search");
    setPickedAgent(null);
    setListedPicks([]);
    setSoldPicks([]);
    setBuyerPicks([]);
  }, []);

  const switchMode = useCallback(
    (next: SearchMode) => {
      setMode(next);
      setStatus(null);
      setListingHits([]);
      setAgentHits([]);
      resetAgentFlow();
    },
    [resetAgentFlow]
  );

  const onAgentSearch = useCallback(async () => {
    const q = agentQuery.trim();
    if (q.length < 2) {
      reportError("Enter at least 2 characters (email or phone).");
      return;
    }

    setBusyState(true);
    setStatus(null);
    setAgentHits([]);
    resetAgentFlow();

    try {
      const hits = (await searchGhlContacts(q)).slice(0, INTRO_MAX_AGENT_SEARCH_HITS);
      setAgentHits(hits);
      if (!hits.length) {
        setStatus("No contacts matched. Try a different email or phone.");
      } else {
        const capped = hits.length >= INTRO_MAX_AGENT_SEARCH_HITS ? ` (showing up to ${INTRO_MAX_AGENT_SEARCH_HITS})` : "";
        setStatus(`${hits.length} contact${hits.length === 1 ? "" : "s"} found — select one below.${capped}`);
      }
    } catch (e) {
      reportError(ghlSearchUserMessage(e));
    } finally {
      setBusyState(false);
    }
  }, [agentQuery, reportError, resetAgentFlow, setBusyState]);

  const onPickAgent = useCallback(
    async (hit: GhlContactSearchHit) => {
      setBusyState(true);
      setStatus(null);
      setAgentHits([]);
      setPickedAgent(hit);

      try {
        const opportunities = await fetchIntroContactOpportunities(hit.id);
        let { listed, sold, buyer } = pickIntroListingOptions(opportunities);

        if (!listed.length && !sold.length && !buyer.length && hit.mls?.trim()) {
          const fallbackType = campaignTypeFromListingType(hit.listingType) ?? "just_listed";
          const fallback: IntroListingOption = {
            id: hit.id,
            name: hit.name,
            mls: hit.mls.trim().toUpperCase(),
            listingAddress: hit.listingAddress,
            listingType: hit.listingType,
            createdAt: null,
            payLinkUrl: null,
            finalLinkUrl: null,
            campaignType: fallbackType,
            kind: fallbackType === "just_sold" ? "sold" : "listed",
          };
          if (fallback.kind === "sold") sold = [fallback];
          else listed = [fallback];
        }

        setListedPicks(await enrichListingPicks(hit.id, listed));
        setSoldPicks(await enrichListingPicks(hit.id, sold));
        setBuyerPicks(await enrichListingPicks(hit.id, buyer));

        const options = [...listed, ...sold, ...buyer];
        if (!options.length) {
          setAgentStep("search");
          setStatus("No listings with MLS found for this agent.");
          return;
        }

        setAgentStep("pick-listings");
        setStatus("Pick a listing — latest listing, sold, or buyer side close.");
      } catch (e) {
        reportError(ghlSearchUserMessage(e));
        setAgentStep("search");
        setPickedAgent(null);
      } finally {
        setBusyState(false);
      }
    },
    [reportError, setBusyState]
  );

  const loadAgentByPhone = useCallback(
    async (phoneParam: string) => {
      const normalized = normalizeAgentPhoneParam(phoneParam);
      if (normalized.length < 10) {
        reportError("Invalid phone number in link.");
        return;
      }

      setMode("agent");
      setAgentQuery(normalized);
      setBusyState(true);
      setStatus(null);
      setAgentHits([]);
      resetAgentFlow();

      try {
        setStatus("Loading your listings…");
        const hits = (await searchGhlContacts(normalized)).slice(0, INTRO_MAX_AGENT_SEARCH_HITS);
        const exact = hits.find((hit) => phonesMatch(hit.phone, normalized));

        if (!hits.length) {
          setStatus(`No agent found for phone ${normalized}.`);
          return;
        }

        if (hits.length === 1 || exact) {
          await onPickAgent(exact ?? hits[0]!);
          return;
        }

        setAgentHits(hits);
        setStatus(`${hits.length} contacts found — select one below.`);
      } catch (e) {
        reportError(ghlSearchUserMessage(e));
      } finally {
        setBusyState(false);
      }
    },
    [onPickAgent, reportError, resetAgentFlow, setBusyState]
  );

  useEffect(() => {
    const phone = initialAgentPhone?.trim();
    if (!phone || autoPhoneLoaded.current) return;
    autoPhoneLoaded.current = true;
    void loadAgentByPhone(phone);
  }, [initialAgentPhone, loadAgentByPhone]);

  const onPickListingOption = useCallback(
    async (pick: IntroListingPick) => {
      setBusyState(true);
      setStatus(null);
      try {
        setStatus(`Continuing to checkout for MLS ${pick.option.mls}…`);
        onResult({ kind: "listing", listing: pick.listing });
      } catch (e) {
        reportError(geocodeUserMessage(e));
      } finally {
        setBusyState(false);
      }
    },
    [onResult, reportError, setBusyState]
  );

  const applyListingHit = useCallback(
    async (hit: GhlContactSearchHit) => {
      setBusyState(true);
      setStatus(null);
      setListingHits([]);
      try {
        const full = await fetchGhlContactPrefill(hit.id, undefined, hit.mls ?? undefined);
        const listing = buildListingFromGhlPrefill(full);
        onResult({ kind: "listing", listing });
      } catch (e) {
        reportError(geocodeUserMessage(e));
      } finally {
        setBusyState(false);
      }
    },
    [onResult, reportError, setBusyState]
  );

  const onFindListing = useCallback(async () => {
    const mlsQ = mls.trim();
    const addrQ = addressLine.trim();
    if (!mlsQ && !addrQ) {
      reportError("Enter an MLS number or property address.");
      return;
    }

    setBusyState(true);
    setStatus(null);
    setListingHits([]);

    try {
      if (mlsQ) {
        const hits = await searchGhlContactsByMls(mlsQ);
        if (hits.length > 1) {
          setListingHits(hits.slice(0, INTRO_MAX_AGENT_SEARCH_HITS));
          setStatus(`${hits.length} matches for MLS ${mlsQ} — select one below.`);
          return;
        }
        if (hits.length === 1) {
          await applyListingHit(hits[0]!);
          return;
        }
        const listing = await resolveListingByMls(mlsQ);
        onResult({ kind: "listing", listing });
        return;
      }

      const geo = await geocodeAddressLine(addrQ);
      const form: ListingFormValues = {
        mls: "",
        agentName: "",
        email: "",
        phone: "",
        brokerage: "",
        streetAddress: addrQ,
        city: "",
        stateCode: "",
        zip: "",
      };
      setStatus("Address loaded — continuing to checkout.");
      onResult({ kind: "address", form, geo });
    } catch (e) {
      reportError(geocodeUserMessage(e));
    } finally {
      setBusyState(false);
    }
  }, [addressLine, applyListingHit, mls, onResult, reportError, setBusyState]);

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
      setStatus("Address selected — click Find listing to continue.");
      onResult({
        kind: "address",
        form,
        geo: { lat: place.lat, lng: place.lng, county: place.county },
      });
    },
    [mls, onResult]
  );

  return (
    <section className={`buy-search intro-search ${className ?? ""}`.trim()}>
      <p className="buy-search-intro muted">
        Start with your <strong>agent email or phone</strong> — or switch to MLS # / property address.
      </p>

      <fieldset className="buy-search-mode" aria-label="Search mode">
        <label className="buy-search-mode__option">
          <input
            type="radio"
            name="intro-search-mode"
            checked={mode === "agent"}
            disabled={busy}
            onChange={() => switchMode("agent")}
          />
          By agent
        </label>
        <label className="buy-search-mode__option">
          <input
            type="radio"
            name="intro-search-mode"
            checked={mode === "listing"}
            disabled={busy}
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
                disabled={busy}
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
                disabled={busy}
                placeholder="Start typing street address…"
                onEnter={() => void onFindListing()}
                className="premium-input buy-search-input"
              />
            </label>
            <button
              type="button"
              className={`btn btn-primary buy-search-btn${busy ? " buy-search-btn--loading" : ""}`}
              disabled={busy}
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
            <ul className="buy-search-hits intro-search-hits--capped">
              {listingHits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className="buy-search-hit intro-agent-hit"
                    disabled={busy}
                    onClick={() => void applyListingHit(hit)}
                  >
                    <strong>
                      {hit.mls ? `MLS ${hit.mls}` : "Listing match"}
                      <span className="buy-search-hit__role"> · {ghlHitAgentLabel(hit)}</span>
                    </strong>
                    <span className="intro-agent-hit__meta">
                      {[hit.name, hit.listingAddress, hit.email, hit.phone].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="buy-search-hint muted">MLS or street address — suggestions appear as you type.</p>
        </div>
      ) : agentStep === "search" ? (
        <div className="buy-search-panel">
          <div className="buy-search-row buy-search-row--agent">
            <label className="cp-form-grid buy-search-field buy-search-field--agent">
              <span className="muted-label buy-search-label">Agent email or phone</span>
              <input
                type="search"
                className="premium-input buy-search-input"
                value={agentQuery}
                onChange={(e) => setAgentQuery(e.target.value)}
                placeholder="maria@example.com or 727-555-0100"
                disabled={busy}
                autoComplete="email tel"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onAgentSearch();
                }}
              />
            </label>
            <button
              type="button"
              className={`btn btn-primary buy-search-btn${busy ? " buy-search-btn--loading" : ""}`}
              disabled={busy}
              aria-busy={busy}
              onClick={() => void onAgentSearch()}
            >
              {busy ? (
                <span className="cp-loading-line buy-search-btn__loading">Searching…</span>
              ) : (
                "Find my Listing"
              )}
            </button>
          </div>
          {agentHits.length > 0 ? (
            <ul className="buy-search-hits intro-search-hits--capped">
              {agentHits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className="buy-search-hit intro-agent-hit"
                    disabled={busy}
                    onClick={() => void onPickAgent(hit)}
                  >
                    <strong className="intro-agent-hit__name">{hit.name}</strong>
                    <span className="intro-agent-hit__meta">{formatAgentHitMeta(hit)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="buy-search-hint muted">
            Search by email or phone — up to {INTRO_MAX_AGENT_SEARCH_HITS} matches, then pick a listing.
          </p>
        </div>
      ) : agentStep === "pick-listings" && pickedAgent ? (
        <IntroCampaignAgentListingPicker
          agent={pickedAgent}
          listed={listedPicks}
          sold={soldPicks}
          buyer={buyerPicks}
          busy={busy}
          onPick={(option) => void onPickListingOption(option)}
          onBack={() => {
            resetAgentFlow();
            setStatus(null);
          }}
        />
      ) : null}

      {status ? (
        <p className={searchStatusClass(status)} role="status">
          {status}
        </p>
      ) : null}
    </section>
  );
}
