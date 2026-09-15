import { ListingMap } from "./ListingMap";
import { radiusSummaryLine, resolveListingDisplayFields } from "../lib/buyListingDisplay";
import type { ListingCampaignType, ListingFormValues, ListingPayload, RadiusId } from "../lib/listingData";
import type { MlsCampaignPathSegment } from "../lib/mlsCampaignPath";

type Ring = { label: string; count: number };

type Props = {
  listing: ListingPayload;
  form: ListingFormValues;
  campaignType: ListingCampaignType;
  campaignPath?: MlsCampaignPathSegment | null;
  radiusId: RadiusId;
  selectedRing: Ring | undefined;
  mapHasCoords: boolean;
  mapLat: number;
  mapLng: number;
  mapPreviewRadius: RadiusId;
  mapPreviewRadiusMiles: number;
  mapPreviewRadiusLabel: string;
  locatingMap: boolean;
  mapNotice: string | null;
};

function HomeownersMatched({ count }: { count: number }) {
  return (
    <div className="buy-map-card__matched" role="status">
      <span className="buy-map-card__matched-label">Homeowners matched</span>
      <strong className="buy-map-card__matched-n">{count.toLocaleString()}</strong>
    </div>
  );
}

export function BuyMapPreviewCard({
  listing,
  form,
  campaignType,
  campaignPath,
  radiusId,
  selectedRing,
  mapHasCoords,
  mapLat,
  mapLng,
  mapPreviewRadius,
  mapPreviewRadiusMiles,
  mapPreviewRadiusLabel,
  locatingMap,
  mapNotice,
}: Props) {
  const d = resolveListingDisplayFields(form, listing, campaignType, campaignPath);
  const campaignLine = d.mls ? `${d.campaignPrefix}: ${d.mls}` : d.campaignPrefix;
  const matchedCount = selectedRing?.count;

  return (
    <div className="buy-mockup-card buy-map-card section-surface buy-card buy-card--map">
      <h2 className="buy-mockup-card__title">Map preview</h2>
      <div className="buy-map-card__frame cp-map-frame buy-map-preview">
        {mapHasCoords ? (
          <ListingMap
            key={`${mapLat}-${mapLng}-${mapPreviewRadius}-${mapPreviewRadiusMiles}`}
            lat={mapLat}
            lng={mapLng}
            radius={mapPreviewRadius}
            radiusMiles={mapPreviewRadiusMiles}
            radiusLabel={`${mapPreviewRadiusLabel} radius`}
            height={340}
          />
        ) : (
          <div
            className="buy-map-preview buy-map-preview--empty"
            style={{ display: "grid", placeItems: "center", padding: "1.25rem" }}
          >
            <p className="muted buy-map-card__empty-msg">
              {locatingMap
                ? "Loading map for this property…"
                : mapNotice ||
                  "Could not place this address on the map yet. Check the street, city, state, and ZIP."}
            </p>
          </div>
        )}
      </div>
      <div className="buy-map-card__footer">
        <div className="buy-map-card__footer-text">
          <p className="buy-map-card__campaign">{campaignLine}</p>
          {d.streetDisplay ? <p className="buy-map-card__street">{d.streetDisplay}</p> : null}
          {d.cityLine ? <p className="buy-map-card__city">{d.cityLine}</p> : null}
          {selectedRing ? (
            <p className="buy-map-card__radius">
              {radiusSummaryLine(radiusId, selectedRing.label, selectedRing.count)}
            </p>
          ) : null}
        </div>
        {matchedCount != null ? <HomeownersMatched count={matchedCount} /> : null}
      </div>
    </div>
  );
}
