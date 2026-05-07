import { MOCK_DELIVERY_OPPORTUNITIES } from "../../lib/mockDeliveriesUi";

/**
 * Marketing mock: listing header + Filter / Count / Actions table only (no campaign codes).
 */
export function RzDeliveriesOpportunityList() {
  return (
    <div className="rz-pui-deliveries-opps" aria-label="Sample delivery listings and opportunity counts">
      {MOCK_DELIVERY_OPPORTUNITIES.map((listing) => (
        <div key={listing.mls} className="rz-pui-opp-panel rz-pui-opp-panel--solo">
          <div className="rz-pui-opp-head">
            <span className="rz-pui-opp-mls">{listing.mls}</span>
            <span className="rz-pui-opp-addr">{listing.addressLine}</span>
          </div>
          <div className="rz-pui-opp-table-scroll">
            <table className="rz-pui-opp-table">
              <thead>
                <tr>
                  <th scope="col">Filter</th>
                  <th scope="col">Count</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listing.rows.map((row) => (
                  <tr key={`${listing.mls}-${row.filter}`}>
                    <td>{row.filter}</td>
                    <td className="rz-pui-opp-count">{row.homes.toLocaleString()} homes</td>
                    <td className="rz-pui-opp-actions">
                      <button type="button" className="rz-pui-opp-btn rz-pui-opp-btn--search" disabled title="Demo preview — not connected">
                        Search
                      </button>
                      <button type="button" className="rz-pui-opp-btn rz-pui-opp-btn--map" disabled title="Demo preview — not connected">
                        Map
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <p className="rz-pui-opp-demo-note">Sample addresses and counts for layout — not live data.</p>
    </div>
  );
}
