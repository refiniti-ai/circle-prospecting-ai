/** Demo-only rows for the homepage “Deliveries” card — not live counts. */
export type MockOpportunityRow = { filter: string; homes: number };

export type MockDeliveryListing = {
  mls: string;
  addressLine: string;
  rows: MockOpportunityRow[];
};

export const MOCK_DELIVERY_OPPORTUNITIES: MockDeliveryListing[] = [
  {
    mls: "TB8502524",
    addressLine: "1775 STABLE TRL, Palm Harbor, FL, 34685",
    rows: [
      { filter: "Subdivision", homes: 50 },
      { filter: "1/4 Mile", homes: 372 },
      { filter: "1/2 Mile", homes: 791 },
      { filter: "1 Mile", homes: 3329 },
      { filter: "34685 ZipCode", homes: 7317 },
    ],
  },
  {
    mls: "U8138841",
    addressLine: "2846 WINDING OAKS DR, Dunedin, FL, 34698",
    rows: [
      { filter: "Subdivision", homes: 38 },
      { filter: "1/4 Mile", homes: 289 },
      { filter: "1/2 Mile", homes: 612 },
      { filter: "1 Mile", homes: 2641 },
      { filter: "34698 ZipCode", homes: 5890 },
    ],
  },
];
