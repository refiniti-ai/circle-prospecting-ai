import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { ListingAgentCard } from "../components/ListingAgentCard";
import { BuyLeadsSearch, type BuyLeadsSearchResult } from "../components/BuyLeadsSearch";
import { buildDraftListingFromForm, resolveRealMls } from "../lib/listingDraft";
import { isProductionSiteHost } from "../lib/siteUrl";
import { apiBase, isApiBaseConfigured } from "../lib/apiBase";
import {
  fetchLeadCount,
  reportCheckoutCanceled,
  startLeadCheckout,
  type CampaignPropertyType,
} from "../lib/leadsApi";
import {
  checkoutPricePerLeadUsd,
  defaultCheckoutServiceLine,
  isServiceLineHiddenDuringBeta,
  tierFromLeadCount,
  totalCentsForSelection,
  leadCountFitsTier,
  tierRowMeta,
  formatMoneyUsd,
  serviceLineLabel,
  minLeadsForStripeForTier,
  type LeadServiceLine,
  type LeadTierId,
} from "../lib/leadPricing";
import { loadUsGeoData, type UsGeoData, type UsCityRow } from "../lib/usGeo";
import { fetchOrderById } from "../lib/apiClient";
import {
  applyListingFormValues,
  emptyListingFormValues,
  getLocalDemoOrder,
  DEFAULT_LISTING_RADIUS_ID,
  ORDER_LAYOUT_SHELL,
  listingAddressGeocodeQuery,
  formatListingDisplayAddress,
  normalizeListingFormValues,
  listingFormValuesFromPayload,
  hasValidMapCoords,
  radiusRingLabel,
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
  agentRoleFromPathSegment,
  campaignForAgentRole,
  emptyAgentForm,
  getBuyerAgent,
  getSellerAgent,
  listingHasDualAgents,
  normalizeListingAgents,
  patchListingAgents,
  type ListingAgentFormValues,
  type ListingAgentRole,
} from "../lib/listingAgents";
import { notifyError, notifyWarning } from "../lib/notify";
import { trackFirstPromoterReferral } from "../lib/firstPromoter";
import { radiusIdFromMiles } from "../lib/mapUtils";
import { geocodeUSAddress } from "../lib/geocodeAddress";
import { campaignPathFromListingPayload } from "../lib/ghlContactRole";
import { buildMlsLeadsUrl, campaignPathFromLocationPathname, decodeMlsPathParam } from "../lib/mlsUrl";
import { searchAgentPath } from "../lib/introAgentPhone";
import { campaignTypeFromPathSegment, type MlsCampaignPathSegment } from "../lib/mlsCampaignPath";
import {
  resolveCampaignTypeForListing,
  resolveLockedCampaignType,
  type CampaignTypeLockSource,
} from "../lib/listingCampaignType";
import {
  MultipleGhlMlsHitsError,
  resolveListingByMls,
  type GhlContactSearchHit,
} from "../lib/buyLeadsSearchApi";
import { buildListingCacheKey, readListingCache } from "../lib/listingCache";
import { BuyListingPropertyCard } from "../components/BuyListingPropertyCard";
import { BuyMapPreviewCard } from "../components/BuyMapPreviewCard";
import { BuyCheckoutReview } from "../components/BuyCheckoutReview";
import { BuyOrderTrustStrip } from "../components/BuyOrderTrustStrip";
import { BuyOrderSummarySidebar } from "../components/BuyOrderSummarySidebar";
import { BuyRadiusIconPicker } from "../components/BuyRadiusIconPicker";
import { BuyServicePlanCards } from "../components/BuyServicePlanCards";
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
  return isProductionSiteHost(window.location.hostname);
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

function campaignTypeFromParam(raw: string | null): ListingCampaignType | null {
  if (raw === "just_listed" || raw === "just_sold") return raw;
  return null;
}

function firstUsPostcode(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const part = raw.split(";")[0]?.trim();
  return part || null;
}

type BuyLeadsLocationState = { preloadedListing?: ListingPayload };

export function BuyLeads() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mls: mlsPathParam, agentRole: agentPathParam } = useParams();
  const [sp] = useSearchParams();
  const canceled = sp.get("canceled");
  const mlsFromPath = decodeMlsPathParam(mlsPathParam);
  const campaignPathFromUrl: MlsCampaignPathSegment | null = campaignPathFromLocationPathname(location.pathname);
  const listingRef = sp.get("order") ?? (mlsFromPath || sp.get("mls") || null);
  const pathAgentSegment = location.pathname.split("/").filter(Boolean)[0];
  const agentFromPath = agentRoleFromPathSegment(agentPathParam) ?? agentRoleFromPathSegment(pathAgentSegment);
  const agentFromUrl = agentFromPath ?? agentRoleFromParam(sp.get("agent"));
  /** GHL contact from welcome email / tracked /go link (?c=). */
  const ghlContactIdFromUrl = sp.get("c") ?? sp.get("contactId");
  const campaignFromUrl = campaignTypeFromParam(sp.get("campaign"));
  /** Welcome-email MLS link — auto-load contact; no multi-match picker. */
  const isWelcomeMlsLink = Boolean(mlsFromPath && (campaignPathFromUrl || agentFromPath || ghlContactIdFromUrl));
  const [listing, setListing] = useState<ListingPayload | null>(null);
  const [listingForm, setListingForm] = useState<ListingFormValues>(emptyListingFormValues);
  const [sellerAgentForm, setSellerAgentForm] = useState<ListingAgentFormValues>(emptyAgentForm);
  const [buyerAgentForm, setBuyerAgentForm] = useState<ListingAgentFormValues>(emptyAgentForm);
  const [orderingAgentRole, setOrderingAgentRole] = useState<ListingAgentRole | null>(() => agentFromUrl);
  const [listingLoading, setListingLoading] = useState(() => Boolean(listingRef));
  /** Multiple GHL contacts share this MLS — user must pick one in search. */
  const [pendingMlsHits, setPendingMlsHits] = useState<GhlContactSearchHit[]>([]);
  const [listingRadiusId, setListingRadiusId] = useState<RadiusId>(DEFAULT_LISTING_RADIUS_ID);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignPropertyType>(
    () => campaignFromUrl ?? (campaignPathFromUrl ? campaignTypeFromPathSegment(campaignPathFromUrl) : "just_listed")
  );
  const [lockedCampaignType, setLockedCampaignType] = useState<ListingCampaignType | null>(
    () => campaignFromUrl ?? (campaignPathFromUrl ? campaignTypeFromPathSegment(campaignPathFromUrl) : null)
  );
  const [campaignLockSource, setCampaignLockSource] = useState<CampaignTypeLockSource | null>(
    () => (campaignFromUrl ? "url" : null)
  );
  const [serviceLine, setServiceLine] = useState<LeadServiceLine>(() => defaultCheckoutServiceLine());
  /** Explicit plan row (Dabble … Scale); click a row in any pricing table to set service + plan. */
  const [selectedTier, setSelectedTier] = useState<LeadTierId>(() => tierFromLeadCount(500));
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const canceledToastShown = useRef(false);
  /** Set when /api returns HTML (e.g. Firebase Hosting without API proxy). */
  const [apiBackendHint, setApiBackendHint] = useState<string | null>(null);
  const [geo, setGeo] = useState<UsGeoData | null>(null);
  /** Row key from bundled US cities list (`city|county|ST`). */
  const [cityRowKey, setCityRowKey] = useState("");
  /** County key `County|ST` — used for lead-count API fallback when no listing is loaded. */
  const [countyKey, setCountyKey] = useState("");
  const [zip, setZip] = useState("34698");
  const [radius, setRadius] = useState("1.0");
  const [requestedLeads, setRequestedLeads] = useState(500);
  const [estimatedAvailable, setEstimatedAvailable] = useState(0);
  const [mapLat, setMapLat] = useState(0);
  const [mapLng, setMapLng] = useState(0);
  const [locatingMap, setLocatingMap] = useState(false);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  /** When true, ZIP auto-fill is skipped (user has entered a non-empty ZIP). Clear the field to allow auto-fill again. */
  const zipManualLockRef = useRef(false);
  /** Ignore out-of-order geocode responses (older request failed after a newer one succeeded). */
  const geocodeGenRef = useRef(0);
  const mapCoordsRef = useRef({ lat: mapLat, lng: mapLng });
  /** Address snapshot when listing loaded from GHL/API. */
  const loadedListingAddressKeyRef = useRef<string | null>(null);
  /** Address we last successfully geocoded — only skip re-geocode when this matches. */
  const geocodedAddressKeyRef = useRef<string | null>(null);

  useEffect(() => {
    mapCoordsRef.current = { lat: mapLat, lng: mapLng };
  }, [mapLat, mapLng]);

  const selectedCityRow = useMemo(() => geo?.citiesFlat.find((r) => r.k === cityRowKey), [geo, cityRowKey]);
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
  useEffect(() => {
    if (isServiceLineHiddenDuringBeta(serviceLine)) {
      setServiceLine(defaultCheckoutServiceLine());
    }
  }, [serviceLine]);

  useEffect(() => {
    if (!campaignFromUrl) return;
    setLockedCampaignType(campaignFromUrl);
    setCampaignLockSource("url");
    setCampaignType(campaignFromUrl);
  }, [campaignFromUrl]);

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

  /** Demo shell only on bare /buy-leads — never while an MLS/order link is resolving (avoids wrong address/MLS flash). */
  const pendingListing = useMemo((): ListingPayload | null => {
    if (listing || !listingRef) return null;
    const mls = (mlsFromPath || listingRef).trim();
    return {
      id: mls.toLowerCase() || "pending",
      internalId: 0,
      mls: mls || "—",
      address: "",
      cityStateZip: "",
      county: "",
      listPrice: "",
      agentName: "",
      email: "",
      phone: "",
      brokerage: "",
      listingPhotoUrl: null,
      lat: 0,
      lng: 0,
      zip: "",
      campaignType: "just_listed",
      radii: ORDER_LAYOUT_SHELL.radii,
    };
  }, [listing, listingRef, mlsFromPath]);
  const displayListing = listing ?? pendingListing ?? ORDER_LAYOUT_SHELL;
  const listingReady = Boolean(listing);
  const listingResolving = listingLoading || searchBusy;
  const showListingLoading = listingResolving && !listingReady;
  const isEntrySearch = !listingRef;
  /** Entry /buy-leads = search only until a listing loads; MLS pay links always show checkout UI. */
  const showCheckoutFlow = Boolean(listingRef) || listingReady;
  const selectedListingRing = displayListing.radii[listingRadiusId];
  const listingHomesCap = Math.max(1, selectedListingRing.count);

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

  const pickCampaignType = useCallback(
    (next: ListingCampaignType) => {
      if (lockedCampaignType && lockedCampaignType !== next) return;
      setCampaignType(next);
      setListing((l) => (l ? { ...l, campaignType: next } : l));
    },
    [lockedCampaignType]
  );

  const syncCampaignFromListing = useCallback(
    (normalized: ListingPayload, orderRole?: ListingAgentRole | null) => {
      const { lock, source } = resolveLockedCampaignType({
        campaignFromUrl,
        listingType: normalized.listingType,
      });
      setLockedCampaignType(lock);
      setCampaignLockSource(source);
      if (lock) {
        setCampaignType(lock);
        return;
      }
      const role =
        orderRole ??
        orderingAgentRole ??
        agentFromUrl ??
        (listingHasDualAgents(normalized) ? "seller" : null);
      setCampaignType(
        resolveCampaignTypeForListing({
          campaignPath: campaignPathFromUrl,
          agentRole: role,
          fallback: "just_listed",
        })
      );
    },
    [campaignFromUrl, campaignPathFromUrl, agentFromUrl, orderingAgentRole]
  );

  const activateAgentRole = useCallback(
    (role: ListingAgentRole) => {
      setOrderingAgentRole(role);
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
      if (!lockedCampaignType) {
        pickCampaignType(campaignForAgentRole(role));
      }
    },
    [sellerAgentForm, buyerAgentForm, lockedCampaignType, pickCampaignType]
  );

  const syncAgentFormsFromListing = useCallback((l: ListingPayload) => {
    const normalized = normalizeListingAgents(l);
    setSellerAgentForm(agentFormFromInfo(getSellerAgent(normalized)));
    setBuyerAgentForm(agentFormFromInfo(getBuyerAgent(normalized)));
    return normalized;
  }, []);

  const geocodeListingAddress = useCallback(async (form: ListingFormValues) => {
    const query = listingAddressGeocodeQuery(form);
    if (query.length < 10) return;
    const gen = ++geocodeGenRef.current;
    setLocatingMap(true);
    try {
      const geo = await geocodeUSAddress(query, undefined, form);
      if (gen !== geocodeGenRef.current) return;
      if (!hasValidMapCoords(geo.lat, geo.lng)) {
        setMapNotice("Could not find this address on the map. Check street, city, state, and ZIP.");
        return;
      }
      setMapLat(geo.lat);
      setMapLng(geo.lng);
      setMapNotice(
        geo.approximate
          ? "Exact address not found — map centered on the ZIP code area. Refine the street if needed."
          : null
      );
      geocodedAddressKeyRef.current = [form.streetAddress, form.city, form.stateCode, form.zip]
        .map((s) => String(s).trim())
        .join("|");
      const countyRaw = geo.county;
      setListingForm((prev) => {
        setListing((l) =>
          l ? applyListingFormValues(l, prev, { lat: geo.lat, lng: geo.lng, county: countyRaw || l.county }) : l
        );
        return prev;
      });
    } catch {
      if (gen !== geocodeGenRef.current) return;
      const addressKey = [form.streetAddress, form.city, form.stateCode, form.zip]
        .map((s) => String(s).trim())
        .join("|");
      const unchangedSinceLoad = loadedListingAddressKeyRef.current === addressKey;
      const { lat, lng } = mapCoordsRef.current;
      if (!hasValidMapCoords(lat, lng) || !unchangedSinceLoad) {
        setMapNotice("Map location could not be updated. Try refining the address.");
      } else {
        setMapNotice(null);
      }
    } finally {
      if (gen === geocodeGenRef.current) setLocatingMap(false);
    }
  }, []);

  const applyListingFromPayload = useCallback(
    (
      l: ListingPayload,
      radiusId: RadiusId,
      orderRole?: ListingAgentRole
    ) => {
      const normalized = syncAgentFormsFromListing(l);
      const ring = normalized.radii[radiusId];
      const count = Math.max(1, ring.count);
      setListingRadiusId(radiusId);
      setRequestedLeads(count);
      setSelectedTier(tierFromLeadCount(count));
      setEstimatedAvailable(count);
      setRadius(String(radiusMilesFromId(radiusId)));
      setZip(normalized.zip);
      const formValues = listingFormValuesFromPayload(normalized);
      setListingForm(formValues);
      loadedListingAddressKeyRef.current = [
        formValues.streetAddress,
        formValues.city,
        formValues.stateCode,
        formValues.zip,
      ]
        .map((s) => String(s).trim())
        .join("|");
      const addressQuery = listingAddressGeocodeQuery(formValues);
      if (hasValidMapCoords(normalized.lat, normalized.lng)) {
        setMapLat(normalized.lat);
        setMapLng(normalized.lng);
        setMapNotice(null);
        geocodedAddressKeyRef.current = [
          formValues.streetAddress,
          formValues.city,
          formValues.stateCode,
          formValues.zip,
        ]
          .map((s) => String(s).trim())
          .join("|");
      } else if (addressQuery.length >= 10) {
        setMapNotice(null);
        geocodedAddressKeyRef.current = null;
        void geocodeListingAddress(formValues);
      } else {
        setMapLat(0);
        setMapLng(0);
      }
      if (listingHasDualAgents(normalized)) {
        const role =
          orderRole ??
          orderingAgentRole ??
          agentFromUrl ??
          "seller";
        const agent = role === "seller" ? getSellerAgent(normalized) : getBuyerAgent(normalized);
        setEmail(agent.email.trim());
        setPhone(agent.phone.trim());
        setOrderingAgentRole(role);
      } else {
        setEmail(normalized.email.trim());
        setPhone(normalized.phone.trim());
      }
      zipManualLockRef.current = true;
    },
    [agentFromUrl, orderingAgentRole, syncAgentFormsFromListing, geocodeListingAddress]
  );

  const onListingFormChange = useCallback(<K extends keyof ListingFormValues>(field: K, value: ListingFormValues[K]) => {
    if (field === "mls" && mlsFromPath) return;
    setListingForm((prev) => {
      const next = { ...prev, [field]: value };
      const normalized =
        field === "streetAddress" || field === "city" || field === "stateCode" || field === "zip"
          ? normalizeListingFormValues(next)
          : next;
      setListing((l) => (l ? applyListingFormValues(l, normalized) : l));
      if (field === "email") setEmail(String(value).trim());
      if (field === "phone") setPhone(String(value).trim());
      return normalized;
    });
  }, [mlsFromPath]);

  const applyListingRadius = useCallback(
    (l: ListingPayload, radiusId: RadiusId, orderRole?: ListingAgentRole) => {
      applyListingFromPayload(l, radiusId, orderRole);
    },
    [applyListingFromPayload]
  );

  const handleRadiusPick = useCallback(
    (radiusId: RadiusId) => {
      if (listing) {
        applyListingRadius(listing, radiusId);
        return;
      }
      const ring = ORDER_LAYOUT_SHELL.radii[radiusId];
      const count = Math.max(1, ring.count);
      setListingRadiusId(radiusId);
      setRequestedLeads(count);
      setSelectedTier(tierFromLeadCount(count));
      setRadius(String(radiusMilesFromId(radiusId)));
    },
    [applyListingRadius, listing]
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

  const loadListingPayload = useCallback(
    (data: ListingPayload, radiusId: RadiusId = DEFAULT_LISTING_RADIUS_ID, opts?: { fromSearch?: boolean }) => {
      const normalized = normalizeListingAgents(data);
      geocodeGenRef.current += 1;
      geocodedAddressKeyRef.current = null;
      setPendingMlsHits([]);
      setListing(normalized);
      setMapNotice(null);
      syncCampaignFromListing(normalized);
      applyListingRadius(normalized, radiusId);
      setListingLoading(false);
      if (opts?.fromSearch) {
        requestAnimationFrame(() => {
          document.getElementById("buy-listing-loaded")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
    },
    [applyListingRadius, syncCampaignFromListing]
  );

  const loadListingPayloadRef = useRef(loadListingPayload);
  loadListingPayloadRef.current = loadListingPayload;

  const handleBuyLeadsSearch = useCallback(
    (result: BuyLeadsSearchResult) => {
      if (result.kind === "listing") {
        loadListingPayload(result.listing, DEFAULT_LISTING_RADIUS_ID, { fromSearch: true });
        return;
      }
      setMapLat(result.geo.lat);
      setMapLng(result.geo.lng);
      setMapNotice(null);
      geocodedAddressKeyRef.current = [
        result.form.streetAddress,
        result.form.city,
        result.form.stateCode,
        result.form.zip,
      ]
        .map((s) => String(s).trim())
        .join("|");
      const draft = buildDraftListingFromForm(result.form, result.geo, "just_sold");
      loadListingPayload(draft, DEFAULT_LISTING_RADIUS_ID, { fromSearch: true });
    },
    [loadListingPayload]
  );

  const handleAgentPick = useCallback(
    (hit: GhlContactSearchHit) => {
      const phone = hit.phone?.trim();
      if (!phone) {
        notifyError("This contact has no phone on file — add a phone in GoHighLevel.");
        return;
      }
      navigate(searchAgentPath(phone));
    },
    [navigate]
  );

  /** Legacy ?mls= or /mls/:id?agent= → canonical /listed|sold|buyer/mls/:id */
  useEffect(() => {
    const qMls = sp.get("mls")?.trim();
    const role = agentRoleFromParam(sp.get("agent"));
    if (qMls && !mlsFromPath) {
      const qs = new URLSearchParams(sp);
      qs.delete("mls");
      qs.delete("agent");
      const tail = qs.toString();
      navigate(`${buildMlsLeadsUrl(qMls, role ? { agent: role } : undefined)}${tail ? `?${tail}` : ""}`, {
        replace: true,
      });
      return;
    }
    if (mlsFromPath && role && !campaignPathFromUrl && !agentFromPath) {
      const qs = new URLSearchParams(sp);
      qs.delete("agent");
      const tail = qs.toString();
      navigate(`${buildMlsLeadsUrl(mlsFromPath, { agent: role })}${tail ? `?${tail}` : ""}`, { replace: true });
    }
  }, [sp, mlsFromPath, campaignPathFromUrl, agentFromPath, navigate]);

  /** Canonical MLS URL — /listed|sold|buyer/mls/:id; strip ?c= tracking params once loaded. */
  useEffect(() => {
    if (!mlsFromPath || !listing) return;
    const campaignPath =
      campaignPathFromUrl ?? campaignPathFromListingPayload(listing) ?? undefined;
    const qs = new URLSearchParams(sp);
    const hadTracking = qs.has("c") || qs.has("contactId");
    qs.delete("c");
    qs.delete("contactId");
    const needsCampaignPath = !campaignPathFromUrl && Boolean(campaignPath);
    if (!hadTracking && !needsCampaignPath) return;
    const tail = qs.toString();
    const path = campaignPath
      ? buildMlsLeadsUrl(mlsFromPath, { campaignPath })
      : `/mls/${encodeURIComponent(mlsFromPath)}`;
    navigate(`${path}${tail ? `?${tail}` : ""}`, { replace: true });
  }, [mlsFromPath, campaignPathFromUrl, listing, navigate, sp]);

  /** Listing passed via router state (Find listing / pick GHL contact) — avoid re-fetch race. */
  useEffect(() => {
    const preloaded = (location.state as BuyLeadsLocationState | null)?.preloadedListing;
    if (!preloaded?.mls?.trim() || !listingRef) return;
    if (preloaded.mls.trim().toUpperCase() !== listingRef.trim().toUpperCase()) return;
    loadListingPayloadRef.current(preloaded, DEFAULT_LISTING_RADIUS_ID, { fromSearch: true });
    const qs = new URLSearchParams(location.search);
    qs.delete("c");
    qs.delete("contactId");
    const tail = qs.toString();
    navigate(`${location.pathname}${tail ? `?${tail}` : ""}`, { replace: true, state: null });
  }, [location.state, listingRef, navigate, location.pathname, location.search]);

  useEffect(() => {
    if (!listingRef) {
      setListingLoading(false);
      setListing(null);
      setPendingMlsHits([]);
      setListingForm(emptyListingFormValues());
      setLockedCampaignType(campaignFromUrl);
      setCampaignLockSource(campaignFromUrl ? "url" : null);
      if (campaignFromUrl) setCampaignType(campaignFromUrl);
      setMapLat(0);
      setMapLng(0);
      setMapNotice(null);
      geocodedAddressKeyRef.current = null;
      loadedListingAddressKeyRef.current = null;
      return;
    }

    const preloaded = (location.state as BuyLeadsLocationState | null)?.preloadedListing;
    if (
      preloaded?.mls?.trim() &&
      preloaded.mls.trim().toUpperCase() === listingRef.trim().toUpperCase()
    ) {
      return;
    }

    const cacheKey = buildListingCacheKey({
      mls: listingRef,
      contactId: ghlContactIdFromUrl,
      agentRole: agentFromPath,
    });
    const cached = readListingCache(cacheKey);
    if (cached) {
      loadListingPayloadRef.current(cached, DEFAULT_LISTING_RADIUS_ID, { fromSearch: true });
    }

    const ac = new AbortController();
    if (!cached) {
      setListing(null);
      setPendingMlsHits([]);
      setListingForm({
        ...emptyListingFormValues(),
        mls: (mlsFromPath || listingRef).trim(),
      });
      setMapLat(0);
      setMapLng(0);
      setMapNotice(null);
      setListingLoading(true);
    }
    void (async () => {
      try {
        const data = await resolveListingByMls(listingRef, {
          signal: ac.signal,
          contactId: ghlContactIdFromUrl,
          agentRole: agentFromPath,
          autoPickMultiple: isWelcomeMlsLink,
        });
        if (ac.signal.aborted) return;
        loadListingPayloadRef.current(data, DEFAULT_LISTING_RADIUS_ID, { fromSearch: true });
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        if (cached) return;
        if (e instanceof MultipleGhlMlsHitsError && !isWelcomeMlsLink) {
          setPendingMlsHits(e.hits);
          setListingLoading(false);
          setMapNotice(null);
          return;
        }
        try {
          const data = await fetchOrderById(listingRef, ac.signal);
          if (ac.signal.aborted) return;
          loadListingPayloadRef.current(data);
        } catch (e2) {
          if (e2 instanceof Error && e2.name === "AbortError") return;
          if (cached) return;
          const local = resolveLocalListing(listingRef) ?? getLocalDemoOrder(listingRef);
          if (local) {
            loadListingPayloadRef.current(local);
          } else {
            setListing(null);
            setListingLoading(false);
            if (mlsFromPath) {
              setListingForm((prev) => ({ ...prev, mls: mlsFromPath }));
              setMapNotice("Search your MLS in GoHighLevel above, or enter the property address below.");
            }
          }
        }
      }
    })();
    return () => ac.abort();
  }, [listingRef, mlsFromPath, campaignFromUrl, agentFromPath, ghlContactIdFromUrl, isWelcomeMlsLink]);

  useEffect(() => {
    if (!listing || !geo) return;
    syncListingGeo(listing, geo);
  }, [listing, geo, syncListingGeo]);

  const listingAddressKey = useMemo(
    () =>
      [listingForm.streetAddress, listingForm.city, listingForm.stateCode, listingForm.zip]
        .map((s) => String(s).trim())
        .join("|"),
    [listingForm.streetAddress, listingForm.city, listingForm.stateCode, listingForm.zip]
  );

  /** Re-geocode when the user edits the address — not on every load if GHL already gave coordinates. */
  useEffect(() => {
    if (!listing) return;
    const query = listingAddressGeocodeQuery(listingForm);
    if (query.length < 10) return;
    if (
      geocodedAddressKeyRef.current != null &&
      geocodedAddressKeyRef.current === listingAddressKey
    ) {
      setMapNotice(null);
      return;
    }
    const t = window.setTimeout(() => {
      void geocodeListingAddress(listingForm);
    }, 400);
    return () => window.clearTimeout(t);
  }, [listing, listingAddressKey, listingForm, geocodeListingAddress]);

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

  const applyLoadedGeo = useCallback((g: UsGeoData, pickAreaDefaults = true) => {
    setGeo(g);
    if (!pickAreaDefaults) return;
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
    if (listingRef) return;
    let ok = true;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      loadUsGeoData()
        .then((g) => {
          if (!ok) return;
          applyLoadedGeo(g, !mlsFromPath);
        })
        .catch(() => {
          /* Geo bundle is only used for lead-count fallback when no listing is loaded. */
        });
    };
    if (typeof requestIdleCallback !== "undefined") {
      idleId = requestIdleCallback(load, { timeout: 4000 });
    } else {
      timeoutId = setTimeout(load, 300);
    }
    return () => {
      ok = false;
      if (idleId != null && typeof cancelIdleCallback !== "undefined") cancelIdleCallback(idleId);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [applyLoadedGeo, listingRef, mlsFromPath]);

  useEffect(() => {
    if (!canceled || canceledToastShown.current) return;
    canceledToastShown.current = true;
    const sessionId = sessionStorage.getItem("cpai_checkout_session");
    if (sessionId) {
      sessionStorage.removeItem("cpai_checkout_session");
      void reportCheckoutCanceled(sessionId).catch(() => {});
    }
    notifyWarning("Checkout canceled — adjust your selection and try again.");
  }, [canceled]);

  /** Keep city selection valid when county list changes. */
  useEffect(() => {
    if (!geo || !countyKey || cityRowsInCounty.length === 0) return;
    if (cityRowsInCounty.some((r) => r.k === cityRowKey)) return;
    setCityRowKey(cityRowsInCounty[0]!.k);
  }, [geo, countyKey, cityRowsInCounty, cityRowKey]);

  useEffect(() => {
    if (listing || mlsFromPath) return;
    const t = window.setTimeout(() => {
      void geocodeTargetArea();
    }, 500);
    return () => window.clearTimeout(t);
  }, [city, county, zip, stateName, listing, mlsFromPath]);

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
    ? (selectedListingRing
        ? radiusRingLabel(listingRadiusId, selectedListingRing.label)
        : `${mapPreviewRadiusMiles} mi`)
    : `${radius} mi`;
  const mapPreviewLat = hasValidMapCoords(mapLat, mapLng)
    ? mapLat
    : listing && hasValidMapCoords(displayListing.lat, displayListing.lng)
      ? displayListing.lat
      : !listingRef && hasValidMapCoords(displayListing.lat, displayListing.lng)
        ? displayListing.lat
        : mapLat;
  const mapPreviewLng = hasValidMapCoords(mapLat, mapLng)
    ? mapLng
    : listing && hasValidMapCoords(displayListing.lat, displayListing.lng)
      ? displayListing.lng
      : !listingRef && hasValidMapCoords(displayListing.lat, displayListing.lng)
        ? displayListing.lng
        : mapLng;
  const mapHasCoords = showListingLoading ? false : hasValidMapCoords(mapPreviewLat, mapPreviewLng);
  const mapPreviewLocating = showListingLoading || locatingMap;

  const searchPrefillAddress = useMemo(() => {
    if (!listing) return "";
    return formatListingDisplayAddress(listingForm);
  }, [listing, listingForm]);

  const scrollToCheckout = useCallback(() => {
    document.getElementById("buy-checkout-step")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const campaignDisplayLabel = campaignType === "just_listed" ? "Just listed" : "Just sold";

  async function refreshLeadCount(opts?: { quiet?: boolean; radiusOverride?: string }) {
    const radiusForRequest = opts?.radiusOverride ?? radius;
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
    if (!listingReady) {
      notifyError("Find your listing above before checkout.");
      return;
    }
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
      const { url, sessionId } = await startLeadCheckout(
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
          mls: resolveRealMls(mlsFromPath, listingForm.mls, listing?.mls),
          listingAddress: formatListingDisplayAddress(listingForm) || listing?.address?.trim() || undefined,
          agentName: listingForm.agentName.trim() || undefined,
          brokerage: listingForm.brokerage.trim() || undefined,
          radiusLabel: radiusRingLabel(listingRadiusId, selectedListingRing.label),
        }
      );
      if (sessionId) sessionStorage.setItem("cpai_checkout_session", sessionId);
      trackFirstPromoterReferral(email.trim());
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
        path={
          mlsFromPath
            ? agentFromPath
              ? `/${agentFromPath}/mls/${encodeURIComponent(mlsFromPath)}`
              : `/mls/${encodeURIComponent(mlsFromPath)}`
            : "/buy-leads"
        }
      />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main
          id="main-content"
          tabIndex={-1}
          className={`page-space page-space--tight rzInterior buy-page${listing ? " buy-page--has-listing" : ""}`}
        >
          <div className="container buy-wrap">
            {showCheckoutFlow ? (
            <div className="buy-stepper">
              {(
                [
                  ["Campaign type", "Property & area"],
                  ["Choose your audience", "How many homeowners"],
                  ["Homes & service", "Choose your plan"],
                  ["Checkout", "Review & pay"],
                ] as const
              ).map(([title, sub], idx) => (
                <div key={title} className={`buy-step ${idx <= 2 ? "is-active" : ""}`}>
                  <span className="buy-step-n">{idx + 1}</span>
                  <span className="buy-step-t">
                    <strong>{title}</strong>
                    <span className="buy-step-sub">{sub}</span>
                  </span>
                </div>
              ))}
            </div>
            ) : null}

            <header className="page-hero buy-page-hero">
              <p className="page-breadcrumb">
                <Link to="/">Home</Link> / Start prospecting
              </p>
              <h1 className="page-h1 page-h1--gradient">
                {isEntrySearch && !listingReady
                  ? "Let's find your latest listing or sale"
                  : "Prospect homeowners around your listing"}
              </h1>
              <p className="page-lead">
                {listing ? (
                  <>
                    Your <strong>{campaignType === "just_listed" ? "just listed" : "just sold"}</strong> campaign is pre-filled from this
                    property—pick a target ring, choose your service, then checkout securely.
                  </>
                ) : isEntrySearch ? (
                  <>
                    Start with your <strong>agent email or phone</strong> — or switch to <strong>MLS #</strong> / property address. After you
                    pick an agent, we&apos;ll show their latest listing, sold, and buyer-side closes.
                  </>
                ) : (
                  <>
                    Search your <strong>MLS #</strong> or property address above, then pick a target ring and service plan. Checkout uses the agent
                    contact on file.
                  </>
                )}
              </p>
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

            <BuyLeadsSearch
              disabled={listingResolving || busy}
              initialMls={mlsFromPath || sp.get("mls") || ""}
              prefillAddress={searchPrefillAddress}
              searchAgentRole={agentFromUrl}
              contactIdFromUrl={ghlContactIdFromUrl}
              pendingListingHits={isWelcomeMlsLink ? [] : pendingMlsHits}
              pendingListingHitsMessage={
                !isWelcomeMlsLink && pendingMlsHits.length
                  ? `${pendingMlsHits.length} matches for MLS ${mlsFromPath || listingRef} — select one below.`
                  : undefined
              }
              onAgentPick={isEntrySearch ? handleAgentPick : undefined}
              agentHint={
                isEntrySearch
                  ? "Search by email or phone — pick a match to see latest listing, sold, and buyer-side closes."
                  : undefined
              }
              onResult={handleBuyLeadsSearch}
              onBusyChange={setSearchBusy}
            />

            {showCheckoutFlow ? (
              <>
            {showListingLoading ? (
              <p className="cp-loading-line" role="status" style={{ margin: "0.35rem 0 0" }}>
                Loading listing…
              </p>
            ) : null}

            <section
              id="buy-listing-loaded"
              className={`buy-mockup-hero${showListingLoading ? " buy-mockup-hero--loading" : ""}`}
              aria-busy={showListingLoading}
            >
              {showListingLoading ? (
                <div className="buy-mockup-hero__loading-overlay" role="presentation">
                  <span className="buy-mockup-hero__loading-badge cp-loading-line">Loading listing…</span>
                </div>
              ) : null}
                  <BuyListingPropertyCard
                    listing={displayListing}
                    form={listingForm}
                    campaignType={campaignType}
                    radiusId={listingRadiusId}
                    radiusLabel={selectedListingRing.label}
                    radiusCount={selectedListingRing.count}
                    photoPending={showListingLoading}
                  />
                  <BuyMapPreviewCard
                    listing={displayListing}
                    form={listingForm}
                    campaignType={campaignType}
                    radiusId={listingRadiusId}
                    selectedRing={selectedListingRing}
                    mapHasCoords={mapHasCoords}
                    mapLat={mapPreviewLat}
                    mapLng={mapPreviewLng}
                    mapPreviewRadius={mapPreviewRadius}
                    mapPreviewRadiusMiles={mapPreviewRadiusMiles}
                    mapPreviewRadiusLabel={mapPreviewRadiusLabel}
                    locatingMap={mapPreviewLocating}
                    mapNotice={mapNotice}
                  />
                  <div className="buy-mockup-hero__summary">
                    <BuyOrderSummarySidebar
                      listing={displayListing}
                      form={listingForm}
                      campaignLabel={campaignDisplayLabel}
                      campaignType={campaignType}
                      radiusId={listingRadiusId}
                      radiusLabel={selectedListingRing.label}
                      homes={requestedLeads}
                      serviceLine={serviceLine}
                      tierId={selectedTier}
                      packageLabel={selectedTierMeta.packageLabel}
                      promoCode={appliedPromoCode}
                      totalCents={checkoutTotalCents}
                      onContinue={scrollToCheckout}
                      continueDisabled={!listingReady || !tierBandOk || checkoutTotalCents < 50}
                      busy={busy}
                      photoPending={showListingLoading}
                    />
                  </div>
                </section>

                <BuyRadiusIconPicker
                  listing={displayListing}
                  selectedId={listingRadiusId}
                  disabled={listingResolving || busy}
                  onSelect={handleRadiusPick}
                />

                {listing && dualAgents ? (
                  <section className="section-surface buy-card" style={{ marginTop: "1rem" }}>
                    <h2 className="premium-h2" style={{ marginBottom: "0.5rem" }}>
                      Who is placing this order?
                    </h2>
                    <p className="muted" style={{ marginBottom: "0.85rem", fontSize: "0.92rem" }}>
                      Seller orders use <strong>Just sold</strong>; buyer orders use <strong>Just listed</strong>.
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
                        disabled={listingResolving}
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
                        disabled={listingResolving}
                      />
                    </div>
                  </section>
                ) : null}

            {!listingReady && listingRef && !listingLoading ? (
              <p className="cp-alert cp-alert--warn" role="status" style={{ marginTop: "0.75rem" }}>
                No GHL contact found for MLS <code className="cp-kbd">{listingRef}</code> — search again or confirm the MLS is on the
                contact in GoHighLevel.
              </p>
            ) : null}

            <section
              id="buy-service-step"
              className="section-surface buy-card"
              style={{ marginTop: "1rem" }}
            >
              {/* Deferred — re-enable when home-count step returns */}
              <div className="buy-home-count-step" hidden>
                <h3 className="buy-step2-subhead">1 · How many homes should we call?</h3>
                {selectedListingRing ? (
                  <>
                    <div className="buy-listing-count-banner" role="status">
                      <span className="buy-listing-count-banner__n">{requestedLeads.toLocaleString()}</span>
                      <span className="buy-listing-count-banner__l">
                        homeowners in order · {radiusRingLabel(listingRadiusId, selectedListingRing.label)} (up to{" "}
                        {listingHomesCap.toLocaleString()}) · plan <strong>{selectedTierMeta.packageLabel}</strong>
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
                      <strong>{formatMoneyUsd(checkoutPricePerLeadUsd(serviceLine, selectedTier, appliedPromoCode))}</strong> per home with{" "}
                      <strong>{serviceLineLabel(serviceLine)}</strong> →{" "}
                      <strong className="gradient-text">{formatMoneyUsd(checkoutTotalCents / 100)}</strong> estimated total
                    </p>
                  </>
                ) : null}
              </div>

              <div className="buy-step2-block">
                <BuyServicePlanCards
                  serviceLine={serviceLine}
                  selectedTier={selectedTier}
                  requestedLeads={requestedLeads}
                  promoCode={appliedPromoCode}
                  onPick={pickServiceAndTier}
                />
              </div>

              {checkoutTotalCents < 50 && (
                <p className="cp-alert cp-alert--warn" style={{ marginTop: "0.85rem" }} role="status">
                  Card checkout requires at least <strong>{formatMoneyUsd(0.5)}</strong>. Increase homes to{" "}
                  <strong>{stripeMinLeads.toLocaleString()}</strong> or more at this rate.
                </p>
              )}
            </section>

            <BuyCheckoutReview
              listing={displayListing}
              form={listingForm}
              campaignLabel={campaignDisplayLabel}
              radiusId={listingRadiusId}
              radiusLabel={selectedListingRing.label}
              homes={requestedLeads}
              serviceLine={serviceLine}
              tierId={selectedTier}
              packageLabel={selectedTierMeta.packageLabel}
              promoCode={appliedPromoCode}
              totalCents={checkoutTotalCents}
              email={email}
              phone={phone}
              onFormChange={onListingFormChange}
              onEmailChange={setEmail}
              onPhoneChange={setPhone}
              promoInput={promoInput}
              onPromoInputChange={setPromoInput}
              onPromoApply={handlePromoApply}
              appliedPromoCode={appliedPromoCode}
              lockedCampaignNote={
                lockedCampaignType
                  ? `Campaign locked to ${campaignDisplayLabel}${
                      campaignLockSource === "ghl" ? " from GoHighLevel Listing Type" : " from this link"
                    }.`
                  : null
              }
              busy={busy}
              listingReady={listingReady}
              tierBandOk={tierBandOk}
              onCheckout={onBuy}
              disabled={listingResolving}
            />

            <BuyOrderTrustStrip />
              </>
            ) : null}

            <style>{`
              .buy-campaign-toggle {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 0.5rem;
                margin-bottom: 0.15rem;
              }
              @media (max-width: 560px) {
                .buy-campaign-toggle { grid-template-columns: 1fr; }
              }
              .buy-campaign-btn {
                text-align: left;
                padding: 0.6rem 0.85rem;
                border-radius: 12px;
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
              .buy-campaign-btn:disabled {
                opacity: 0.42;
                cursor: not-allowed;
                background: #f8fafc;
              }
              .buy-campaign-btn:disabled.is-selected {
                opacity: 1;
                cursor: default;
              }
              .buy-campaign-lock-hint {
                margin: 0.35rem 0 0.5rem;
                font-size: 0.82rem;
                line-height: 1.4;
                max-width: 42rem;
              }
              .buy-campaign-btn:focus-visible {
                outline: 2px solid rgba(0, 122, 255, 0.45);
                outline-offset: 2px;
              }
              .buy-campaign-btn-title {
                display: block;
                font-weight: 800;
                font-size: 0.95rem;
                color: #0f172a;
              }
              .buy-campaign-btn-sub {
                display: block;
                font-size: 0.76rem;
                color: #64748b;
                margin-top: 0.15rem;
                line-height: 1.3;
              }
              .buy-subsection-h {
                margin: 0.65rem 0 0;
                font-size: 0.95rem;
                font-weight: 800;
                color: #0f172a;
                letter-spacing: -0.02em;
              }
              .buy-wrap { max-width: 1180px; }
              .buy-grid {
                display: grid;
                grid-template-columns: 1.2fr 0.8fr;
                gap: 1rem;
                margin-top: 0.15rem;
                align-items: start;
              }
              .buy-card {
                border-radius: 18px;
                box-shadow: 0 16px 38px rgba(5, 12, 26, 0.07);
              }
              .buy-card:not(.buy-search) input,
              .buy-card:not(.buy-search) select,
              .buy-card:not(.buy-search) textarea {
                background: #fff !important;
                color: #0f172a !important;
                border: 1px solid rgba(15, 23, 42, 0.2) !important;
              }
              .buy-card:not(.buy-search) input::placeholder,
              .buy-card:not(.buy-search) textarea::placeholder {
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
                align-self: start;
              }
              .buy-map-preview .gradient-border {
                width: 100%;
                border-radius: 14px;
              }
              .buy-card--summary {
                background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
              }
              .buy-hero-pills {
                margin-top: 0.4rem;
                display: flex;
                flex-wrap: wrap;
                gap: 0.4rem;
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
                margin-bottom: 0.6rem;
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
                grid-template-columns: repeat(var(--buy-pricing-cols, 2), minmax(11.5rem, 1fr));
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
              .buy-price-table col.buy-price-col-select {
                width: 2.35rem;
              }
              .buy-price-table col.buy-price-col-package {
                width: 36%;
              }
              .buy-price-table col.buy-price-col-homes {
                width: 24%;
              }
              .buy-price-table col.buy-price-col-rate {
                width: auto;
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
              }
              .buy-price-col-package,
              .buy-price-col-homes,
              .buy-price-table td:nth-child(4) {
                white-space: nowrap;
                word-break: keep-all;
                overflow-wrap: normal;
              }
              .buy-price-table td:nth-child(4) {
                text-align: right;
                font-variant-numeric: tabular-nums;
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
                margin-bottom: 0.5rem;
                padding: 0.5rem 0.75rem;
                border-radius: 12px;
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
                font-size: 1.05rem;
                font-weight: 800;
                letter-spacing: 0.02em;
                color: #0284c7;
              }
              .buy-listing-addr {
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: 0.88rem;
                font-weight: 700;
                color: #0369a1;
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
                  grid-template-columns: 1fr !important;
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
