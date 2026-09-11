import { ListingPhoto } from "./ListingPhoto";
import { resolveListingDisplayFields } from "../lib/buyListingDisplay";
import { radiusRingLabel, type ListingFormValues, type ListingPayload, type RadiusId } from "../lib/listingData";
import { checkoutPricePerLeadUsd, formatMoneyUsd, serviceLineLabel, type LeadServiceLine, type LeadTierId } from "../lib/leadPricing";

type Props = {
  listing: ListingPayload;
  form: ListingFormValues;
  campaignLabel: string;
  campaignType: "just_listed" | "just_sold";
  radiusId: RadiusId;
  radiusLabel: string;
  homes: number;
  serviceLine: LeadServiceLine;
  tierId: LeadTierId;
  packageLabel: string;
  promoCode: string | null;
  totalCents: number;
  onContinue?: () => void;
  continueDisabled?: boolean;
  busy?: boolean;
  compact?: boolean;
  photoPending?: boolean;
};

function targetAreaLabel(radiusId: RadiusId, radiusLabel: string): string {
  const ring = radiusRingLabel(radiusId, radiusLabel);
  return radiusId === "zip" ? ring : `${ring} Radius`;
}

export function BuyOrderSummarySidebar({
  listing,
  form,
  campaignLabel,
  campaignType,
  radiusId,
  radiusLabel,
  homes,
  serviceLine,
  tierId,
  packageLabel,
  promoCode,
  totalCents,
  onContinue,
  continueDisabled,
  busy,
  compact = false,
  photoPending = false,
}: Props) {
  const d = resolveListingDisplayFields(form, listing, campaignType);
  const perHome = checkoutPricePerLeadUsd(serviceLine, tierId, promoCode);
  const displayCampaign = campaignLabel === "Just listed" ? "Just Listed" : campaignLabel === "Just sold" ? "Just Sold" : campaignLabel;

  return (
    <aside className={`buy-mockup-card buy-order-summary section-surface buy-card${compact ? " buy-order-summary--compact" : ""}`}>
      <h2 className="buy-mockup-card__title">Order summary</h2>
      <div className="buy-order-summary__listing">
        <ListingPhoto
          url={listing.listingPhotoUrl}
          alt={`Listing photo for ${d.street || d.cityLine || "property"}`}
          variant="thumb"
          pending={photoPending}
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
            <dd>{homes.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Service</dt>
            <dd>{serviceLineLabel(serviceLine)}</dd>
          </div>
          <div>
            <dt>Plan (Band)</dt>
            <dd>{packageLabel}</dd>
          </div>
          <div>
            <dt>Rate</dt>
            <dd>{formatMoneyUsd(perHome)} / home</dd>
          </div>
        </dl>
      </div>
      <div className="buy-order-summary__footer">
        <div className="buy-order-summary__total-box">
          <div className="buy-order-summary__total">
            <span>Estimated Total</span>
            <strong className="gradient-text">{formatMoneyUsd(totalCents / 100)}</strong>
          </div>
          <p className="buy-order-summary__total-note">One-time campaign</p>
        </div>
        {onContinue ? (
          <button
            type="button"
            className="btn btn-primary buy-order-summary__cta"
            disabled={continueDisabled || busy}
            onClick={onContinue}
          >
            {busy ? "Redirecting…" : "Continue to checkout →"}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
