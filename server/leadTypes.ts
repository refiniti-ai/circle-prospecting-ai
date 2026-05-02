export type Lead = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  mls: string;
  listPrice: string;
  propertyType: string;
  phone: string;
  email: string;
  status: "available" | "sold";
  soldToEmail?: string;
  stripeSessionId?: string;
  soldAt?: string;
};

export type LeadInventory = {
  leads: Lead[];
  lastUpdated: string;
};
