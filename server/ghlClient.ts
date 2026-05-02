export type GhlResult = {
  contactId?: string;
  opportunityId?: string;
  mode: "configured" | "skipped";
};

async function postJson(url: string, body: unknown, headers?: Record<string, string>) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new Error(`GHL request failed ${r.status}`);
  }
  return (await r.json()) as Record<string, unknown>;
}

/**
 * Flexible GHL integration strategy:
 * - If GHL_UPSERT_CONTACT_URL / GHL_CREATE_OPPORTUNITY_URL are set, this function calls them.
 * - Otherwise it runs in "skipped" mode.
 */
export async function upsertGhlContactAndOpportunity(args: {
  orderId: string;
  address: string;
  agentName: string;
  email: string;
  phone: string;
  brokerage: string;
  cityStateZip: string;
  pipelineName: string;
  stageName: string;
}) {
  const contactUrl = process.env.GHL_UPSERT_CONTACT_URL;
  const oppUrl = process.env.GHL_CREATE_OPPORTUNITY_URL;
  const token = process.env.GHL_BEARER_TOKEN;

  if (!contactUrl || !oppUrl) {
    return { mode: "skipped" } as GhlResult;
  }

  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;

  const contactPayload = {
    firstName: args.agentName,
    email: args.email,
    phone: args.phone,
    companyName: args.brokerage,
    source: "Circle Prospecting AI",
    customFields: {
      orderId: args.orderId,
      listingAddress: `${args.address}, ${args.cityStateZip}`,
    },
  };
  const contact = await postJson(contactUrl, contactPayload, auth);
  const contactId = String(contact.id || contact.contactId || "");

  const oppPayload = {
    name: `${args.address} - Just Listed`,
    pipeline: args.pipelineName,
    stage: args.stageName,
    contactId,
    customData: {
      orderId: args.orderId,
      address: `${args.address}, ${args.cityStateZip}`,
    },
  };
  const opp = await postJson(oppUrl, oppPayload, auth);
  const opportunityId = String(opp.id || opp.opportunityId || "");

  return { contactId, opportunityId, mode: "configured" } as GhlResult;
}
