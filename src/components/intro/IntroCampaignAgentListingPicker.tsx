import { IntroCampaignPropertyCard } from "./IntroCampaignPropertyCard";
import { INTRO_CAMPAIGN } from "../../lib/introCampaign";
import type { IntroListingKind, IntroListingOption } from "../../lib/introAgentListings";
import type { GhlContactSearchHit } from "../../lib/buyLeadsSearchApi";
import {
  DEFAULT_LISTING_RADIUS_ID,
  radiusRingLabel,
  type ListingFormValues,
  type ListingPayload,
} from "../../lib/listingData";

export type IntroListingPick = {
  option: IntroListingOption;
  listing: ListingPayload;
  form: ListingFormValues;
};

type Props = {
  agent: GhlContactSearchHit;
  listed: IntroListingPick[];
  sold: IntroListingPick[];
  buyer: IntroListingPick[];
  busy?: boolean;
  onPick: (pick: IntroListingPick) => void;
  onBack: () => void;
};

function formatAgentMeta(agent: GhlContactSearchHit): string {
  return [agent.email, agent.phone, agent.mls ? `MLS ${agent.mls}` : null, agent.listingAddress]
    .filter(Boolean)
    .join(" · ");
}

function badgeForKind(kind: IntroListingKind): string | undefined {
  if (kind === "buyer") return "BUYER SIDE CLOSE";
  return undefined;
}

function ListingPickCard({
  pick,
  agent,
  busy,
  onPick,
}: {
  pick: IntroListingPick;
  agent: GhlContactSearchHit;
  busy?: boolean;
  onPick: (pick: IntroListingPick) => void;
}) {
  const { option, listing, form } = pick;
  const ring = listing.radii[DEFAULT_LISTING_RADIUS_ID];
  const radiusLabel = radiusRingLabel(DEFAULT_LISTING_RADIUS_ID, ring?.label ?? "1/4 Mile");
  const radiusCount = ring?.count ?? INTRO_CAMPAIGN.homes;

  return (
    <li>
      <button
        type="button"
        className="intro-property-card-btn"
        disabled={busy}
        onClick={() => onPick(pick)}
      >
        <IntroCampaignPropertyCard
          listing={listing}
          form={form}
          campaignType={option.campaignType}
          radiusId={DEFAULT_LISTING_RADIUS_ID}
          radiusLabel={radiusLabel}
          radiusCount={radiusCount}
          agentName={form.agentName || agent.name}
          agentEmail={form.email || agent.email}
          agentPhone={form.phone || agent.phone}
          kicker=""
          badgeLabel={badgeForKind(option.kind)}
        />
      </button>
    </li>
  );
}

export function IntroCampaignAgentListingPicker({
  agent,
  listed,
  sold,
  buyer,
  busy,
  onPick,
  onBack,
}: Props) {
  const hasAny = listed.length > 0 || sold.length > 0 || buyer.length > 0;

  return (
    <div className="intro-agent-listings">
      <div className="intro-agent-listings__agent">
        <p className="intro-agent-listings__label">Agent</p>
        <p className="intro-agent-listings__name">{agent.name}</p>
        <p className="intro-agent-listings__meta">{formatAgentMeta(agent)}</p>
      </div>

      {!hasAny ? (
        <p className="intro-agent-listings__empty muted">
          No listing opportunities found in GoHighLevel for this agent. Try MLS # search instead.
        </p>
      ) : (
        <>
          {listed.length > 0 ? (
            <section className="intro-agent-listings__group">
              <h3 className="intro-agent-listings__group-title">Latest listing</h3>
              <ul className="intro-agent-listings__list intro-agent-listings__list--cards">
                {listed.map((pick) => (
                  <ListingPickCard
                    key={`${pick.option.id}-${pick.option.mls}`}
                    pick={pick}
                    agent={agent}
                    busy={busy}
                    onPick={onPick}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {sold.length > 0 ? (
            <section className="intro-agent-listings__group">
              <h3 className="intro-agent-listings__group-title">Latest sold</h3>
              <ul className="intro-agent-listings__list intro-agent-listings__list--cards">
                {sold.map((pick) => (
                  <ListingPickCard
                    key={`${pick.option.id}-${pick.option.mls}`}
                    pick={pick}
                    agent={agent}
                    busy={busy}
                    onPick={onPick}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {buyer.length > 0 ? (
            <section className="intro-agent-listings__group">
              <h3 className="intro-agent-listings__group-title">Buyer side close</h3>
              <ul className="intro-agent-listings__list intro-agent-listings__list--cards">
                {buyer.map((pick) => (
                  <ListingPickCard
                    key={`${pick.option.id}-${pick.option.mls}`}
                    pick={pick}
                    agent={agent}
                    busy={busy}
                    onPick={onPick}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <button type="button" className="intro-agent-listings__back muted" disabled={busy} onClick={onBack}>
        ← Search again
      </button>
    </div>
  );
}
