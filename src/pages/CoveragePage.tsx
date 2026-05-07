import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { StatBarSection, MapFarmSection, BeforeAfterSection } from "../components/marketing/MarketingSections";

export function CoveragePage() {
  return (
    <MarketingPageShell
      title="Coverage | Circle Prospecting AI"
      description="Subdivision through ZIP-level radius counts, map preview, and farm targeting for circle prospecting."
      path="/coverage"
      heroTitle="Coverage"
      heroLead="Live map preview and radius ladder—the same ring options agents see when launching a just-listed or just-sold neighborhood campaign."
    >
      <StatBarSection />
      <MapFarmSection />
      <BeforeAfterSection />
    </MarketingPageShell>
  );
}
