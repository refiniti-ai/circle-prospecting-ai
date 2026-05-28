import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fetchCampaignPricing, normalizeApiTiers } from "../lib/pricingApi";
import { DEFAULT_CAMPAIGN_TIERS, type CampaignTier } from "../lib/pricing";
import { notifyWarning } from "../lib/notify";

type Ctx = {
  tiers: CampaignTier[];
  loading: boolean;
  error: string | null;
};

const PricingTiersContext = createContext<Ctx>({
  tiers: DEFAULT_CAMPAIGN_TIERS,
  loading: true,
  error: null,
});

export function PricingTiersProvider({ children }: { children: ReactNode }) {
  const [tiers, setTiers] = useState<CampaignTier[]>(DEFAULT_CAMPAIGN_TIERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pricingToastShown = useRef(false);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetchCampaignPricing(ac.signal)
      .then((d) => {
        setTiers(normalizeApiTiers(d.tiers));
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setTiers(DEFAULT_CAMPAIGN_TIERS);
        setError(e instanceof Error ? e.message : "Could not load pricing");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!error || pricingToastShown.current) return;
    pricingToastShown.current = true;
    notifyWarning("Could not load live pricing — showing default rates.");
  }, [error]);

  const value = useMemo(() => ({ tiers, loading, error }), [tiers, loading, error]);
  return <PricingTiersContext.Provider value={value}>{children}</PricingTiersContext.Provider>;
}

export function usePricingTiers(): Ctx {
  return useContext(PricingTiersContext);
}
