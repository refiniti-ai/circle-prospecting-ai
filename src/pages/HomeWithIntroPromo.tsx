import { Home } from "./Home";
import { IntroCampaignPromoBand } from "../components/intro/IntroCampaignPromoBand";

/** Homepage with first-time customer promo — keeps Home.tsx unchanged. */
export function HomeWithIntroPromo() {
  return (
    <>
      <Home />
      <IntroCampaignPromoBand />
    </>
  );
}
