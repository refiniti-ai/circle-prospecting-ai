import { ListingPhoto } from "../ListingPhoto";
import { resolveListingDisplayFields } from "../../lib/buyListingDisplay";
import type { ListingCampaignType, ListingFormValues, ListingPayload, RadiusId } from "../../lib/listingData";
import type { MlsCampaignPathSegment } from "../../lib/mlsCampaignPath";

type Props = {
  listing: ListingPayload;
  form: ListingFormValues;
  campaignType: ListingCampaignType;
  campaignPath?: MlsCampaignPathSegment | null;
  radiusId: RadiusId;
  radiusLabel: string;
  radiusCount: number;
  agentName?: string;
  agentEmail?: string | null;
  agentPhone?: string | null;
  /** Default "Selected property"; pass "" to hide kicker in listing picker. */
  kicker?: string;
  badgeLabel?: string;
};

/** Compact horizontal property card — intro funnel only (not buy-leads hero card). */
export function IntroCampaignPropertyCard({
  listing,
  form,
  campaignType,
  campaignPath,
  radiusLabel,
  radiusCount,
  agentName,
  agentEmail,
  agentPhone,
  kicker = "Selected property",
  badgeLabel,
}: Props) {
  const d = resolveListingDisplayFields(form, listing, campaignType, campaignPath);
  const photoAlt = d.street || d.cityLine ? `Listing photo for ${d.street || d.cityLine}` : "Property photo";
  const agentLine = [agentName, agentEmail, agentPhone].filter(Boolean).join(" · ");
  const badge = badgeLabel ?? d.campaignBadge;

  return (
    <article className="intro-property-card">
      <div className="intro-property-card__media">
        <ListingPhoto
          url={listing.listingPhotoUrl}
          alt={photoAlt}
          variant="thumb"
          className="intro-property-card__photo"
        />
      </div>
      <div className="intro-property-card__body">
        <div className="intro-property-card__head">
          {kicker.trim() ? <p className="intro-property-card__kicker">{kicker}</p> : <span />}
          <span className={`intro-property-card__badge intro-property-card__badge--${d.campaignDisplayKind}`}>
            {badge}
          </span>
        </div>
        <h3 className="intro-property-card__street">{d.streetDisplay || d.cityLine || "Listing"}</h3>
        {d.cityLine ? <p className="intro-property-card__city">{d.cityLine}</p> : null}
        <p className="intro-property-card__meta">{d.mlsMeta}</p>
        {agentLine ? <p className="intro-property-card__agent">{agentLine}</p> : null}
        <p className="intro-property-card__radius">
          {radiusLabel} · {radiusCount.toLocaleString()} homes
        </p>
      </div>
    </article>
  );
}
