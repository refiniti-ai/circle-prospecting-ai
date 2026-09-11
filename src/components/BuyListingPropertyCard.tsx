import { ListingPhoto } from "./ListingPhoto";
import { BuyListingDetailFooter } from "./BuyListingDetailFooter";
import { resolveListingDisplayFields } from "../lib/buyListingDisplay";
import type { ListingCampaignType, ListingFormValues, ListingPayload, RadiusId } from "../lib/listingData";

type Props = {
  listing: ListingPayload;
  form: ListingFormValues;
  campaignType: ListingCampaignType;
  radiusId: RadiusId;
  radiusLabel: string;
  radiusCount: number;
  photoPending?: boolean;
};

export function BuyListingPropertyCard({
  listing,
  form,
  campaignType,
  radiusId,
  radiusLabel,
  radiusCount,
  photoPending = false,
}: Props) {
  const d = resolveListingDisplayFields(form, listing, campaignType);
  const photoAlt = d.street || d.cityLine ? `Listing photo for ${d.street || d.cityLine}` : "Default property photo";

  return (
    <article className="buy-mockup-card buy-property-card section-surface buy-card">
      <div className="buy-mockup-card__head">
        <h2 className="buy-mockup-card__title">Selected property</h2>
        <span className={`buy-mockup-card__badge buy-mockup-card__badge--${campaignType}`}>{d.campaignBadge}</span>
      </div>
      <div className="buy-property-card__media">
        <ListingPhoto
          url={listing.listingPhotoUrl}
          alt={photoAlt}
          variant="hero"
          className="buy-property-card__photo"
          pending={photoPending}
        />
      </div>
      <BuyListingDetailFooter
        form={form}
        listing={listing}
        campaignType={campaignType}
        showRadiusLine
        radiusId={radiusId}
        radiusLabel={radiusLabel}
        radiusCount={radiusCount}
        className="buy-property-card__footer"
      />
    </article>
  );
}
