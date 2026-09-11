"""One-shot script: backfill pay_link_url for every GHL contact that doesn't have one."""
import os, sys, json, time, urllib.request, urllib.error

TOKEN = "pit-ebc6ce02-f652-4ad4-9e42-07e83600107d"
LOCATION = "YCc3oqsHSOrxQ5ojV68g"
PAY_LINK_FIELD_ID = "JBI11fdjO6ueP24LlUrv"  # pay_link_url custom field on this location
API_BASE = "https://services.leadconnectorhq.com"
GEN_URL = "https://circle-prospecting-ai-git-724527267367.us-central1.run.app/api/generate-pay-link"

def ghl_post(path: str, payload: dict):
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=body,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Version": "2021-07-28",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def ghl_get(path: str):
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Version": "2021-07-28",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def generate_pay_link(contact_id: str) -> dict:
    body = json.dumps({"contactId": contact_id}).encode("utf-8")
    req = urllib.request.Request(
        GEN_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"ok": False, "status": e.code, "error": e.read().decode("utf-8", "ignore")[:200]}


def main():
    print("Fetching contacts via search endpoint...")
    page = ghl_post(
        "/contacts/search",
        {
            "locationId": LOCATION,
            "pageLimit": 100,
            "page": 1,
        },
    )
    contacts = page.get("contacts", [])
    print(f"Found {len(contacts)} contacts.\n")

    fixed = 0
    skipped = 0
    failed = 0
    for c in contacts:
        cid = c["id"]
        name = (c.get("firstNameRaw") or "?") + " " + (c.get("lastNameRaw") or "")
        custom = c.get("customFields") or []
        has_pay = any(
            f.get("id") == PAY_LINK_FIELD_ID and str(f.get("value", "")).strip()
            for f in custom
        )
        if has_pay:
            print(f"  SKIP   {cid}  {name}  (already has pay_link_url)")
            skipped += 1
            continue
        print(f"  FILL   {cid}  {name}  …", end=" ")
        sys.stdout.flush()
        res = generate_pay_link(cid)
        if res.get("ok") and (res.get("ghl") or {}).get("ok"):
            print(f"OK  -> {res.get('url','')}")
            fixed += 1
        else:
            print(f"FAIL  {res}")
            failed += 1
        time.sleep(0.4)

    print(f"\nDone. fixed={fixed}, skipped={skipped}, failed={failed}")


if __name__ == "__main__":
    main()
