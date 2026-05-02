import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { StatBarSection, MapFarmSection, BeforeAfterSection } from "../components/marketing/MarketingSections";

export function CoveragePage() {
  return (
    <MarketingPageShell
      title="Coverage | Circle Prospecting AI"
      description="Subdivision through ZIP-level radius counts, map preview, and farm targeting for circle prospecting."
      path="/coverage"
      heroTitle="Coverage"
      heroLead="Illustrative reach metrics and a live map preview — the same radius ladder your agents see on the order screen."
    >
      <StatBarSection />
      <MapFarmSection />
      <BeforeAfterSection />
    </MarketingPageShell>
  );
}
