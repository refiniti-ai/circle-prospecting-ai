import { z } from "zod";

export const radiusCountsSchema = z.object({
  subdivision: z.coerce.number().int().nonnegative(),
  q1: z.coerce.number().int().nonnegative(),
  h1: z.coerce.number().int().nonnegative(),
  m1: z.coerce.number().int().nonnegative(),
  zip: z.coerce.number().int().nonnegative(),
});

const listingNested = z.object({
  internalId: z.coerce.number().int().positive().optional(),
  id: z.coerce.number().int().positive().optional(),
  mls: z.string().min(1),
  address: z.string().min(1),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  cityStateZip: z.string().optional(),
  county: z.string().optional(),
  listPrice: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  createdAt: z.string().optional(),
});

const agentNested = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  brokerage: z.string().optional(),
});

const dualAgentNested = z.object({
  seller: agentNested.optional(),
  buyer: agentNested.optional(),
  sellerAgent: agentNested.optional(),
  buyerAgent: agentNested.optional(),
});

export const inboundNewListingSchema = z
  .object({
    listing: listingNested.optional(),
    agent: agentNested.optional(),
    agents: dualAgentNested.optional(),
    radiusCounts: radiusCountsSchema.optional(),
    // flat payload compatibility
    internalId: z.coerce.number().int().positive().optional(),
    mls: z.string().optional(),
    address: z.string().optional(),
    cityStateZip: z.string().optional(),
    county: z.string().optional(),
    listPrice: z.string().optional(),
    agentName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    brokerage: z.string().optional(),
    lat: z.coerce.number().optional(),
    lng: z.coerce.number().optional(),
    zip: z.string().optional(),
    createdAt: z.string().optional(),
    subdivision: z.coerce.number().int().nonnegative().optional(),
    q1: z.coerce.number().int().nonnegative().optional(),
    h1: z.coerce.number().int().nonnegative().optional(),
    m1: z.coerce.number().int().nonnegative().optional(),
    zipCount: z.coerce.number().int().nonnegative().optional(),
  })
  .passthrough();

export type InboundNewListing = z.infer<typeof inboundNewListingSchema>;
