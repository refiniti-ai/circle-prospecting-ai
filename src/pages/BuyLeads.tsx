import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { ListingMap } from "../components/ListingMap";
import { ListingAgentCard } from "../components/ListingAgentCard";
import { ListingCampaignForm } from "../components/ListingCampaignForm";
import { BuyLeadsSearch, type BuyLeadsSearchResult } from "../components/BuyLeadsSearch";
import { buildDraftListingFromForm } from "../lib/listingDraft";
import { contactEmail } from "../lib/siteConfig";
import { apiBase, isApiBaseConfigured } from "../lib/apiBase";
import {
  fetchLeadCount,
  startLeadCheckout,
  type CampaignPropertyType,
} from "../lib/leadsApi";
import { PromoCodeField } from "../components/PromoCodeField";
import {
  LEAD_TIERS,
  LEAD_PRICE_MATRIX,
  checkoutServiceLines,
  defaultCheckoutServiceLine,
  isServiceLineHiddenDuringBeta,
  tierFromLeadCount,
  totalCentsForSelection,
  leadCountFitsTier,
  tierRowMeta,
  pricePerLeadUsd,
  formatMoneyUsd,
  serviceLineLabel,
  minLeadsForStripeForTier,
  type LeadServiceLine,
  type LeadTierId,
} from "../lib/leadPricing";
import { loadUsGeoData, type UsGeoData, type UsCityRow, type UsCountyRow } from "../lib/usGeo";
import { fetchOrderById } from "../lib/apiClient";
import {
  applyListingFormValues,
  emptyListingFormValues,
  getLocalDemoOrder,
  LISTING_RADIUS_ORDER,
  listingAddressGeocodeQuery,
  listingFormValuesFromPayload,
  radiusMilesFromId,
  parseListingLocation,
  resolveLocalListing,
  type ListingCampaignType,
  type ListingFormValues,
  type ListingPayload,
  type RadiusId,
} from "../lib/listingData";
import {
  agentFormFromInfo,
  agentRoleFromParam,
  emptyAgentForm,
  campaignForAgentRole,
  getBuyerAgent,
  getSellerAgent,
  listingHasDualAgents,
  normalizeListingAgents,
  patchListingAgents,
  type ListingAgentFormValues,
  type ListingAgentRole,
} from "../lib/listingAgents";
import { notifyError, notifyWarning } from "../lib/notify";
import { radiusIdFromMiles } from "../lib/mapUtils";
import "./buy-leads.css";

/** Defaults for lead-count API (optional filters UI removed — keeps checkout behavior stable). */
const LEAD_COUNT_DEFAULTS = {
  includeContact: "phones_email" as const,
  occupancy: "absentee" as const,
  propertyTypes: ["single_family"] as string[],
  flags: ["vacant", "high_equity"] as string[],
};

type NominatimItem = {
  lat?: string;
  lon?: string;
  address?: {
    county?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    postcode?: string;
  };
};

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "CircleProspectingAI/1.0 (buy-leads)",
} as const;

/** Shown when /api is unreachable (e.g. static Hosting only) or inventory has no matching rows — keeps caps/tiers usable. */
const DEMO_HOMEOWNERS_MATCHED = 7_500;
const DEMO_INVENTORY_BASE = 18_000;

function apiBaseLooksLikeLocalDev(): boolean {
  const b = apiBase().toLowerCase();
  return b.includes("localhost") || b.includes("127.0.0.1");
}

function isLiveFirebaseHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h.endsWith(".web.app") || h.endsWith(".firebaseapp.com");
}

function checkoutFetchErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const isNetworkFail =
    !raw ||
    raw === "Failed to fetch" ||
    raw.includes("NetworkError") ||
    raw.includes("Load failed") ||
    raw.includes("fetch resource") ||
    raw.includes("Network request failed");
  if (!isNetworkFail) return raw || "Checkout error";

  if (typeof window !== "undefined" && isLiveFirebaseHost() && isApiBaseConfigured() && apiBaseLooksLikeLocalDev()) {
    return "This site was built with VITE_API_BASE_URL pointing at localhost — browsers cannot reach your computer from the internet. Remove or blank VITE_API_BASE_URL for same-domain /api (Cloud Run), or set it to your public HTTPS API URL, then npm run build and redeploy.";
  }

  if (!isApiBaseConfigured()) {
    if (import.meta.env.PROD && isLiveFirebaseHost()) {
      return "This build has no API URL. Deploy the Express API (e.g. Cloud Run), set VITE_API_BASE_URL to that HTTPS origin (no trailing slash), run npm run build, and redeploy Hosting. Set CORS_ORIGIN on the API to this site. Alternatively deploy Cloud Run as circle-prospecting-api (us-central1), restore the /api/** Hosting→Run rewrite in firebase.json, leave VITE_API_BASE_URL empty, rebuild, and redeploy.";
    }
    return "Checkout cannot reach an API from this site. Set VITE_API_BASE_URL to your HTTPS API origin (no trailing slash), run npm run build, and redeploy — or use Hosting + Cloud Run with VITE_API_BASE_URL empty.";
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "this site";
  return `Could not reach ${apiBase()}. Confirm that URL is reachable from the public internet and CORS_ORIGIN on the API includes ${origin}.`;
}

function coerceLeadCountDisplay(available: number, baseAvail: number): { available: number; base: number } {
  if (available < 1 && baseAvail < 1) {
    return { available: DEMO_HOMEOWNERS_MATCHED, base: DEMO_INVENTORY_BASE };
  }
  if (baseAvail < 1 && available >= 1) {
    return { available, base: Math.max(800, Math.round(available * 1.15)) };
  }
  return { available, base: baseAvail };
}

/** UI copy only: avoid showing very small match counts (checkout still uses the raw number). */
function formatHomeownersMatchedDisplay(count: number): string {
  if (!Number.isFinite(count) || count < 1) return "0";
  if (count < 1000) return "1,000+";
  return count.toLocaleString("en-US");
}

const CITY_SEARCH_MIN = 2;
const CITY_SEARCH_MAX = 80;

/** Quick-pick homeowner counts — tier band and per-home rate derive from this number. */
const HOME_COUNT_PRESETS = [100, 250, 500, 1000] as const;

const BUY_NEXT_STEPS = [
  "We pull homeowner records",
  "Our system activates your campaign",
  "Calls begin within 24 hours",
  "You receive lead activity and reporting",
] as const;

const BUY_TRUST_ITEMS = [
  "Your order is reviewed and verified",
  "We confirm property and homeowner data",
  "Campaigns typically begin within 24 hours",
  "Track results and leads in your dashboard",
] as const;

function campaignTypeFromParam(raw: string | null): ListingCampaignType | null {
  if (raw === "just_listed" || raw === "just_sold") return raw;
  return null;
}

function firstUsPostcode(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const part = raw.split(";")[0]?.trim();
  return part || null;
}

export function BuyLeads() {
  const [sp] = useSearchParams();
  const canceled = sp.get("canceled");
  const listingRef = sp.get("order") ?? sp.get("mls") ?? null;
  const agentFromUrl = agentRoleFromParam(sp.get("agent"));
  const campaignFromUrl = campaignTypeFromParam(sp.get("campaign"));
  const [listing, setListing] = useState<ListingPayload | null>(null);
  const [listingForm, setListingForm] = useState<ListingFormValues>(emptyListingFormValues);
  const [sellerAgentForm, setSellerAgentForm] = useState<ListingAgentFormValues>(emptyAgentForm);
  const [buyerAgentForm, setBuyerAgentForm] = useState<ListingAgentFormValues>(emptyAgentForm);
  const [orderingAgentRole, setOrderingAgentRole] = useState<ListingAgentRole | null>(() => agentFromUrl);
  const [listingLoading, setListingLoading] = useState(true);
  const [listingRadiusId, setListingRadiusId] = useState<RadiusId>("h1");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignPropertyType>(
    () => campaignFromUrl ?? "just_listed"
  );
  const [serviceLine, setServiceLine] = useState<LeadServiceLine>(() => defaultCheckoutServiceLine());
  /** Explicit plan row (Dabble … Scale); click a row in any pricing table to set service + plan. */
  const [selectedTier, setSelectedTier] = useState<LeadTierId>(() => tierFromLeadCount(500));
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canceledToastShown = useRef(false);
  /** Set when /api returns HTML (e.g. Firebase Hosting without API proxy). */
  const [apiBackendHint, setApiBackendHint] = useState<string | null>(null);
  const [geo, setGeo] = useState<UsGeoData | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  /** Row key from bundled US cities list (`city|county|ST`). */
  const [cityRowKey, setCityRowKey] = useState("");
  /** County key `County|ST` — stays in sync when you pick a city from search. */
  const [countyKey, setCountyKey] = useState("");
  /** City field: typeahead open + query (full list is huge — search instead of a giant native select). */
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [countyPickerOpen, setCountyPickerOpen] = useState(false);
  const [countyQuery, setCountyQuery] = useState("");
  const [zip, setZip] = useState("34698");
  const [radius, setRadius] = useState("1.0");
  const [requestedLeads, setRequestedLeads] = useState(500);
  const [estimatedAvailable, setEstimatedAvailable] = useState(0);
  const [mapLat, setMapLat] = useState(28.0356);
  const [mapLng, setMapLng] = useState(-82.7743);
  const [locatingMap, setLocatingMap] = useState(false);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  /** When true, ZIP auto-fill is skipped (user has entered a non-empty ZIP). Clear the field to allow auto-fill again. */
  const zipManualLockRef = useRef(false);

  const selectedCityRow = useMemo(() => geo?.citiesFlat.find((r) => r.k === cityRowKey), [geo, cityRowKey]);
  const selectedCountyRow = useMemo(() => geo?.counties.find((c) => c.key === countyKey), [geo, countyKey]);
  const city = selectedCityRow?.city ?? "";
  const county = selectedCityRow?.county ?? "";
  /** Used only for geocoding / Nominatim — not shown as a separate form field. */
  const stateName = selectedCityRow?.stateName ?? "";

  const tierBandOk = useMemo(() => leadCountFitsTier(requestedLeads, selectedTier), [requestedLeads, selectedTier]);
  const checkoutTotalCents = useMemo(
    () => totalCentsForSelection(serviceLine, selectedTier, requestedLeads, appliedPromoCode),
    [serviceLine, selectedTier, requestedLeads, appliedPromoCode]
  );
  const stripeMinLeads = useMemo(
    () => minLeadsForStripeForTier(serviceLine, selectedTier, appliedPromoCode),
    [serviceLine, selectedTier, appliedPromoCode]
  );
  const visibleServiceLines = useMemo(() => checkoutServiceLines(), []);

  useEffect(() => {
    if (isServiceLineHiddenDuringBeta(serviceLine)) {
      setServiceLine(defaultCheckoutServiceLine());
    }
  }, [serviceLine]);

  const handlePromoApply = useCallback(
    (code: string | null) => {
      setAppliedPromoCode(code);
      if (promoInput.trim() && !code) {
        notifyWarning("Promo code not recognized.");
      }
    },
    [promoInput]
  );

  const selectedTierMeta = tierRowMeta(selectedTier);
  const selectedTierBandLabel =
    selectedTierMeta.maxLeads == null
      ? `${selectedTierMeta.minLeads.toLocaleString()}+`
      : `${selectedTierMeta.minLeads.toLocaleString()}–${selectedTierMeta.maxLeads.toLocaleString()}`;

  const selectedListingRing = listing ? listing.radii[listingRadiusId] : null;
  const listingHomesCap = selectedListingRing ? Math.max(1, selectedListingRing.count) : null;

  const homesCap = useMemo(() => {
    if (listingHomesCap != null) return listingHomesCap;
    return Math.max(estimatedAvailable || 100_000, requestedLeads, 1);
  }, [listingHomesCap, estimatedAvailable, requestedLeads]);

  const applyHomeCount = useCallback(
    (count: number) => {
      const next = Math.min(Math.max(1, Math.round(count)), homesCap);
      setRequestedLeads(next);
      setSelectedTier(tierFromLeadCount(next));
    },
    [homesCap]
  );

  const pickServiceAndTier = useCallback((line: LeadServiceLine, tier: LeadTierId) => {
    setServiceLine(line);
    setSelectedTier(tier);
  }, []);

  const syncListingGeo = useCallback((l: ListingPayload, g: UsGeoData) => {
    const { city: listingCity, stateCode } = parseListingLocation(l);
    const ck = `${l.county}|${stateCode}`;
    if (g.counties.some((c) => c.key === ck)) setCountyKey(ck);
    const row = g.citiesFlat.find(
      (r) => r.city === listingCity && r.county === l.county && r.stateCode === stateCode
    );
    if (row) setCityRowKey(row.k);
  }, []);

  const dualAgents = listingHasDualAgents(listing);

  const activateAgentRole = useCallback(
    (role: ListingAgentRole) => {
      setOrderingAgentRole(role);
      setCampaignType(campaignForAgentRole(role));
      const agent = role === "seller" ? sellerAgentForm : buyerAgentForm;
      setEmail(agent.email.trim());
      setPhone(agent.phone.trim());
      setListingForm((prev) => ({
        ...prev,
        agentName: agent.name,
        email: agent.email,
        phone: agent.phone,
        brokerage: agent.brokerage,
      }));
    },
    [sellerAgentForm, buyerAgentForm]
  );

  const syncAgentFormsFromListing = useCallback((l: ListingPayload) => {
    const normalized = normalizeListingAgents(l);
    setSellerAgentForm(agentFormFromInfo(getSellerAgent(normalized)));
    setBuyerAgentForm(agentFormFromInfo(getBuyerAgent(normalized)));
    return normalized;
  }, []);

  const applyListingFromPayload = useCallback(
    (l: ListingPayload, radiusId: RadiusId, orderRole?: ListingAgentRole) => {
      const normalized = syncAgentFormsFromListing(l);
      const ring = normalized.radii[radiusId];
      const count = Math.max(1, ring.count);
      setListingRadiusId(radiusId);
      setRequestedLeads(count);
      setSelectedTier(tierFromLeadCount(count));
      setEstimatedAvailable(count);
      setRadius(String(radiusMilesFromId(radiusId)));
      setZip(normalized.zip);
      setMapLat(normalized.lat);
      setMapLng(normalized.lng);
      setListingForm(listingFormValuesFromPayload(normalized));
      if (listingHasDualAgents(normalized)) {
        const role =
          orderRole ??
          orderingAgentRole ??
          agentFromUrl ??
          (campaignFromUrl === "just_sold" ? "seller" : "buyer");
        const agent = role === "seller" ? getSellerAgent(normalized) : getBuyerAgent(normalized);
        setEmail(agent.email.trim());
        setPhone(agent.phone.trim());
        setCampaignType(campaignFromUrl ?? campaignForAgentRole(role));
        setOrderingAgentRole(role);
      } else {
        setEmail(normalized.email.trim());
        setPhone(normalized.phone.trim());
        if (normalized.campaignType) setCampaignType(normalized.campaignType);
        else if (campaignFromUrl) setCampaignType(campaignFromUrl);
      }
      zipManualLockRef.current = true;
    },
    [campaignFromUrl, agentFromUrl, orderingAgentRole, syncAgentFormsFromListing]
  );

  const onListingFormChange = useCallback(<K extends keyof ListingFormValues>(field: K, value: ListingFormValues[K]) => {
    setListingForm((prev) => {
      const next = { ...prev, [field]: value };
      setListing((l) => (l ? applyListingFormValues(l, next) : l));
      if (field === "email") setEmail(String(value).trim());
      if (field === "phone") setPhone(String(value).trim());
      return next;
    });
  }, []);

  const applyListingRadius = useCallback(
    (l: ListingPayload, radiusId: RadiusId, orderRole?: ListingAgentRole) => {
      applyListingFromPayload(l, radiusId, orderRole);
    },
    [applyListingFromPayload]
  );

  const onSellerAgentChange = useCallback(
    <K extends keyof ListingAgentFormValues>(field: K, value: ListingAgentFormValues[K]) => {
      setSellerAgentForm((prev) => {
        const next = { ...prev, [field]: value };
        setListing((l) => (l ? patchListingAgents(l, next, buyerAgentForm) : l));
        if (orderingAgentRole === "seller") {
          if (field === "email") setEmail(String(value).trim());
          if (field === "phone") setPhone(String(value).trim());
        }
        return next;
      });
    },
    [buyerAgentForm, orderingAgentRole]
  );

  const onBuyerAgentChange = useCallback(
    <K extends keyof ListingAgentFormValues>(field: K, value: ListingAgentFormValues[K]) => {
      setBuyerAgentForm((prev) => {
        const next = { ...prev, [field]: value };
        setListing((l) => (l ? patchListingAgents(l, sellerAgentForm, next) : l));
        if (orderingAgentRole === "buyer") {
          if (field === "email") setEmail(String(value).trim());
          if (field === "phone") setPhone(String(value).trim());
        }
        return next;
      });
    },
    [sellerAgentForm, orderingAgentRole]
  );

  const selectListingRingAndContinue = useCallback(
    (l: ListingPayload, radiusId: RadiusId, role?: ListingAgentRole) => {
      const orderRole = role ?? orderingAgentRole;
      if (orderRole && listingHasDualAgents(l)) activateAgentRole(orderRole);
      applyListingRadius(l, radiusId, orderRole ?? undefined);
      document.getElementById("buy-service-step")?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [applyListingRadius, activateAgentRole, orderingAgentRole]
  );

  const loadListingPayload = useCallback(
    (data: ListingPayload, radiusId: RadiusId = "h1") => {
      const normalized = normalizeListingAgents(data);
      setListing(normalized);
      applyListingRadius(normalized, radiusId);
      setListingLoading(false);
    },
    [applyListingRadius]
  );

  const handleBuyLeadsSearch = useCallback(
    (result: BuyLeadsSearchResult) => {
      if (result.kind === "listing") {
        loadListingPayload(result.listing);
        return;
      }
      const draft = buildDraftListingFromForm(result.form, result.geo, campaignType);
      loadListingPayload(draft);
    },
    [loadListingPayload, campaignType]
  );

  useEffect(() => {
    if (!listingRef) {
      setListingLoading(false);
      setListing(null);
      return;
    }
    const ac = new AbortController();
    setListingLoading(true);
    void (async () => {
      try {
        const data = await fetchOrderById(listingRef, ac.signal);
        if (ac.signal.aborted) return;
        loadListingPayload(data);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        const local = resolveLocalListing(listingRef) ?? getLocalDemoOrder(listingRef);
        if (local) {
          loadListingPayload(local);
        } else {
          setListing(null);
          setListingLoading(false);
        }
      }
    })();
    return () => ac.abort();
  }, [listingRef, loadListingPayload]);

  useEffect(() => {
    if (!listing || !geo) return;
    syncListingGeo(listing, geo);
  }, [listing, geo, syncListingGeo]);

  useEffect(() => {
    const query = listingAddressGeocodeQuery(listingForm);
    if (query.length < 10) return;
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void (async () => {
        setLocatingMap(true);
        try {
          const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=us&q=${encodeURIComponent(query)}`;
          const res = await fetch(url, { signal: ac.signal, headers: NOMINATIM_HEADERS });
          if (!res.ok) throw new Error("geocode");
          const rows = (await res.json()) as NominatimItem[];
          const first = rows[0];
          const lat = Number(first?.lat);
          const lng = Number(first?.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            setMapNotice("Could not find this address on the map. Check street, city, state, and ZIP.");
            return;
          }
          setMapLat(lat);
          setMapLng(lng);
          setMapNotice(null);
          const countyRaw = first?.address?.county?.replace(/\s+County$/i, "").trim();
          setListingForm((prev) => {
            setListing((l) =>
              l ? applyListingFormValues(l, prev, { lat, lng, county: countyRaw || l.county }) : l
            );
            return prev;
          });
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setMapNotice("Map location could not be updated. Try refining the address.");
        } finally {
          if (!ac.signal.aborted) setLocatingMap(false);
        }
      })();
    }, 650);
    return () => {
      ac.abort();
      window.clearTimeout(t);
    };
  }, [listingForm.streetAddress, listingForm.city, listingForm.stateCode, listingForm.zip]);

  const citySearchHits = useMemo(() => {
    if (!geo || cityQuery.trim().length < CITY_SEARCH_MIN) return [];
    const q = cityQuery.trim().toLowerCase();
    const hits: UsCityRow[] = [];
    for (const r of geo.citiesFlat) {
      if (r.label.toLowerCase().includes(q) || r.city.toLowerCase().includes(q)) {
        hits.push(r);
        if (hits.length >= CITY_SEARCH_MAX) break;
      }
    }
    return hits;
  }, [geo, cityQuery]);

  const countySearchHits = useMemo(() => {
    if (!geo || countyQuery.trim().length < CITY_SEARCH_MIN) return [];
    const q = countyQuery.trim().toLowerCase();
    const hits: UsCountyRow[] = [];
    for (const c of geo.counties) {
      if (
        c.label.toLowerCase().includes(q) ||
        c.county.toLowerCase().includes(q) ||
        c.stateCode.toLowerCase().includes(q) ||
        c.stateName.toLowerCase().includes(q)
      ) {
        hits.push(c);
        if (hits.length >= CITY_SEARCH_MAX) break;
      }
    }
    return hits;
  }, [geo, countyQuery]);

  /** Cities in the selected county — used to keep city/county keys consistent when county changes. */
  const cityRowsInCounty = useMemo(() => {
    if (!geo || !countyKey) return [];
    const meta = geo.counties.find((c) => c.key === countyKey);
    if (!meta) return [];
    const names = geo.cities[countyKey] ?? [];
    const rows: UsCityRow[] = [];
    for (const name of names) {
      const row = geo.citiesFlat.find(
        (r) => r.city === name && r.county === meta.county && r.stateCode === meta.stateCode
      );
      if (row) rows.push(row);
    }
    return rows;
  }, [geo, countyKey]);

  const applyLoadedGeo = useCallback((g: UsGeoData) => {
    setGeo(g);
    const defaultCountyKey = g.counties.some((c) => c.key === "Pinellas|FL") ? "Pinellas|FL" : g.counties[0]!.key;
    setCountyKey(defaultCountyKey);
    const meta = g.counties.find((c) => c.key === defaultCountyKey)!;
    const names = g.cities[defaultCountyKey] ?? [];
    const prefer = names.includes("Dunedin") ? "Dunedin" : names[0];
    const row = prefer
      ? g.citiesFlat.find(
          (r) => r.city === prefer && r.county === meta.county && r.stateCode === meta.stateCode
        )
      : undefined;
    if (row) setCityRowKey(row.k);
  }, []);

  useEffect(() => {
    let ok = true;
    setGeoError(null);
    loadUsGeoData()
      .then((g) => {
        if (!ok) return;
        applyLoadedGeo(g);
      })
      .catch((e) => {
        if (!ok) return;
        setGeoError(e instanceof Error ? e.message : "Could not load location data.");
      });
    return () => {
      ok = false;
    };
  }, [applyLoadedGeo]);

  useEffect(() => {
    if (!canceled || canceledToastShown.current) return;
    canceledToastShown.current = true;
    notifyWarning("Checkout canceled — adjust your selection and try again.");
  }, [canceled]);

  /** Keep city selection valid when county list changes. */
  useEffect(() => {
    if (!geo || !countyKey || cityRowsInCounty.length === 0) return;
    if (cityRowsInCounty.some((r) => r.k === cityRowKey)) return;
    setCityRowKey(cityRowsInCounty[0]!.k);
  }, [geo, countyKey, cityRowsInCounty, cityRowKey]);

  useEffect(() => {
    if (!cityPickerOpen && !countyPickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (cityPickerOpen) {
        setCityPickerOpen(false);
        setCityQuery("");
      }
      if (countyPickerOpen) {
        setCountyPickerOpen(false);
        setCountyQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cityPickerOpen, countyPickerOpen]);

  function pickCityRowFromSearch(row: UsCityRow) {
    zipManualLockRef.current = false;
    setCityRowKey(row.k);
    setCountyKey(`${row.county}|${row.stateCode}`);
    setCityPickerOpen(false);
    setCityQuery("");
    setCountyPickerOpen(false);
    setCountyQuery("");
  }

  function pickCounty(k: string) {
    zipManualLockRef.current = false;
    setCityPickerOpen(false);
    setCityQuery("");
    setCountyPickerOpen(false);
    setCountyQuery("");
    setCountyKey(k);
    const meta = geo?.counties.find((c) => c.key === k);
    if (!meta || !geo) return;
    const firstName = geo.cities[k]?.[0];
    const row = firstName
      ? geo.citiesFlat.find(
          (r) => r.county === meta.county && r.stateCode === meta.stateCode && r.city === firstName
        )
      : undefined;
    if (row) setCityRowKey(row.k);
  }

  useEffect(() => {
    if (listing) return;
    const t = window.setTimeout(() => {
      void geocodeTargetArea();
    }, 500);
    return () => window.clearTimeout(t);
  }, [city, county, zip, stateName, listing]);

  useEffect(() => {
    if (city.trim().length < 2 || county.trim().length < 2 || !stateName) return;
    if (zipManualLockRef.current) return;
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const q = `${city.trim()}, ${county.trim()} County, ${stateName}, USA`;
          const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`;
          const res = await fetch(url, { signal: ac.signal, headers: NOMINATIM_HEADERS });
          if (!res.ok) return;
          const rows = (await res.json()) as NominatimItem[];
          const pc = firstUsPostcode(rows[0]?.address?.postcode);
          if (pc && !zipManualLockRef.current && !ac.signal.aborted) setZip(pc);
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      })();
    }, 450);
    return () => {
      ac.abort();
      window.clearTimeout(t);
    };
  }, [city, county, stateName]);

  useEffect(() => {
    if (listing) return;
    const t = window.setTimeout(() => {
      void refreshLeadCount({ quiet: true });
    }, 450);
    return () => window.clearTimeout(t);
  }, [city, county, zip, stateName, radius, listing]);

  const mapPreviewRadius = listing ? listingRadiusId : radiusIdFromMiles(Number.parseFloat(radius));
  const mapPreviewRadiusMiles = listing ? radiusMilesFromId(listingRadiusId) : Number.parseFloat(radius) || 1;
  const mapPreviewRadiusLabel = listing
    ? (selectedListingRing?.label ?? `${mapPreviewRadiusMiles} mi`)
    : `${radius} mi`;
  const mapPreviewLat = mapLat;
  const mapPreviewLng = mapLng;

  async function refreshLeadCount(opts?: { quiet?: boolean; radiusOverride?: string }) {
    const radiusForRequest = opts?.radiusOverride ?? radius;
    setCountLoading(true);
    try {
      const result = await fetchLeadCount({
        city,
        county,
        zip,
        radiusMiles: Number.parseFloat(radiusForRequest),
        includeContact: LEAD_COUNT_DEFAULTS.includeContact,
        occupancy: LEAD_COUNT_DEFAULTS.occupancy,
        propertyTypes: LEAD_COUNT_DEFAULTS.propertyTypes,
        flags: LEAD_COUNT_DEFAULTS.flags,
      });
      let available = result.available;
      let baseAvail = result.baseAvailableInInventory;
      const coerced = coerceLeadCountDisplay(available, baseAvail);
      setEstimatedAvailable(coerced.available);
      const cap = Math.max(coerced.available, 1);
      setRequestedLeads((prev) => {
        const next = Math.min(Math.max(1, prev), cap);
        setSelectedTier(tierFromLeadCount(next));
        return next;
      });
      setApiBackendHint(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not refresh lead count.";
      if (msg.includes("web page instead of API")) setApiBackendHint(msg);
      else setApiBackendHint(null);
      if (!opts?.quiet) notifyError(msg.includes("web page instead of API") ? msg : "Could not refresh lead count.");
      const fallback = coerceLeadCountDisplay(0, 0);
      setEstimatedAvailable(fallback.available);
      const cap = Math.max(fallback.available, 1);
      setRequestedLeads((prev) => {
        const next = Math.min(Math.max(1, prev), cap);
        setSelectedTier(tierFromLeadCount(next));
        return next;
      });
    } finally {
      setCountLoading(false);
    }
  }

  async function geocodeTargetArea() {
    const query = [city, county, stateName, zip, "USA"].filter(Boolean).join(", ").trim();
    if (!query) return;
    setLocatingMap(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: NOMINATIM_HEADERS });
      if (!res.ok) throw new Error("geocode");
      const rows = (await res.json()) as { lat?: string; lon?: string }[];
      const first = rows[0];
      const lat = Number(first?.lat);
      const lng = Number(first?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setMapNotice("Could not pinpoint this area exactly. Showing last known map location.");
        return;
      }
      setMapLat(lat);
      setMapLng(lng);
      setMapNotice(null);
    } catch {
      setMapNotice("Could not update map location right now.");
    } finally {
      setLocatingMap(false);
    }
  }

  async function onBuy() {
    if (!email.includes("@")) {
      notifyError("Enter a valid email.");
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      notifyError("Enter a valid phone number (at least 10 digits).");
      return;
    }
    if (!tierBandOk) {
      notifyError(
        `Adjust number of leads to match ${selectedTierMeta.packageLabel} (${selectedTierBandLabel} homes), or pick a different plan row.`
      );
      return;
    }
    if (checkoutTotalCents < 50) {
      notifyError(`Order total is below the card minimum ($0.50). Increase leads to at least ${stripeMinLeads.toLocaleString()}.`);
      return;
    }
    setBusy(true);
    try {
      const listingLoc = listing ? parseListingLocation(listing) : null;
      const checkoutCity = (listingForm.city || listingLoc?.city || city).trim();
      const checkoutCounty = (listing?.county || county).trim();
      const checkoutZip = (listingForm.zip || listing?.zip || zip).trim();
      const { url } = await startLeadCheckout(
        serviceLine,
        selectedTier,
        email.trim(),
        phone.trim(),
        {
          city: checkoutCity,
          county: checkoutCounty,
          zip: checkoutZip,
          radiusMiles: listing ? radiusMilesFromId(listingRadiusId) : Number.parseFloat(radius),
          requestedLeads,
          campaignType,
          agentRole: orderingAgentRole ?? undefined,
          promoCode: appliedPromoCode ?? undefined,
        }
      );
      window.location.assign(url);
    } catch (e) {
      notifyError(checkoutFetchErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SeoHead
        title="Start prospecting your area | Circle Prospecting AI"
        description="Pick just listed or just sold, set your radius, choose data / AI / live lanes—we contact homeowners for you. Secure checkout and dashboard delivery."
        path="/buy-leads"
      />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space page-space--tight rzInterior buy-page">
          <div className="container buy-wrap">
            <div className="buy-stepper">
              {["Campaign type", "Neighborhood & radius", "Homes & service", "Checkout"].map((step, idx) => (
                <div key={step} className={`buy-step ${idx <= 2 ? "is-active" : ""}`}>
                  <span className="buy-step-n">{idx + 1}</span>
                  <span className="buy-step-t">{step}</span>
                </div>
              ))}
            </div>

            <header className="page-hero" style={{ marginBottom: "1rem" }}>
              <p className="page-breadcrumb">
                <Link to="/">Home</Link> / Start prospecting
              </p>
              <h1 className="page-h1 page-h1--gradient">
                {listing ? "Prospect homeowners around your listing" : "We’ll contact your market for you"}
              </h1>
              <p className="page-lead" style={{ maxWidth: 720 }}>
                {listing ? (
                  <>
                    Your <strong>{campaignType === "just_listed" ? "just listed" : "just sold"}</strong> campaign is pre-filled from this
                    property—pick a target ring, then your service lane. Checkout uses the agent contact on file.
                  </>
                ) : (
                  <>
                    Choose <strong>just listed</strong> or <strong>just sold</strong>, draw the radius, then pick your lane—<strong>data</strong>,{" "}
                    <strong>AI outreach</strong>, or <strong>live callers</strong>. Your budget is how many homeowners we reach; checkout is secure.
                    Status and handoffs live in your{" "}
                    <Link to="/dashboard" style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                      dashboard
                    </Link>
                    .
                  </>
                )}
              </p>
              <div className="buy-hero-pills" aria-label="Promotion checkout highlights">
                <span className="buy-hero-pill">We call &amp; text for you</span>
                <span className="buy-hero-pill">AI + live caller lanes</span>
                <span className="buy-hero-pill">Per-homeowner pricing</span>
              </div>
            </header>
            {import.meta.env.PROD && !isApiBaseConfigured() ? (
              <div className="cp-alert cp-alert--error" role="alert">
                <p style={{ margin: "0 0 0.35rem", fontWeight: 700 }}>Checkout needs a public API URL in the build</p>
                <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.45 }}>
                  Add <code className="cp-kbd">VITE_API_BASE_URL=https://your-api.example.com</code> to <code className="cp-kbd">.env</code> (your
                  Express server, no trailing slash), then <code className="cp-kbd">npm run build</code> and redeploy Hosting. On the API, set{" "}
                  <code className="cp-kbd">CORS_ORIGIN</code> to include this site’s origin and <code className="cp-kbd">APP_PUBLIC_URL</code> to this
                  hosting URL for Stripe redirects.
                </p>
              </div>
            ) : null}
            {apiBackendHint ? (
              <div className="cp-alert cp-alert--warn" role="status">
                <p style={{ margin: "0 0 0.35rem", fontWeight: 700 }}>API not reachable from this site URL</p>
                <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.45 }}>{apiBackendHint}</p>
              </div>
            ) : null}

            <BuyLeadsSearch disabled={listingLoading || busy} onResult={handleBuyLeadsSearch} />

            <section className="buy-grid">
              <div className="section-surface buy-card buy-card--filters">
                <h2 className="premium-h2">
                  {listing ? "Select your target area" : "Step 1: Your listing & target area"}
                </h2>
                {listingLoading ? (
                  <p className="muted" role="status" style={{ marginBottom: "0.75rem" }}>
                    Loading listing…
                  </p>
                ) : null}
                {!listing && !listingLoading && listingRef ? (
                  <p className="cp-alert cp-alert--warn" role="status" style={{ marginBottom: "0.85rem" }}>
                    Could not load listing <code className="cp-kbd">{listingRef}</code>. Use search above or enter your
                    details below.{" "}
                    <Link to="/buy-leads?mls=TB8479039&amp;agent=buyer">Buyer demo</Link> ·{" "}
                    <Link to="/buy-leads?mls=TB8445798&amp;agent=seller">Seller demo</Link>
                  </p>
                ) : null}
                {!listing && !listingLoading && !listingRef ? (
                  <p className="muted" role="status" style={{ marginBottom: "0.85rem", fontSize: "0.92rem" }}>
                    Search above to load a listing, or fill in your property details below to start a campaign.
                  </p>
                ) : null}
                {listing ? (
                  <div className="buy-listing-head" style={{ marginBottom: "1rem" }}>
                    <div className="buy-listing-head__ids">
                      <span className="buy-listing-mls">{listingForm.mls || listing.mls}</span>
                      <span className="buy-listing-sep" aria-hidden>
                        |
                      </span>
                      <span className="buy-listing-addr">
                        {listingForm.streetAddress || listing.address}
                        {listingForm.city.trim() ? `, ${listingForm.city.trim()}` : ""}
                        {listingForm.stateCode.trim() ? `, ${listingForm.stateCode.trim()}` : ""}
                        {listingForm.zip.trim() ? ` ${listingForm.zip.trim()}` : ""}
                      </span>
                    </div>
                  </div>
                ) : null}
                {dualAgents ? (
                  <>
                    <p className="muted" style={{ marginBottom: "0.85rem", fontSize: "0.92rem" }}>
                      This listing has a <strong>seller agent</strong> and a <strong>buyer agent</strong>. Choose who is
                      placing the order — seller orders use a <strong>Just sold</strong> campaign; buyer orders use{" "}
                      <strong>Just listed</strong>.
                    </p>
                    <div className="buy-agent-grid">
                      <ListingAgentCard
                        role="seller"
                        title="Seller agent"
                        campaignLabel="Just sold"
                        campaignType="just_sold"
                        values={sellerAgentForm}
                        onChange={onSellerAgentChange}
                        onSelectForOrder={() => activateAgentRole("seller")}
                        isActive={orderingAgentRole === "seller"}
                        disabled={listingLoading}
                      />
                      <ListingAgentCard
                        role="buyer"
                        title="Buyer agent"
                        campaignLabel="Just listed"
                        campaignType="just_listed"
                        values={buyerAgentForm}
                        onChange={onBuyerAgentChange}
                        onSelectForOrder={() => activateAgentRole("buyer")}
                        isActive={orderingAgentRole === "buyer"}
                        disabled={listingLoading}
                      />
                    </div>
                    <h3 className="buy-subsection-h" style={{ marginTop: "1.15rem" }}>
                      Property
                    </h3>
                    <p className="muted" style={{ marginBottom: "0.85rem", fontSize: "0.92rem" }}>
                      Shared listing address — map preview updates when you edit the address.
                    </p>
                    <ListingCampaignForm
                      values={listingForm}
                      onChange={onListingFormChange}
                      disabled={listingLoading}
                      propertyOnly
                    />
                  </>
                ) : (
                  <>
                    <p className="muted" style={{ marginBottom: "0.85rem", marginTop: listingLoading ? 0 : undefined }}>
                      Campaign type for this run:
                    </p>
                    <div className="buy-campaign-toggle" role="radiogroup" aria-label="Listing or sale campaign">
                      <button
                        type="button"
                        className={`buy-campaign-btn${campaignType === "just_listed" ? " is-selected" : ""}`}
                        aria-pressed={campaignType === "just_listed"}
                        onClick={() => setCampaignType("just_listed")}
                      >
                        <span className="buy-campaign-btn-title">Just listed</span>
                        <span className="buy-campaign-btn-sub">New listing promotion</span>
                      </button>
                      <button
                        type="button"
                        className={`buy-campaign-btn${campaignType === "just_sold" ? " is-selected" : ""}`}
                        aria-pressed={campaignType === "just_sold"}
                        onClick={() => setCampaignType("just_sold")}
                      >
                        <span className="buy-campaign-btn-title">Just sold</span>
                        <span className="buy-campaign-btn-sub">Sold promotion &amp; social proof</span>
                      </button>
                    </div>
                    <h3 className="buy-subsection-h" style={{ marginTop: "1.15rem" }}>
                      Listing &amp; agent
                    </h3>
                    <p className="muted" style={{ marginBottom: "0.85rem", fontSize: "0.92rem" }}>
                      Confirm or edit your contact info and property address. The map preview updates when you change the address.
                    </p>
                    <ListingCampaignForm
                      values={listingForm}
                      onChange={onListingFormChange}
                      disabled={listingLoading}
                    />
                  </>
                )}
                {listing ? (
                  <>
                    <p className="muted" style={{ margin: "1rem 0 0.75rem", fontSize: "0.92rem" }}>
                      {dualAgents ? (
                        <>
                          Select <strong>seller</strong> or <strong>buyer</strong> above, pick a ring, then{" "}
                          <strong>Order</strong> (seller = Just sold · buyer = Just listed).
                        </>
                      ) : (
                        <>
                          Pick a prospecting ring around this listing, then <strong>Order</strong> to choose your service
                          and checkout.
                        </>
                      )}
                    </p>
                    <div className="buy-opp-table-wrap">
                      <table className="buy-opp-table">
                        <thead>
                          <tr>
                            <th scope="col" className="buy-opp-col-select">
                              Select
                            </th>
                            <th scope="col">Area</th>
                            <th scope="col">Homeowners to prospect</th>
                            <th scope="col" className="buy-opp-col-action">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {LISTING_RADIUS_ORDER.map((rid) => {
                            const row = listing.radii[rid];
                            const active = listingRadiusId === rid;
                            return (
                              <tr key={rid} className={active ? "is-selected" : ""}>
                                <td className="buy-opp-col-select" data-label="Ring">
                                  <input
                                    type="radio"
                                    name="listing-ring"
                                    className="buy-opp-radio"
                                    checked={active}
                                    aria-label={`${row.label} — ${row.count.toLocaleString()} homeowners`}
                                    onChange={() => applyListingRadius(listing, rid)}
                                  />
                                </td>
                                <td data-label="Area">{row.label}</td>
                                <td data-label="Homeowners">
                                  <strong>{row.count.toLocaleString()}</strong> homeowners
                                </td>
                                <td className="buy-opp-col-action" data-label="Action">
                                  {dualAgents ? (
                                    <div className="buy-opp-order-pair">
                                      <button
                                        type="button"
                                        className="btn btn-primary buy-opp-order buy-opp-order--seller"
                                        onClick={() => selectListingRingAndContinue(listing, rid, "seller")}
                                      >
                                        Seller order
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-ghost buy-opp-order buy-opp-order--buyer"
                                        onClick={() => selectListingRingAndContinue(listing, rid, "buyer")}
                                      >
                                        Buyer order
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-primary buy-opp-order"
                                      onClick={() => selectListingRingAndContinue(listing, rid)}
                                    >
                                      Order
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
                {!listing ? (
                  <>
                <h3 className="buy-subsection-h">Target area (manual)</h3>
                <p className="muted" style={{ marginBottom: "0.8rem", marginTop: "0.35rem" }}>
                  Market center (city / county / ZIP) and how far out to reach homeowners.
                </p>
                {geoError ? (
                  <div className="cp-alert cp-alert--warn" role="alert">
                    <p style={{ margin: 0 }}>Location list failed to load: {geoError}</p>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ marginTop: "0.5rem" }}
                      onClick={() => {
                        setGeoError(null);
                        void loadUsGeoData().then(applyLoadedGeo).catch((e) => {
                          setGeoError(e instanceof Error ? e.message : "Could not load location data.");
                        });
                      }}
                    >
                      Retry
                    </button>
                  </div>
                ) : !geo ? (
                  <p className="muted" role="status">
                    Loading U.S. city and county lists…
                  </p>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "0.75rem" }} className="buy-filters-3">
                      <div className="cp-form-grid" style={{ position: "relative", zIndex: 4 }}>
                        <span className="muted-label" id="buy-city-label">
                          City
                        </span>
                        <input
                          className="premium-input"
                          id="buy-city-input"
                          aria-labelledby="buy-city-label"
                          aria-autocomplete="list"
                          aria-expanded={cityPickerOpen}
                          autoComplete="off"
                          value={cityPickerOpen ? cityQuery : (selectedCityRow?.label ?? "")}
                          onChange={(e) => {
                            setCityQuery(e.target.value);
                            setCityPickerOpen(true);
                            setCountyPickerOpen(false);
                            setCountyQuery("");
                          }}
                          onFocus={() => {
                            setCityPickerOpen(true);
                            setCountyPickerOpen(false);
                            setCountyQuery("");
                            setCityQuery((q) => (q.trim() ? q : (selectedCityRow?.city ?? "")));
                          }}
                          onBlur={() => {
                            window.setTimeout(() => {
                              setCityPickerOpen(false);
                              setCityQuery("");
                            }, 200);
                          }}
                          placeholder="Search city (e.g. Dunedin)…"
                        />
                        {cityPickerOpen && (
                          <ul
                            role="listbox"
                            aria-label="City search results"
                            className="buy-city-hitlist"
                          >
                            {cityQuery.trim().length < CITY_SEARCH_MIN ? (
                              <li className="muted" style={{ padding: "0.5rem 0.65rem", fontSize: "0.86rem" }}>
                                Type at least {CITY_SEARCH_MIN} letters…
                              </li>
                            ) : citySearchHits.length === 0 ? (
                              <li className="muted" style={{ padding: "0.5rem 0.65rem", fontSize: "0.86rem" }}>
                                No matches
                              </li>
                            ) : (
                              citySearchHits.map((r) => (
                                <li key={r.k} role="option">
                                  <button
                                    type="button"
                                    className="buy-city-hit-btn"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => pickCityRowFromSearch(r)}
                                  >
                                    {r.label}
                                  </button>
                                </li>
                              ))
                            )}
                          </ul>
                        )}
                      </div>
                      <div className="cp-form-grid" style={{ position: "relative", zIndex: 3 }}>
                        <span className="muted-label" id="buy-county-label">
                          County
                        </span>
                        <input
                          className="premium-input"
                          id="buy-county-input"
                          aria-labelledby="buy-county-label"
                          aria-autocomplete="list"
                          aria-expanded={countyPickerOpen}
                          autoComplete="off"
                          value={countyPickerOpen ? countyQuery : (selectedCountyRow?.label ?? "")}
                          onChange={(e) => {
                            setCountyQuery(e.target.value);
                            setCountyPickerOpen(true);
                            setCityPickerOpen(false);
                            setCityQuery("");
                          }}
                          onFocus={() => {
                            setCountyPickerOpen(true);
                            setCityPickerOpen(false);
                            setCityQuery("");
                            setCountyQuery((q) => (q.trim() ? q : (selectedCountyRow?.county ?? "")));
                          }}
                          onBlur={() => {
                            window.setTimeout(() => {
                              setCountyPickerOpen(false);
                              setCountyQuery("");
                            }, 200);
                          }}
                          placeholder="Search county (e.g. Pinellas)…"
                        />
                        {countyPickerOpen && (
                          <ul role="listbox" aria-label="County search results" className="buy-city-hitlist">
                            {countyQuery.trim().length < CITY_SEARCH_MIN ? (
                              <li className="muted" style={{ padding: "0.5rem 0.65rem", fontSize: "0.86rem" }}>
                                Type at least {CITY_SEARCH_MIN} letters…
                              </li>
                            ) : countySearchHits.length === 0 ? (
                              <li className="muted" style={{ padding: "0.5rem 0.65rem", fontSize: "0.86rem" }}>
                                No matches
                              </li>
                            ) : (
                              countySearchHits.map((c) => (
                                <li key={c.key} role="option">
                                  <button
                                    type="button"
                                    className="buy-city-hit-btn"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => pickCounty(c.key)}
                                  >
                                    {c.label}
                                  </button>
                                </li>
                              ))
                            )}
                          </ul>
                        )}
                      </div>
                      <label className="cp-form-grid">
                        <span className="muted-label">ZIP</span>
                        <input
                          className="premium-input"
                          value={zip}
                          onChange={(e) => {
                            const v = e.target.value;
                            zipManualLockRef.current = v.trim().length > 0;
                            setZip(v);
                          }}
                        />
                      </label>
                    </div>
                  </>
                )}
                <div style={{ marginTop: "1rem" }}>
                  <span className="muted-label">Radius (miles from center)</span>
                  <p className="muted" style={{ margin: "0.25rem 0 0.45rem", fontSize: "0.86rem" }}>
                    How large a ring around your listing pin to include in this campaign.
                  </p>
                  <div className="buy-radius-row">
                    {["0.25", "0.5", "1.0", "2.0", "3.0", "5.0"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={radius === r ? "btn btn-primary buy-radius-btn is-active" : "btn btn-ghost buy-radius-btn"}
                        onClick={() => {
                          setRadius(r);
                          void refreshLeadCount({ quiet: true, radiusOverride: r });
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                  </>
                ) : null}
              </div>

              <div className="section-surface buy-card buy-card--map">
                <h2 className="premium-h2">Map preview</h2>
                <div className="cp-map-frame buy-map-preview">
                  <ListingMap
                    lat={mapPreviewLat}
                    lng={mapPreviewLng}
                    radius={mapPreviewRadius}
                    radiusMiles={mapPreviewRadiusMiles}
                    radiusLabel={`${mapPreviewRadiusLabel} radius`}
                    height={290}
                  />
                </div>
                <p className="muted" style={{ marginTop: "0.6rem", fontSize: "0.9rem" }}>
                  {campaignType === "just_listed" ? "Just listed" : "Just sold"}
                  {listingForm.streetAddress.trim() || listing ? (
                    <>
                      {" "}
                      · {listingForm.mls || listing?.mls || "—"} · {listingForm.streetAddress.trim()}
                      {listingForm.city.trim() ? `, ${listingForm.city.trim()}` : ""}
                      {listingForm.stateCode.trim() ? `, ${listingForm.stateCode.trim()}` : ""}
                      {listingForm.zip.trim() ? ` ${listingForm.zip.trim()}` : ""}
                      {selectedListingRing ? ` · ${selectedListingRing.label}` : ""} · {requestedLeads.toLocaleString()} homes
                    </>
                  ) : (
                    <>
                      {" "}
                      · {city}, {county} ({zip}) · {radius} mi
                    </>
                  )}
                  {locatingMap ? " · locating…" : ""}
                </p>
                {mapNotice ? <p className="muted" style={{ marginTop: "0.35rem", fontSize: "0.82rem" }}>{mapNotice}</p> : null}
                <div className="buy-map-stats">
                  <div>
                    <span>Homeowners matched{countLoading && !listing ? " (updating…)" : ""}</span>
                    <strong>
                      {listing
                        ? requestedLeads.toLocaleString()
                        : formatHomeownersMatchedDisplay(estimatedAvailable)}
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            <section
              id="buy-service-step"
              className="section-surface buy-card"
              style={{ marginTop: "1rem" }}
            >
              <h2 className="premium-h2" style={{ marginBottom: "0.5rem" }}>Step 2: Homes to call — then your service</h2>
              <p className="muted" style={{ marginBottom: "1rem", fontSize: "0.92rem", maxWidth: 640 }}>
                {listing ? (
                  <>
                    Your <strong>listing ring</strong> in Step 1 sets the maximum homeowners ({listingHomesCap?.toLocaleString() ?? "—"}
                    {selectedListingRing ? ` · ${selectedListingRing.label}` : ""}). Choose how many to include in this order below — you can use fewer than the full ring (e.g. 500 of 789). Then pick your <strong>plan and product</strong>.
                  </>
                ) : (
                  <>
                    First choose <strong>how many homeowners</strong> we reach. Your plan band and per-home rate update automatically. Then pick the{" "}
                    <strong>plan and product</strong> in the rate tables (live, AI, hybrid, or data).
                  </>
                )}
              </p>

              <div className="buy-step2-block">
                <h3 className="buy-step2-subhead">1 · How many homes should we call?</h3>
                {listing && selectedListingRing && listingHomesCap != null ? (
                  <>
                    <div className="buy-listing-count-banner" role="status">
                      <span className="buy-listing-count-banner__n">{requestedLeads.toLocaleString()}</span>
                      <span className="buy-listing-count-banner__l">
                        homeowners in order · {selectedListingRing.label} (up to {listingHomesCap.toLocaleString()}) · plan{" "}
                        <strong>{selectedTierMeta.packageLabel}</strong>
                      </span>
                    </div>
                    <label className="cp-form-grid buy-home-exact" style={{ maxWidth: 360, marginTop: "1rem" }}>
                      <span className="muted-label">Homes to call (1–{listingHomesCap.toLocaleString()})</span>
                      <input
                        type="number"
                        className="premium-input"
                        min={1}
                        max={listingHomesCap}
                        value={requestedLeads}
                        onChange={(e) => applyHomeCount(Number.parseInt(e.target.value || "1", 10))}
                      />
                    </label>
                    <p className="buy-tier-auto muted" style={{ marginTop: "0.65rem", fontSize: "0.88rem" }}>
                      {!tierBandOk ? (
                        <>
                          Selected <strong>{selectedTierMeta.packageLabel}</strong> does not match {requestedLeads.toLocaleString()} homes — pick a
                          matching row below or change homes.{" · "}
                        </>
                      ) : null}
                      <strong>{formatMoneyUsd(pricePerLeadUsd(serviceLine, selectedTier, appliedPromoCode))}</strong> per home with{" "}
                      <strong>{serviceLineLabel(serviceLine)}</strong> →{" "}
                      <strong className="gradient-text">{formatMoneyUsd(checkoutTotalCents / 100)}</strong> estimated total
                    </p>
                  </>
                ) : (
                  <>
                <div className="buy-pack-grid buy-home-presets" role="group" aria-label="Homeowner count presets">
                  {HOME_COUNT_PRESETS.map((n) => {
                    const active = requestedLeads === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        className={`buy-pack-card${active ? " is-active" : ""}`}
                        aria-pressed={active}
                        onClick={() => applyHomeCount(n)}
                      >
                        <span className="buy-pack-name">{n.toLocaleString()}</span>
                        <span className="buy-pack-unit">homeowners</span>
                      </button>
                    );
                  })}
                  {estimatedAvailable > 0 ? (
                    <button
                      type="button"
                      className={`buy-pack-card${requestedLeads === estimatedAvailable ? " is-active" : ""}`}
                      aria-pressed={requestedLeads === estimatedAvailable}
                      onClick={() => applyHomeCount(estimatedAvailable)}
                    >
                      <span className="buy-pack-name">Max</span>
                      <span className="buy-pack-unit">{formatHomeownersMatchedDisplay(estimatedAvailable)} matched</span>
                    </button>
                  ) : null}
                </div>

                <label className="cp-form-grid buy-home-exact" style={{ maxWidth: 360, marginTop: "1rem" }}>
                  <span className="muted-label">Exact count (updates plan automatically)</span>
                  <input
                    type="number"
                    className="premium-input"
                    min={1}
                    max={homesCap}
                    value={requestedLeads}
                    onChange={(e) => applyHomeCount(Number.parseInt(e.target.value || "1", 10))}
                  />
                </label>
                  </>
                )}
              </div>

              <div className="buy-step2-block" style={{ marginTop: "1.35rem" }}>
                <h3 className="buy-step2-subhead">2 · Choose your plan (4 packages)</h3>
                <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.88rem", maxWidth: 720 }}>
                  <strong>Dabble</strong>, <strong>Starter</strong>, <strong>Growth</strong>, and <strong>Scale</strong> — use the radio on a row
                  (or click the row) to set plan band and product. Rates are per homeowner at checkout.
                </p>
                <div className="buy-pricing-scroll">
                <div className="buy-pricing-stack" role="group" aria-label="Plan packages by product">
                  {visibleServiceLines.map((line) => {
                    const serviceSelected = serviceLine === line.id;
                    return (
                      <div key={line.id} className={`buy-pricing-block${serviceSelected ? " is-selected" : ""}`}>
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
                              <th scope="col" className="buy-price-col-select">
                                Select
                              </th>
                              <th scope="col">Package</th>
                              <th scope="col">Homes</th>
                              <th scope="col">Per home</th>
                            </tr>
                          </thead>
                          <tbody>
                            {LEAD_TIERS.map((tier, idx) => {
                              const planPick = serviceLine === line.id && selectedTier === tier.id;
                              const rowBg = idx % 2 === 1 ? "rgba(15,23,42,0.04)" : "#fff";
                              const price = appliedPromoCode
                                ? pricePerLeadUsd(line.id, tier.id, appliedPromoCode)
                                : LEAD_PRICE_MATRIX[line.id][idx];
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

              {checkoutTotalCents < 50 && (
                <p className="cp-alert cp-alert--warn" style={{ marginTop: "0.85rem" }} role="status">
                  Card checkout requires at least <strong>{formatMoneyUsd(0.5)}</strong>. Increase homes to{" "}
                  <strong>{stripeMinLeads.toLocaleString()}</strong> or more at this rate.
                </p>
              )}
            </section>

            <section className="section-surface buy-card buy-card--summary" style={{ marginTop: "1rem" }}>
              <h2 className="premium-h2" style={{ marginBottom: "0.8rem" }}>Step 3: Review &amp; checkout</h2>
              <p className="muted" style={{ margin: "0 0 0.85rem", fontSize: "0.9rem", maxWidth: 640 }}>
                Confirm your selection — totals update when you change the ring or plan row above.
              </p>
              <div className="buy-summary-grid">
                {listing ? (
                  <div className="buy-summary-span2">
                    <span>Listing</span>
                    <strong>
                      {listing.mls} · {listing.address}, {listing.cityStateZip}
                    </strong>
                  </div>
                ) : null}
                <div>
                  <span>Campaign</span>
                  <strong>{campaignType === "just_listed" ? "Just listed" : "Just sold"}</strong>
                </div>
                <div>
                  <span>{listing ? "Target ring" : "Target area"}</span>
                  <strong>
                    {listing && selectedListingRing
                      ? selectedListingRing.label
                      : `${city}, ${county} ${zip} · ${radius} mi`}
                  </strong>
                </div>
                <div>
                  <span>Homes in order</span>
                  <strong>{requestedLeads.toLocaleString()}</strong>
                </div>
                <div>
                  <span>Service (product)</span>
                  <strong>{serviceLineLabel(serviceLine)}</strong>
                </div>
                <div>
                  <span>Plan band</span>
                  <strong>
                    {selectedTierMeta.packageLabel} · {formatMoneyUsd(pricePerLeadUsd(serviceLine, selectedTier, appliedPromoCode))}/home
                  </strong>
                </div>
                {!listing ? (
                  <>
                    <div>
                      <span>Homeowners matched</span>
                      <strong>{formatHomeownersMatchedDisplay(estimatedAvailable)}</strong>
                    </div>
                  </>
                ) : null}
                <div>
                  <span>Campaign total (est.)</span>
                  <strong className="gradient-text">{formatMoneyUsd(checkoutTotalCents / 100)}</strong>
                </div>
              </div>
              <div style={{ marginTop: "1rem", display: "grid", gap: "0.85rem" }}>
                <label className="cp-form-grid" style={{ maxWidth: 440 }}>
                  <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                    Email (delivery + receipt)
                    {listing ? " — pre-filled from listing agent" : ""}
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="premium-input"
                    placeholder="you@yourbrokerage.com"
                  />
                </label>
                <label className="cp-form-grid" style={{ maxWidth: 440 }}>
                  <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                    Mobile phone
                    {listing ? " — pre-filled from listing agent" : ""}
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    className="premium-input"
                    placeholder="+1 (555) 000-0000"
                  />
                </label>
                <PromoCodeField
                  value={promoInput}
                  onChange={setPromoInput}
                  onApply={handlePromoApply}
                  appliedCode={appliedPromoCode}
                  disabled={busy}
                />
                <p style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.5, margin: 0 }}>
                  By continuing you agree to our{" "}
                  <Link to="/terms" style={{ color: "var(--accent-cyan)" }}>
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" style={{ color: "var(--accent-cyan)" }}>
                    Privacy
                  </Link>
                  . You are responsible for compliant use of prospecting data (e.g. DNC / state rules).
                </p>
                <div className="buy-cta-row">
                  <div className="buy-cta-meta">Secure checkout • Cancel anytime</div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || !tierBandOk || checkoutTotalCents < 50}
                    onClick={onBuy}
                  >
                    {busy ? "Redirecting to Stripe…" : "Continue to checkout"}
                  </button>
                </div>
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "1.1rem" }}>
                Need help? {contactEmail()}
              </p>
            </section>

            <section className="section-surface buy-next-bar" style={{ marginTop: "1rem" }}>
              <h2 className="premium-h2" style={{ marginBottom: "0.75rem", fontSize: "1.05rem" }}>
                What happens next?
              </h2>
              <ol className="buy-next-steps">
                {BUY_NEXT_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>

            <ul className="buy-trust-row" aria-label="Order assurances">
              {BUY_TRUST_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <style>{`
              .buy-campaign-toggle {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 0.75rem;
                margin-bottom: 0.25rem;
              }
              @media (max-width: 560px) {
                .buy-campaign-toggle { grid-template-columns: 1fr; }
              }
              .buy-campaign-btn {
                text-align: left;
                padding: 0.85rem 1rem;
                border-radius: 14px;
                border: 2px solid rgba(15, 23, 42, 0.12);
                background: #fff;
                cursor: pointer;
                transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
                font: inherit;
              }
              .buy-campaign-btn.is-selected {
                border-color: rgba(0, 122, 255, 0.55);
                box-shadow: 0 0 0 1px rgba(0, 122, 255, 0.18);
                background: rgba(0, 122, 255, 0.07);
              }
              .buy-campaign-btn:focus-visible {
                outline: 2px solid rgba(0, 122, 255, 0.45);
                outline-offset: 2px;
              }
              .buy-campaign-btn-title {
                display: block;
                font-weight: 800;
                font-size: 1.05rem;
                color: #0f172a;
              }
              .buy-campaign-btn-sub {
                display: block;
                font-size: 0.82rem;
                color: #64748b;
                margin-top: 0.28rem;
                line-height: 1.35;
              }
              .buy-subsection-h {
                margin: 1.35rem 0 0;
                font-size: 1rem;
                font-weight: 800;
                color: #0f172a;
                letter-spacing: -0.02em;
              }
              .buy-wrap { max-width: 1180px; }
              .buy-grid {
                display: grid;
                grid-template-columns: 1.15fr 0.85fr;
                gap: 1.25rem;
                margin-top: 0.25rem;
              }
              .buy-card {
                border-radius: 18px;
                box-shadow: 0 16px 38px rgba(5, 12, 26, 0.07);
              }
              .buy-card input,
              .buy-card select,
              .buy-card textarea {
                background: #fff !important;
                color: #0f172a !important;
                border: 1px solid rgba(15, 23, 42, 0.2) !important;
              }
              .buy-card input::placeholder,
              .buy-card textarea::placeholder {
                color: #64748b !important;
              }
              .buy-city-hitlist {
                position: absolute;
                left: 0;
                right: 0;
                top: 100%;
                margin: 4px 0 0;
                padding: 0;
                list-style: none;
                max-height: 240px;
                overflow-y: auto;
                background: #fff;
                border: 1px solid rgba(15, 23, 42, 0.18);
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
                z-index: 50;
                color: #0f172a;
              }
              .buy-city-hit-btn {
                display: block;
                width: 100%;
                text-align: left;
                padding: 0.45rem 0.65rem;
                border: none;
                background: transparent;
                color: inherit;
                font: inherit;
                cursor: pointer;
              }
              .buy-city-hit-btn:hover {
                background: rgba(0, 122, 255, 0.08);
              }
              .buy-card--filters {
                background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
              }
              .buy-card--map {
                background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
              }
              .buy-map-preview {
                min-height: 290px;
              }
              .buy-map-preview .gradient-border {
                width: 100%;
                border-radius: 14px;
              }
              .buy-card--summary {
                background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
              }
              .buy-hero-pills {
                margin-top: 0.85rem;
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
              }
              .buy-hero-pill {
                padding: 0.38rem 0.65rem;
                border-radius: 999px;
                font-size: 0.74rem;
                font-weight: 700;
                letter-spacing: 0.01em;
                color: #0f4c86;
                background: rgba(0, 122, 255, 0.08);
                border: 1px solid rgba(0, 122, 255, 0.2);
              }
              .buy-stepper {
                display: grid;
                grid-template-columns: repeat(4,minmax(0,1fr));
                gap: 0.6rem;
                margin-bottom: 1rem;
              }
              .buy-step {
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 0.55rem 0.7rem;
                background: #fff;
                display: flex;
                align-items: center;
                gap: 0.45rem;
              }
              .buy-step.is-active { border-color: rgba(0,122,255,0.45); box-shadow: 0 0 0 1px rgba(0,122,255,0.14) inset; }
              .buy-step-n {
                width: 22px; height: 22px; border-radius: 50%;
                display: inline-flex; align-items: center; justify-content: center;
                font-size: 0.78rem; font-weight: 700;
                background: rgba(0,122,255,0.12); color: #005ecf;
              }
              .buy-step-t { font-size: 0.8rem; color: var(--muted); font-weight: 600; }
              .buy-radius-btn {
                border-radius: 999px !important;
                padding: 0.45rem 0.8rem !important;
                font-size: 0.82rem !important;
                font-weight: 700 !important;
                min-width: 60px;
              }
              .buy-radius-btn.btn-primary:hover:not(:disabled) {
                background: linear-gradient(90deg, var(--cp-blue-hover) 0%, var(--cp-lime-hover) 100%) !important;
                color: #050c1a !important;
                filter: none !important;
              }
              .buy-pack-grid {
                display: grid;
                grid-template-columns: repeat(4,minmax(0,1fr));
                gap: 0.8rem;
              }
              .buy-home-presets {
                grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
              }
              .buy-step2-subhead {
                margin: 0 0 0.65rem;
                font-size: 0.95rem;
                font-weight: 800;
                letter-spacing: -0.02em;
                color: var(--text, #0f172a);
              }
              .buy-home-slider {
                display: grid;
                gap: 0.4rem;
                margin-top: 0.75rem;
                max-width: 420px;
              }
              .buy-home-range {
                width: 100%;
                accent-color: #007aff;
                height: 6px;
              }
              .buy-service-card {
                text-align: left;
                align-items: flex-start;
              }
              .buy-service-card .buy-pack-price {
                font-size: 1.35rem;
              }
              .buy-pricing-stack {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 0.65rem;
                align-items: stretch;
              }
              .buy-pricing-block {
                min-width: 0;
                border-radius: 14px;
                overflow: hidden;
                border: 2px solid rgba(15, 23, 42, 0.08);
                cursor: pointer;
                transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
              }
              .buy-pricing-block:hover {
                transform: translateY(-1px);
                box-shadow: 0 10px 26px rgba(5, 12, 26, 0.08);
              }
              .buy-pricing-block.is-selected {
                border-color: rgba(0, 122, 255, 0.55);
                box-shadow: 0 8px 28px rgba(0, 122, 255, 0.12);
              }
              .buy-price-banner--hit {
                padding: 0 !important;
              }
              .buy-price-title-btn {
                all: unset;
                box-sizing: border-box;
                display: block;
                width: 100%;
                text-align: left;
                cursor: pointer;
                padding: 0.5rem 0.55rem;
                font-weight: 800;
                font-size: clamp(0.72rem, 0.9vw, 0.95rem);
                letter-spacing: 0.02em;
                line-height: 1.2;
                hyphens: auto;
                overflow-wrap: break-word;
              }
              .buy-price-title-btn:focus-visible {
                outline: 2px solid rgba(255,255,255,0.85);
                outline-offset: 2px;
              }
              .buy-price-row.is-plan-selected td:first-child + td {
                font-weight: 700;
              }
              .buy-price-row.is-plan-selected {
                box-shadow: inset 0 0 0 2px rgba(0, 122, 255, 0.35);
              }
              .buy-price-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.76rem;
                table-layout: fixed;
              }
              .buy-price-banner {
                text-align: left;
                padding: 0.65rem 0.9rem;
                font-weight: 800;
                font-size: 1.02rem;
                letter-spacing: 0.02em;
              }
              .buy-price-colheads th {
                background: #f1f5f9;
                color: #0f172a;
                font-weight: 700;
                font-size: 0.58rem;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                padding: 0.32rem 0.4rem;
                border-bottom: 1px solid rgba(15, 23, 42, 0.1);
                text-align: left;
                vertical-align: bottom;
              }
              .buy-price-col-select {
                width: 2.5rem;
                text-align: center;
                vertical-align: middle;
              }
              .buy-price-colheads th:nth-child(4),
              .buy-price-table td:nth-child(4) {
                text-align: right;
              }
              .buy-price-table td {
                padding: 0.38rem 0.4rem;
                border-bottom: 1px solid rgba(15, 23, 42, 0.06);
                color: #0f172a;
                overflow-wrap: anywhere;
              }
              .buy-price-table td:nth-child(4) {
                text-align: right;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
              }
              .buy-price-table tbody tr:last-child td {
                border-bottom: none;
              }
              .buy-pack-card {
                border: 1px solid var(--border);
                background: #fff;
                border-radius: 14px;
                padding: 1rem;
                text-align: left;
                display: grid;
                gap: 0.18rem;
                cursor: pointer;
                color: var(--text);
                transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
              }
              .buy-pack-card.is-active {
                border-color: rgba(0,122,255,0.55);
                box-shadow: 0 0 0 1px rgba(0,122,255,0.12) inset, 0 12px 35px rgba(0,122,255,0.12);
              }
              .buy-pack-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 26px rgba(5, 12, 26, 0.1);
              }
              .buy-pack-name { font-size: 1.02rem; font-weight: 700; }
              .buy-pack-price { font-size: 1.75rem; font-weight: 800; line-height: 1.05; margin-top: 0.1rem; }
              .buy-pack-unit { font-size: 0.82rem; color: var(--muted); }
              .buy-pack-save {
                margin-top: 0.45rem;
                color: #2f4f00;
                font-size: 0.78rem;
                border: 1px solid rgba(162,215,41,0.4);
                background: rgba(162,215,41,0.14);
                border-radius: 999px;
                width: fit-content;
                padding: 0.15rem 0.45rem;
              }
              .buy-campaign-badge {
                display: inline-block;
                margin-bottom: 0.85rem;
                padding: 0.35rem 0.75rem;
                border-radius: 999px;
                font-size: 0.82rem;
                font-weight: 800;
                letter-spacing: 0.02em;
                text-transform: uppercase;
              }
              .buy-campaign-badge--just_listed {
                background: rgba(0, 122, 255, 0.12);
                color: #0369a1;
                border: 1px solid rgba(0, 122, 255, 0.28);
              }
              .buy-campaign-badge--just_sold {
                background: rgba(162, 215, 41, 0.18);
                color: #365314;
                border: 1px solid rgba(101, 163, 13, 0.35);
              }
              .buy-listing-sep {
                color: #94a3b8;
                font-weight: 700;
                user-select: none;
              }
              .buy-opp-col-select { width: 3.25rem; text-align: center; }
              .buy-opp-col-action { width: 7.5rem; text-align: right; }
              .buy-opp-radio {
                width: 1.05rem;
                height: 1.05rem;
                accent-color: #007aff;
                cursor: pointer;
              }
              .buy-opp-order {
                min-width: 5.5rem;
                padding: 0.4rem 0.85rem;
                font-size: 0.88rem;
              }
              .buy-next-bar {
                border-radius: 18px;
                background: linear-gradient(90deg, rgba(0, 122, 255, 0.12), rgba(0, 122, 255, 0.04));
                border: 1px solid rgba(0, 122, 255, 0.2);
              }
              .buy-next-steps {
                margin: 0;
                padding: 0;
                list-style: none;
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 0.65rem;
                counter-reset: buy-step;
              }
              .buy-next-steps li {
                counter-increment: buy-step;
                border-radius: 12px;
                background: #fff;
                border: 1px solid var(--border);
                padding: 0.65rem 0.75rem 0.65rem 2.35rem;
                font-size: 0.88rem;
                line-height: 1.4;
                position: relative;
              }
              .buy-next-steps li::before {
                content: counter(buy-step);
                position: absolute;
                left: 0.65rem;
                top: 0.62rem;
                width: 1.35rem;
                height: 1.35rem;
                border-radius: 999px;
                background: #007aff;
                color: #fff;
                font-size: 0.72rem;
                font-weight: 800;
                display: grid;
                place-items: center;
              }
              .buy-trust-row {
                margin: 0.85rem 0 0;
                padding: 0;
                list-style: none;
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 0.55rem;
              }
              .buy-trust-row li {
                font-size: 0.8rem;
                color: var(--muted);
                line-height: 1.35;
                padding: 0.5rem 0.55rem;
                border-radius: 10px;
                background: rgba(15, 23, 42, 0.03);
                border: 1px solid var(--border);
              }
              @media (max-width: 900px) {
                .buy-next-steps, .buy-trust-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              }
              @media (max-width: 560px) {
                .buy-next-steps, .buy-trust-row { grid-template-columns: 1fr; }
              }
              .buy-listing-head {
                margin-bottom: 1rem;
                padding: 0.85rem 1rem;
                border-radius: 14px;
                border: 1px solid rgba(0, 122, 255, 0.18);
                background: linear-gradient(135deg, rgba(0, 122, 255, 0.06), rgba(162, 215, 41, 0.05));
              }
              .buy-listing-head__ids {
                display: flex;
                flex-wrap: wrap;
                align-items: baseline;
                gap: 0.65rem 1.25rem;
                margin-bottom: 0.55rem;
              }
              .buy-listing-mls {
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: 1.35rem;
                font-weight: 800;
                letter-spacing: 0.02em;
                color: #38bdf8;
              }
              .buy-listing-addr {
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: 1.05rem;
                font-weight: 700;
                color: #0ea5e9;
              }
              .buy-listing-agent {
                display: flex;
                flex-wrap: wrap;
                gap: 0.35rem 1.1rem;
                font-size: 0.88rem;
                line-height: 1.45;
              }
              .buy-opp-table-wrap {
                overflow-x: auto;
                border-radius: 12px;
                border: 1px solid var(--border);
              }
              .buy-opp-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.92rem;
              }
              .buy-opp-table th,
              .buy-opp-table td {
                padding: 0.65rem 0.85rem;
                text-align: left;
                border-bottom: 1px solid var(--border);
              }
              .buy-opp-table th {
                font-size: 0.78rem;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: var(--muted);
                background: rgba(15, 23, 42, 0.03);
              }
              .buy-opp-table tr.is-selected td {
                background: rgba(0, 122, 255, 0.07);
              }
              .buy-opp-select.is-active {
                border-color: rgba(0, 122, 255, 0.45);
                font-weight: 700;
              }
              .buy-listing-count-banner {
                border: 1px solid rgba(0, 122, 255, 0.22);
                border-radius: 14px;
                padding: 1rem 1.1rem;
                background: rgba(0, 122, 255, 0.06);
              }
              .buy-listing-count-banner__n {
                display: block;
                font-size: 2rem;
                font-weight: 800;
                line-height: 1.1;
                color: #0f172a;
              }
              .buy-listing-count-banner__l {
                display: block;
                margin-top: 0.25rem;
                font-size: 0.92rem;
                color: var(--muted);
              }
              .buy-summary-span2 {
                grid-column: 1 / -1;
              }
              .buy-summary-grid {
                display: grid;
                grid-template-columns: repeat(3,minmax(0,1fr));
                gap: 0.65rem;
              }
              .buy-summary-grid div {
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 0.65rem 0.75rem;
                background: #fff;
                display: grid;
                gap: 0.2rem;
              }
              .buy-summary-grid span { color: var(--muted); font-size: 0.78rem; }
              .buy-summary-grid strong { font-size: 0.96rem; }
              .buy-map-stats {
                margin-top: 0.85rem;
                display: grid;
                grid-template-columns: 1fr;
                gap: 0.55rem;
                max-width: 280px;
              }
              .buy-map-stats div {
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 0.55rem 0.65rem;
                background: #fff;
                display: grid;
                gap: 0.18rem;
              }
              .buy-map-stats span {
                color: var(--muted);
                font-size: 0.75rem;
              }
              .buy-map-stats strong {
                font-size: 0.96rem;
                color: var(--text);
              }
              .buy-cta-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.9rem;
                flex-wrap: wrap;
              }
              .buy-cta-meta { color: var(--muted); font-size: 0.85rem; }
              @media (max-width: 1100px) {
                .buy-pricing-stack {
                  grid-template-columns: repeat(2, minmax(0, 1fr));
                  gap: 0.75rem;
                }
                .buy-price-table { font-size: 0.8rem; }
                .buy-price-title-btn {
                  font-size: 0.92rem;
                  padding: 0.55rem 0.65rem;
                }
                .buy-price-colheads th { font-size: 0.65rem; padding: 0.38rem 0.5rem; }
                .buy-price-table td { padding: 0.45rem 0.5rem; }
              }
              @media (max-width: 960px) {
                .buy-grid { grid-template-columns: 1fr !important; }
                .buy-pack-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
                .buy-summary-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
              }
              @media (max-width: 600px) {
                .buy-pricing-stack {
                  grid-template-columns: 1fr;
                  gap: 0.85rem;
                }
                .buy-price-table { font-size: 0.88rem; }
                .buy-price-title-btn {
                  font-size: 1.02rem;
                  padding: 0.65rem 0.85rem;
                }
                .buy-price-colheads th { font-size: 0.72rem; padding: 0.42rem 0.65rem; }
                .buy-price-table td { padding: 0.52rem 0.65rem; }
              }
              @media (max-width: 720px) {
                .buy-filters-3, .buy-filters-2 { grid-template-columns: 1fr !important; }
                .buy-stepper { grid-template-columns: repeat(2,minmax(0,1fr)); }
              }
              @media (max-width: 560px) {
                .buy-stepper { grid-template-columns: 1fr; }
                .pack-grid { grid-template-columns: 1fr !important; }
                .pack-tile { width: 100%; }
                .buy-pack-grid { grid-template-columns: 1fr; }
                .buy-summary-grid { grid-template-columns: 1fr; }
                .buy-map-stats { grid-template-columns: 1fr; }
              }
            `}</style>
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
