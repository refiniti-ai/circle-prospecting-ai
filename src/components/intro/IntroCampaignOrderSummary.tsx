import { ListingPhoto } from "../ListingPhoto";
import { resolveListingDisplayFields } from "../../lib/buyListingDisplay";
import { formatMoneyUsd, serviceLineLabel } from "../../lib/leadPricing";
import { radiusRingLabel, type ListingFormValues, type ListingPayload, type RadiusId } from "../../lib/listingData";
import { INTRO_CAMPAIGN } from "../../lib/introCampaign";
import type { MlsCampaignPathSegment } from "../../lib/mlsCampaignPath";

type Props = {
  listing: ListingPayload;
  form: ListingFormValues;
  campaignLabel: string;
  campaignType: "just_listed" | "just_sold";
  campaignPath?: MlsCampaignPathSegment | null;
  radiusId: RadiusId;
  radiusLabel: string;
  onContinue?: () => void;
  busy?: boolean;
};

function targetAreaLabel(radiusId: RadiusId, radiusLabel: string): string {
  const ring = radiusRingLabel(radiusId, radiusLabel);
  return radiusId === "zip" ? ring : `${ring} Radius`;
}

export function IntroCampaignOrderSummary({
  listing,
  form,
  campaignLabel,
  campaignType,
  campaignPath,
  radiusId,
  radiusLabel,
  onContinue,
  busy,
}: Props) {
  const d = resolveListingDisplayFields(form, listing, campaignType, campaignPath);
  const displayCampaign =
    campaignLabel === "Just listed"
      ? "Just Listed"
      : campaignLabel === "Just sold"
        ? "Just Sold"
        : campaignLabel === "Coming soon"
          ? "Coming Soon"
          : campaignLabel;

  return (
    <aside className="buy-mockup-card buy-order-summary section-surface buy-card">
      <h2 className="buy-mockup-card__title">Order summary</h2>
      <div className="buy-order-summary__listing">
        <ListingPhoto
          url={listing.listingPhotoUrl}
          alt={`Listing photo for ${d.street || d.cityLine || "property"}`}
          variant="thumb"
        />
        <div className="buy-order-summary__listing-text">
          {d.streetDisplay ? (
            <strong className="buy-listing-detail__street buy-listing-detail__street--compact">{d.streetDisplay}</strong>
          ) : null}
          {d.cityLine ? <span className="buy-listing-detail__city buy-listing-detail__city--compact">{d.cityLine}</span> : null}
          <span className="buy-listing-detail__meta buy-listing-detail__meta--compact">{d.mlsMeta}</span>
        </div>
      </div>
      <div className="buy-order-summary__body">
        <dl className="buy-order-summary__rows">
          <div>
            <dt>Campaign</dt>
            <dd>{displayCampaign}</dd>
          </div>
          <div>
            <dt>Target Area</dt>
            <dd>{targetAreaLabel(radiusId, radiusLabel)}</dd>
          </div>
          <div>
            <dt>Homes in Order</dt>
            <dd>{INTRO_CAMPAIGN.homes.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Service</dt>
            <dd>{serviceLineLabel(INTRO_CAMPAIGN.serviceLine)}</dd>
          </div>
          <div>
            <dt>Intro offer</dt>
            <dd>First-time $99</dd>
          </div>
        </dl>
      </div>
      <div className="buy-order-summary__footer">
        <div className="buy-order-summary__total-box">
          <div className="buy-order-summary__total">
            <span>Intro total</span>
            <strong className="gradient-text">{formatMoneyUsd(INTRO_CAMPAIGN.priceUsd)}</strong>
          </div>
          <p className="buy-order-summary__total-note">One-time first-time customer offer</p>
        </div>
        {onContinue ? (
          <button type="button" className="btn btn-primary buy-order-summary__cta" disabled={busy} onClick={onContinue}>
            Continue to checkout →
          </button>
        ) : null}
      </div>
    </aside>
  );
}
