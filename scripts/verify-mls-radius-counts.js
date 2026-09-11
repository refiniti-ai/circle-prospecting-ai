/**
 * Verify GHL radius counts for an MLS (opportunity + contact + buy-leads prefill).
 * Usage: npx tsx scripts/verify-mls-radius-counts.ts TB8487057
 */
import "dotenv/config";
import { fetchGhlOpportunity, readOpportunityField, searchGhlOpportunitiesByMls, } from "../server/ghlOpportunityFetch.js";
import { fetchGhlContactPrefill, searchGhlContactsByMls } from "../server/ghlContactFetch.js";
const mls = process.argv[2]?.trim().toUpperCase();
if (!mls || mls.length < 3) {
    console.error("Usage: npx tsx scripts/verify-mls-radius-counts.ts TB8487057");
    process.exit(1);
}
function radiusRow(label, v) {
    return { ring: label, count: v?.trim() || "(empty)" };
}
function oppRadii(oppId, fields) {
    return {
        opportunityId: oppId,
        subdivision: fields.subdivision,
        q1: fields.q1,
        h1: fields.h1,
        m1: fields.m1,
        zip: fields.zip,
    };
}
async function readOppRadii(oppId) {
    const full = await fetchGhlOpportunity(oppId);
    return oppRadii(oppId, {
        subdivision: readOpportunityField(full, "subdivision_home_owners"),
        q1: readOpportunityField(full, "one_fourth_mile_home_owners"),
        h1: readOpportunityField(full, "half_mile_home_owners"),
        m1: readOpportunityField(full, "one_mile_home_owners"),
        zip: readOpportunityField(full, "zipcode_home_owners"),
    });
}
console.log(`\n=== MLS ${mls} ===\n`);
const opps = await searchGhlOpportunitiesByMls(mls, 5);
console.log(`Opportunities found: ${opps.length}`);
for (const o of opps) {
    const row = await readOppRadii(o.id);
    console.log(JSON.stringify({ name: o.name, contactId: o.contactId, ...row }, null, 2));
}
const contacts = await searchGhlContactsByMls(mls, 5);
console.log(`\nContacts (search-by-mls): ${contacts.length}`);
for (const c of contacts) {
    console.log(JSON.stringify({
        contactId: c.id,
        name: c.name,
        mls: c.mls,
        subdivision: c.subdivisionHomeOwners,
        q1: c.oneFourthMileHomeOwners,
        h1: c.halfMileHomeOwners,
        m1: c.oneMileHomeOwners,
        zip: c.zipcodeHomeOwners,
    }, null, 2));
    const prefill = await fetchGhlContactPrefill(c.id, mls);
    console.log("Prefill (buy-leads):", JSON.stringify({
        subdivision: prefill.subdivisionHomeOwners,
        q1: prefill.oneFourthMileHomeOwners,
        h1: prefill.halfMileHomeOwners,
        m1: prefill.oneMileHomeOwners,
        zip: prefill.zipcodeHomeOwners,
    }, null, 2));
}
if (!opps.length && !contacts.length) {
    console.log("\nNo GHL contact or opportunity found for this MLS.");
    console.log("Listing must exist in GHL (Create Opportunity workflow) before buy-leads can load radius counts.");
}
