import type { ListingCampaignType, ListingPayload } from "./listingData";
import { buildMlsLeadsUrl } from "./mlsUrl";
import {
  agentRoleFromCampaignPath,
  parseMlsCampaignPathSegment,
} from "./mlsCampaignPath";

export type ListingAgentRole = "buyer" | "seller";

export type ListingAgentInfo = {
  name: string;
  email: string;
  phone: string;
  brokerage: string;
};

export type ListingAgentFormValues = {
  name: string;
  email: string;
  phone: string;
  brokerage: string;
};

export function emptyAgentForm(): ListingAgentFormValues {
  return { name: "", email: "", phone: "", brokerage: "" };
}

export function agentFormFromInfo(a: ListingAgentInfo | undefined): ListingAgentFormValues {
  if (!a) return emptyAgentForm();
  return {
    name: a.name,
    email: a.email,
    phone: a.phone,
    brokerage: a.brokerage,
  };
}

export function agentInfoFromForm(f: ListingAgentFormValues): ListingAgentInfo {
  return {
    name: f.name.trim(),
    email: f.email.trim(),
    phone: f.phone.trim(),
    brokerage: f.brokerage.trim(),
  };
}

export function getSellerAgent(l: ListingPayload): ListingAgentInfo {
  if (l.sellerAgent?.name?.trim()) return l.sellerAgent;
  return {
    name: l.agentName,
    email: l.email,
    phone: l.phone,
    brokerage: l.brokerage,
  };
}

export function getBuyerAgent(l: ListingPayload): ListingAgentInfo {
  if (l.buyerAgent?.name?.trim()) return l.buyerAgent;
  return emptyAgentForm();
}

export function normalizeListingAgents(l: ListingPayload): ListingPayload {
  const seller = getSellerAgent(l);
  const buyer = l.buyerAgent?.name?.trim() ? l.buyerAgent : getBuyerAgent(l);
  return {
    ...l,
    sellerAgent: seller,
    buyerAgent: buyer.name.trim() ? buyer : l.buyerAgent,
  };
}

export function campaignForAgentRole(role: ListingAgentRole): ListingCampaignType {
  return role === "seller" ? "just_sold" : "just_listed";
}

export function applyAgentToListing(l: ListingPayload, role: ListingAgentRole, agent: ListingAgentInfo): ListingPayload {
  const next = { ...l };
  if (role === "seller") {
    next.sellerAgent = agent;
    next.agentName = agent.name;
    next.email = agent.email;
    next.phone = agent.phone;
    next.brokerage = agent.brokerage;
    next.campaignType = "just_sold";
  } else {
    next.buyerAgent = agent;
    next.campaignType = "just_listed";
  }
  return next;
}

export function buildBuyLeadsUrl(
  mls: string,
  opts?: { agent?: ListingAgentRole; campaign?: ListingCampaignType; radius?: string }
): string {
  return buildMlsLeadsUrl(mls, opts);
}

/** buyer | seller | b | s + GHL labels (Listing, Buyer's Agent, etc.). */
export function parseAgentRoleInput(raw: string | null | undefined): ListingAgentRole | null {
  if (!raw?.trim()) return null;
  const t = raw.trim().toLowerCase();
  if (t === "buyer" || t === "b" || t.includes("buyer")) return "buyer";
  if (t === "seller" || t === "s" || t.includes("seller")) return "seller";
  if (t === "listing" || t.includes("listing") || t === "list") return "seller";
  return null;
}

export function agentRoleFromParam(raw: string | null): ListingAgentRole | null {
  return parseAgentRoleInput(raw);
}

export function agentRoleFromPathSegment(raw: string | undefined): ListingAgentRole | null {
  const seg = parseMlsCampaignPathSegment(raw);
  if (seg) return agentRoleFromCampaignPath(seg);
  return parseAgentRoleInput(raw);
}

export function listingHasDualAgents(l: ListingPayload | null): boolean {
  if (!l) return false;
  const buyer = getBuyerAgent(l);
  return Boolean(buyer.name.trim() && (buyer.email.trim() || buyer.phone.trim()));
}

export function patchListingAgents(
  l: ListingPayload,
  seller: ListingAgentFormValues,
  buyer: ListingAgentFormValues
): ListingPayload {
  const sellerInfo = agentInfoFromForm(seller);
  const buyerInfo = agentInfoFromForm(buyer);
  return {
    ...l,
    sellerAgent: sellerInfo,
    buyerAgent: buyerInfo,
    agentName: sellerInfo.name || l.agentName,
    email: sellerInfo.email || l.email,
    phone: sellerInfo.phone || l.phone,
    brokerage: sellerInfo.brokerage || l.brokerage,
  };
}
