import { radiusSummaryLine, resolveListingDisplayFields } from "../lib/buyListingDisplay";
import type { ListingCampaignType, ListingFormValues, ListingPayload, RadiusId } from "../lib/listingData";

function MegaphoneIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden fill="none">
      <path
        d="M3 8v4h3l5 3V5L6 8H3Zm11 1.5a2.5 2.5 0 0 0 0-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HouseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden fill="none">
      <path
        d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1V9.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  form: ListingFormValues;
  listing: ListingPayload;
  campaignType: ListingCampaignType;
  showCampaignLine?: boolean;
  showRadiusLine?: boolean;
  radiusId?: RadiusId;
  radiusLabel?: string;
  radiusCount?: number;
  className?: string;
};

/** Shared listing text block — same typography in property, map, and summary cards. */
export function BuyListingDetailFooter({
  form,
  listing,
  campaignType,
  showCampaignLine = false,
  showRadiusLine = false,
  radiusId,
  radiusLabel,
  radiusCount,
  className = "",
}: Props) {
  const d = resolveListingDisplayFields(form, listing, campaignType);
  const campaignLine = d.mls ? `${d.campaignPrefix}: ${d.mls}` : d.campaignPrefix;

  return (
    <div className={`buy-listing-detail ${className}`.trim()}>
      {showCampaignLine ? <p className="buy-listing-detail__campaign">{campaignLine}</p> : null}
      {d.streetDisplay ? <p className="buy-listing-detail__street">{d.streetDisplay}</p> : null}
      {d.cityLine ? <p className="buy-listing-detail__city">{d.cityLine}</p> : null}
      <p className="buy-listing-detail__meta">{d.mlsMeta}</p>
      <div className="buy-listing-detail__tags">
        <span className="buy-listing-detail__tag">
          <MegaphoneIcon />
          {d.campaignLabel}
        </span>
        <span className="buy-listing-detail__tag">
          <HouseIcon />
          Single Family
        </span>
      </div>
      {showRadiusLine && radiusId && radiusLabel != null && radiusCount != null ? (
        <p className="buy-listing-detail__radius">{radiusSummaryLine(radiusId, radiusLabel, radiusCount)}</p>
      ) : null}
    </div>
  );
}
