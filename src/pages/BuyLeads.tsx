import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { contactEmail } from "../lib/siteConfig";
import {
  fetchLeadCount,
  startLeadCheckout,
} from "../lib/leadsApi";
import {
  LEAD_SERVICE_LINES,
  LEAD_TIERS,
  LEAD_PRICE_MATRIX,
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

const CITY_SEARCH_MIN = 2;
const CITY_SEARCH_MAX = 80;

function firstUsPostcode(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const part = raw.split(";")[0]?.trim();
  return part || null;
}

export function BuyLeads() {
  const [sp] = useSearchParams();
  const canceled = sp.get("canceled");
  const [email, setEmail] = useState("");
  const [serviceLine, setServiceLine] = useState<LeadServiceLine>("ai_outreach");
  /** Explicit plan row (Dabble … Scale); click a row in any pricing table to set service + plan. */
  const [selectedTier, setSelectedTier] = useState<LeadTierId>(() => tierFromLeadCount(500));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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
  const [includeContact, setIncludeContact] = useState<"phones" | "phones_email">("phones_email");
  const [occupancy, setOccupancy] = useState<"absentee" | "owner">("absentee");
  const [propertyTypes, setPropertyTypes] = useState<string[]>(["single_family"]);
  const [flags, setFlags] = useState<string[]>(["vacant", "high_equity"]);
  const [requestedLeads, setRequestedLeads] = useState(500);
  const [estimatedAvailable, setEstimatedAvailable] = useState(0);
  const [inventoryBaseAvailable, setInventoryBaseAvailable] = useState(0);
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
    () => totalCentsForSelection(serviceLine, selectedTier, requestedLeads),
    [serviceLine, selectedTier, requestedLeads]
  );
  const stripeMinLeads = useMemo(
    () => minLeadsForStripeForTier(serviceLine, selectedTier),
    [serviceLine, selectedTier]
  );

  const selectedTierMeta = tierRowMeta(selectedTier);
  const selectedTierBandLabel =
    selectedTierMeta.maxLeads == null
      ? `${selectedTierMeta.minLeads.toLocaleString()}+`
      : `${selectedTierMeta.minLeads.toLocaleString()}–${selectedTierMeta.maxLeads.toLocaleString()}`;

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
    const t = window.setTimeout(() => {
      void geocodeTargetArea();
    }, 500);
    return () => window.clearTimeout(t);
  }, [city, county, zip, stateName]);

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
    const t = window.setTimeout(() => {
      void refreshLeadCount({ quiet: true });
    }, 450);
    return () => window.clearTimeout(t);
  }, [city, county, zip, stateName, radius, includeContact, occupancy, propertyTypes, flags]);

  const mapFrameSrc = useMemo(() => {
    const miles = Number.parseFloat(radius);
    const safeMiles = Number.isFinite(miles) ? Math.max(0.25, miles) : 1;
    const latPad = safeMiles / 69;
    const lngPad = safeMiles / Math.max(15, 69 * Math.cos((mapLat * Math.PI) / 180));
    const minLng = mapLng - lngPad;
    const minLat = mapLat - latPad;
    const maxLng = mapLng + lngPad;
    const maxLat = mapLat + latPad;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${mapLat}%2C${mapLng}`;
  }, [mapLat, mapLng, radius]);

  function toggleItem(value: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function refreshLeadCount(opts?: { quiet?: boolean }) {
    if (!opts?.quiet) setErr(null);
    setCountLoading(true);
    try {
      const result = await fetchLeadCount({
        city,
        county,
        zip,
        radiusMiles: Number.parseFloat(radius),
        includeContact,
        occupancy,
        propertyTypes,
        flags,
      });
      setEstimatedAvailable(result.available);
      setInventoryBaseAvailable(result.baseAvailableInInventory);
      setRequestedLeads((n) => Math.min(Math.max(1, n), Math.max(result.available, 1)));
    } catch {
      if (!opts?.quiet) setErr("Could not refresh lead count.");
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
      setErr("Enter a valid email.");
      return;
    }
    if (!tierBandOk) {
      setErr(
        `Adjust number of leads to match ${selectedTierMeta.packageLabel} (${selectedTierBandLabel} homes), or pick a different plan row.`
      );
      return;
    }
    if (checkoutTotalCents < 50) {
      setErr(`Order total is below the card minimum ($0.50). Increase leads to at least ${stripeMinLeads.toLocaleString()}.`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { url } = await startLeadCheckout(
        serviceLine,
        selectedTier,
        email.trim(),
        {
          city: city.trim(),
          county: county.trim(),
          zip: zip.trim(),
          radiusMiles: Number.parseFloat(radius),
          requestedLeads,
        }
      );
      window.location.assign(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Checkout error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SeoHead
        title="Buy verified real estate leads | Circle Prospecting AI"
        description="Purchase pre-vetted lead packs. Pay securely with Stripe (test mode supported). Access delivery in your dashboard."
        path="/buy-leads"
      />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space page-space--tight rzInterior">
          <div className="container buy-wrap" style={{ maxWidth: 1180 }}>
            <div className="buy-stepper">
              {["Select Targeting", "Service & rates", "Review & Price", "Checkout"].map((step, idx) => (
                <div key={step} className={`buy-step ${idx <= 2 ? "is-active" : ""}`}>
                  <span className="buy-step-n">{idx + 1}</span>
                  <span className="buy-step-t">{step}</span>
                </div>
              ))}
            </div>

            <header className="page-hero" style={{ marginBottom: "1rem" }}>
              <p className="page-breadcrumb">
                <Link to="/">Home</Link> / Buy leads
              </p>
              <h1 className="page-h1 page-h1--gradient">Launch your lead pack campaign</h1>
              <p className="page-lead" style={{ maxWidth: 700 }}>
                Build your target audience with map radius + filters, refresh available count, and launch secure checkout.
                Purchased leads are delivered in your{" "}
                <Link to="/dashboard" style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                  dashboard
                </Link>{" "}
                with one-click export.
              </p>
              <div className="buy-hero-pills" aria-label="Lead purchase highlights">
                <span className="buy-hero-pill">Live availability preview</span>
                <span className="buy-hero-pill">Server-side pricing</span>
                <span className="buy-hero-pill">Stripe checkout</span>
              </div>
            </header>
            {canceled && <p className="cp-alert cp-alert--warn">Checkout canceled — adjust your pack and try again.</p>}
            <section className="buy-grid">
              <div className="section-surface buy-card buy-card--filters">
                <h2 className="premium-h2">Step 1: Select your target area</h2>
                <p className="muted" style={{ marginBottom: "0.8rem" }}>
                  Choose how far from your market center you want to target homeowners.
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
                  <span className="muted-label">Radius (mi)</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginTop: "0.45rem" }} className="buy-radius-row">
                    {["0.25", "0.5", "1.0", "2.0", "3.0", "5.0"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={radius === r ? "btn btn-primary buy-radius-btn is-active" : "btn btn-ghost buy-radius-btn"}
                        onClick={() => setRadius(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "1rem" }} className="buy-filters-2">
                  <div className="cp-form-grid">
                    <span className="muted-label">Contact info</span>
                    <div style={{ display: "grid", gap: "0.3rem", marginTop: "0.4rem" }}>
                      <label><input type="radio" checked={includeContact === "phones"} onChange={() => setIncludeContact("phones")} /> Phones only</label>
                      <label><input type="radio" checked={includeContact === "phones_email"} onChange={() => setIncludeContact("phones_email")} /> Phones + Email</label>
                    </div>
                  </div>
                  <div className="cp-form-grid">
                    <span className="muted-label">Occupancy</span>
                    <div style={{ display: "grid", gap: "0.3rem", marginTop: "0.4rem" }}>
                      <label><input type="radio" checked={occupancy === "absentee"} onChange={() => setOccupancy("absentee")} /> Absentee owner</label>
                      <label><input type="radio" checked={occupancy === "owner"} onChange={() => setOccupancy("owner")} /> Owner occupied</label>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "1rem" }} className="buy-filters-2">
                  <div>
                    <span className="muted-label">Property types</span>
                    <div style={{ display: "grid", gap: "0.3rem", marginTop: "0.4rem" }}>
                      {[
                        { id: "single_family", label: "Single family" },
                        { id: "condo", label: "Condo" },
                        { id: "plex_2_4", label: "2-4 Plex" },
                      ].map((p) => (
                        <label key={p.id}>
                          <input type="checkbox" checked={propertyTypes.includes(p.id)} onChange={() => toggleItem(p.id, propertyTypes, setPropertyTypes)} /> {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="muted-label">Motivator flags</span>
                    <div style={{ display: "grid", gap: "0.3rem", marginTop: "0.4rem" }}>
                      {[
                        { id: "vacant", label: "Vacant" },
                        { id: "high_equity", label: "High equity" },
                        { id: "empty_nesters", label: "Empty nesters" },
                        { id: "likely_distressed", label: "Likely distressed (+$0.20)" },
                      ].map((f) => (
                        <label key={f.id}>
                          <input type="checkbox" checked={flags.includes(f.id)} onChange={() => toggleItem(f.id, flags, setFlags)} /> {f.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-primary buy-refresh-btn" onClick={() => void refreshLeadCount()} disabled={countLoading || !geo}>
                    {countLoading ? "Refreshing..." : "Refresh leads count"}
                  </button>
                  <span style={{ color: "var(--muted)", alignSelf: "center" }}>
                    {estimatedAvailable > 0
                      ? `${estimatedAvailable.toLocaleString()} leads available (${inventoryBaseAvailable.toLocaleString()} currently in inventory base)`
                      : "Click refresh to estimate count"}
                  </span>
                </div>
              </div>

              <div className="section-surface buy-card buy-card--map">
                <h2 className="premium-h2">Map preview</h2>
                <div className="cp-map-frame" style={{ lineHeight: 0 }}>
                  <iframe
                    title="Leads map preview"
                    src={mapFrameSrc}
                    style={{ width: "100%", height: 290, border: "none", display: "block" }}
                    loading="lazy"
                  />
                </div>
                <p className="muted" style={{ marginTop: "0.6rem", fontSize: "0.9rem" }}>
                  Target area: {city}, {county} ({zip}) · radius {radius} mi {locatingMap ? "· locating..." : ""}
                </p>
                {mapNotice ? <p className="muted" style={{ marginTop: "0.35rem", fontSize: "0.82rem" }}>{mapNotice}</p> : null}
                <div className="buy-map-stats">
                  <div>
                    <span>Available now</span>
                    <strong>{estimatedAvailable.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Inventory base</span>
                    <strong>{inventoryBaseAvailable.toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="section-surface buy-card" style={{ marginTop: "1rem" }}>
              <h2 className="premium-h2" style={{ marginBottom: "0.75rem" }}>Step 2: Choose your lead package</h2>

              <label className="cp-form-grid" style={{ maxWidth: 280 }}>
                <span className="muted-label">Number of leads (homes)</span>
                <input
                  type="number"
                  className="premium-input"
                  min={1}
                  max={Math.max(estimatedAvailable || 100_000, requestedLeads)}
                  value={requestedLeads}
                  onChange={(e) => setRequestedLeads(Math.max(1, Number.parseInt(e.target.value || "1", 10)))}
                />
              </label>
              <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.88rem" }}>
                Selected: <strong>{serviceLineLabel(serviceLine)}</strong> · <strong>{selectedTierMeta.packageLabel}</strong> (
                {selectedTierMeta.homesLabel} homes) · <strong>{formatMoneyUsd(pricePerLeadUsd(serviceLine, selectedTier))}</strong> / homeowner →{" "}
                <strong>{formatMoneyUsd(checkoutTotalCents / 100)}</strong> estimated
              </p>
              {!tierBandOk && (
                <p className="cp-alert cp-alert--warn" style={{ marginTop: "0.65rem" }} role="status">
                  For <strong>{selectedTierMeta.packageLabel}</strong>, use <strong>{selectedTierBandLabel}</strong> homes (you have{" "}
                  {requestedLeads.toLocaleString()}). Change the lead count or click another plan row.
                </p>
              )}
              {checkoutTotalCents < 50 && tierBandOk && (
                <p className="cp-alert cp-alert--warn" style={{ marginTop: "0.65rem" }} role="status">
                  Card checkout requires at least <strong>{formatMoneyUsd(0.5)}</strong>. Increase leads to{" "}
                  <strong>{stripeMinLeads.toLocaleString()}</strong> or more at this plan rate.
                </p>
              )}

              <div className="buy-pricing-stack" style={{ marginTop: "1.15rem" }}>
                {LEAD_SERVICE_LINES.map((line) => {
                  const serviceSelected = serviceLine === line.id;
                  return (
                    <div key={line.id} className={`buy-pricing-block ${serviceSelected ? "is-selected" : ""}`}>
                      <table className="buy-price-table">
                        <thead>
                          <tr>
                            <th className="buy-price-banner buy-price-banner--hit" colSpan={3} style={{ background: line.headerBg, color: line.headerText }}>
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
                            <th scope="col">Package</th>
                            <th scope="col">Homes</th>
                            <th scope="col">Price / Homeowner</th>
                          </tr>
                        </thead>
                        <tbody>
                          {LEAD_TIERS.map((tier, idx) => {
                            const planPick = serviceLine === line.id && selectedTier === tier.id;
                            const rowBg = idx % 2 === 1 ? "rgba(15,23,42,0.04)" : "#fff";
                            const price = LEAD_PRICE_MATRIX[line.id][idx];
                            return (
                              <tr
                                key={tier.id}
                                role="button"
                                tabIndex={0}
                                className={`buy-price-row ${planPick ? "is-plan-selected" : ""}`}
                                onClick={() => {
                                  setServiceLine(line.id);
                                  setSelectedTier(tier.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setServiceLine(line.id);
                                    setSelectedTier(tier.id);
                                  }
                                }}
                                style={{
                                  background: planPick ? line.rowAlt : rowBg,
                                  outline: planPick ? `2px solid ${line.headerBg}` : undefined,
                                  outlineOffset: planPick ? -2 : undefined,
                                }}
                              >
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
            </section>

            {err && <p className="cp-alert cp-alert--error" style={{ marginTop: "1rem" }}>{err}</p>}

            <section className="section-surface buy-card buy-card--summary" style={{ marginTop: "1rem" }}>
              <h2 className="premium-h2" style={{ marginBottom: "0.8rem" }}>Order summary</h2>
              <div className="buy-summary-grid">
                <div><span>Target area</span><strong>{city}, {county} {zip}</strong></div>
                <div><span>Radius</span><strong>{radius} mi</strong></div>
                <div><span>Estimated available</span><strong>{estimatedAvailable.toLocaleString()}</strong></div>
                <div><span>Inventory base</span><strong>{inventoryBaseAvailable.toLocaleString()}</strong></div>
                <div>
                  <span>Service</span>
                  <strong>{serviceLineLabel(serviceLine)}</strong>
                </div>
                <div>
                  <span>Plan</span>
                  <strong>
                    {selectedTierMeta.packageLabel} ({selectedTierMeta.homesLabel})
                  </strong>
                </div>
                <div>
                  <span>Leads</span>
                  <strong>{requestedLeads.toLocaleString()}</strong>
                </div>
                <div>
                  <span>Est. total</span>
                  <strong className="gradient-text">{formatMoneyUsd(checkoutTotalCents / 100)}</strong>
                </div>
              </div>
              <div style={{ marginTop: "1rem", display: "grid", gap: "0.85rem" }}>
                <label className="cp-form-grid" style={{ maxWidth: 440 }}>
                  <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Email (delivery + receipt)</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="premium-input"
                    placeholder="agent@example.com"
                  />
                </label>
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
                <a href="/csv/lead-template.csv" download className="btn btn-ghost" style={{ width: "fit-content" }}>
                  Download CSV format (for admins)
                </a>
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "1.1rem" }}>
                Need help? {contactEmail()}
              </p>
            </section>

            <style>{`
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
              .buy-refresh-btn {
                border-radius: 999px !important;
                font-weight: 700 !important;
              }
              .buy-pack-grid {
                display: grid;
                grid-template-columns: repeat(4,minmax(0,1fr));
                gap: 0.8rem;
              }
              .buy-pricing-stack {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 1rem;
                align-items: start;
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
                padding: 0.65rem 0.9rem;
                font-weight: 800;
                font-size: 1.02rem;
                letter-spacing: 0.02em;
              }
              .buy-price-title-btn:focus-visible {
                outline: 2px solid rgba(255,255,255,0.85);
                outline-offset: 2px;
              }
              .buy-price-row {
                cursor: pointer;
              }
              .buy-price-row:focus-visible {
                outline: 2px solid rgba(0, 122, 255, 0.65);
                outline-offset: -4px;
              }
              .buy-price-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.88rem;
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
                font-size: 0.72rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                padding: 0.42rem 0.65rem;
                border-bottom: 1px solid rgba(15, 23, 42, 0.1);
                text-align: left;
              }
              .buy-price-table td {
                padding: 0.52rem 0.65rem;
                border-bottom: 1px solid rgba(15, 23, 42, 0.06);
                color: #0f172a;
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
                grid-template-columns: repeat(2, minmax(0, 1fr));
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
              @media (max-width: 960px) {
                .buy-grid { grid-template-columns: 1fr !important; }
                .buy-pack-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
                .buy-pricing-stack { grid-template-columns: 1fr; }
                .buy-summary-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
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
