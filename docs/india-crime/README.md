# India crime reporting integration tracker

Start with Tamil Nadu, then select one state or Union Territory at a time. Track
the official complaint service, API contract, photo handling, provider access and
district coverage here before enabling filing in CivicLens. This tracker covers
crime reporting; municipal complaints remain a separate workstream.

Created and initially reviewed: **25 October 2026**. Next source review:
**23 January 2027**, or immediately after a service, jurisdiction or API change.

The baseline contains **28 states, 8 Union Territories and 784 administrative
districts** from the existing 24 October 2026 LGD reference snapshot. Each state/UT
has an initial public-source discovery review and its own district checklist.
These counts describe this snapshot, not completed police integration or a legal
guarantee that all recent district changes have reached LGD. No state or district
integration is resolved yet.

## Start with Tamil Nadu

The shared gateway is now implemented and tested locally. See the
[API integration guide](api.md) for discovery, administrative selection, readiness,
private request creation/status and connecting another provider. This does not
enable government filing or resolve police-jurisdiction mapping.

Open [Tamil Nadu](states/tamil-nadu.md) first. Its official UMANG/API Setu
specification documents complaint registration and complaint/CSR/FIR status APIs.
Its `image` and `image_code` fields do not establish an evidence-photo contract.
Provider approval, a usable test environment, required identity/device fields,
image semantics and official-reference handling remain open. The advertised
sandbox was unavailable at the initial review.

The [API feasibility audit](../authority-sources/india-crime-api-feasibility-2026-10-25.md)
contains the inspected endpoint paths, schema gaps and specification hashes.

1. Obtain the current contract and provider-approved test access.
2. Confirm photo upload, official acknowledgement and status lookup end to end.
3. Agree the first district/police jurisdiction after checking provider identifiers.
4. Implement and test that approved pilot with synthetic records in the authorized
   test environment.
5. Expand district by district; resolve the state only when its declared scope and
   every district disposition have evidence and sign-off.

No first district is selected automatically. Administrative districts, police
districts, commissionerates, railway police and specialist units can differ.

## Status and evidence rules

- **Discovery recorded:** official entry points or source leads have been found;
  live form behavior, API access and jurisdiction may still be unknown.
- **Contract verified:** current official create/upload/status semantics and the
  allowed use case are documented. A lookup API or website upload form alone does
  not meet this condition.
- **Access pending:** publisher/application approval or an authorized test
  environment is missing. Published OpenAPI files are not issued credentials.
- **In progress:** an approved scope has an implementation and active validation.
- **Resolved:** the selected delivery mode, district dispositions, evidence and
  reviewer sign-off meet the closure criteria below.

An unchecked box means unresolved. A blank or "not verified" API field means
unknown, not that the provider has no API. Use "not offered" only with dated
provider evidence. Do not change a state to resolved merely because a document,
source link, mock test or CivicLens record exists.

## State and Union Territory register

The resolution checkbox in this table is the state-level source of truth. API
details, blockers and district checkboxes live in the linked state file.

<!-- STATE_REGISTER_START -->

| Resolved | Task | State or UT | Type | LGD districts | API discovery |
| --- | --- | --- | --- | ---: | --- |
| [ ] | IN-33 | [Tamil Nadu](states/tamil-nadu.md) | State | 38 | Create/status API candidate; media/access pending |
| [ ] | IN-35 | [Andaman and Nicobar Islands](states/andaman-and-nicobar-islands.md) | UT | 3 | Complaint integration API not verified |
| [ ] | IN-28 | [Andhra Pradesh](states/andhra-pradesh.md) | State | 28 | Complaint integration API not verified |
| [ ] | IN-12 | [Arunachal Pradesh](states/arunachal-pradesh.md) | State | 27 | Complaint integration API not verified |
| [ ] | IN-18 | [Assam](states/assam.md) | State | 35 | Complaint integration API not verified |
| [ ] | IN-10 | [Bihar](states/bihar.md) | State | 38 | Complaint integration API not verified |
| [ ] | IN-4 | [Chandigarh](states/chandigarh.md) | UT | 1 | Complaint integration API not verified |
| [ ] | IN-22 | [Chhattisgarh](states/chhattisgarh.md) | State | 33 | Complaint integration API not verified |
| [ ] | IN-38 | [Dadra and Nagar Haveli and Daman and Diu](states/dadra-and-nagar-haveli-and-daman-and-diu.md) | UT | 3 | Complaint integration API not verified |
| [ ] | IN-7 | [Delhi](states/delhi.md) | UT | 13 | Complaint integration API not verified |
| [ ] | IN-30 | [Goa](states/goa.md) | State | 3 | Complaint integration API not verified |
| [ ] | IN-24 | [Gujarat](states/gujarat.md) | State | 34 | Complaint integration API not verified |
| [ ] | IN-6 | [Haryana](states/haryana.md) | State | 23 | Complaint integration API not verified |
| [ ] | IN-2 | [Himachal Pradesh](states/himachal-pradesh.md) | State | 12 | Complaint integration API not verified |
| [ ] | IN-1 | [Jammu and Kashmir](states/jammu-and-kashmir.md) | UT | 20 | Complaint integration API not verified |
| [ ] | IN-20 | [Jharkhand](states/jharkhand.md) | State | 24 | Complaint integration API not verified |
| [ ] | IN-29 | [Karnataka](states/karnataka.md) | State | 31 | Complaint integration API not verified |
| [ ] | IN-32 | [Kerala](states/kerala.md) | State | 14 | Complaint integration API not verified |
| [ ] | IN-37 | [Ladakh](states/ladakh.md) | UT | 2 | Complaint integration API not verified |
| [ ] | IN-31 | [Lakshadweep](states/lakshadweep.md) | UT | 1 | Complaint integration API not verified |
| [ ] | IN-23 | [Madhya Pradesh](states/madhya-pradesh.md) | State | 55 | Lookup API documented; create/upload unverified |
| [ ] | IN-27 | [Maharashtra](states/maharashtra.md) | State | 36 | Complaint integration API not verified |
| [ ] | IN-14 | [Manipur](states/manipur.md) | State | 16 | Complaint integration API not verified |
| [ ] | IN-17 | [Meghalaya](states/meghalaya.md) | State | 12 | Complaint integration API not verified |
| [ ] | IN-15 | [Mizoram](states/mizoram.md) | State | 11 | Complaint integration API not verified |
| [ ] | IN-13 | [Nagaland](states/nagaland.md) | State | 17 | Complaint integration API not verified |
| [ ] | IN-21 | [Odisha](states/odisha.md) | State | 30 | Complaint integration API not verified |
| [ ] | IN-34 | [Puducherry](states/puducherry.md) | UT | 2 | Complaint integration API not verified |
| [ ] | IN-3 | [Punjab](states/punjab.md) | State | 23 | Complaint integration API not verified |
| [ ] | IN-8 | [Rajasthan](states/rajasthan.md) | State | 41 | Complaint integration API not verified |
| [ ] | IN-11 | [Sikkim](states/sikkim.md) | State | 6 | Complaint integration API not verified |
| [ ] | IN-36 | [Telangana](states/telangana.md) | State | 33 | Complaint integration API not verified |
| [ ] | IN-16 | [Tripura](states/tripura.md) | State | 8 | Complaint integration API not verified |
| [ ] | IN-9 | [Uttar Pradesh](states/uttar-pradesh.md) | State | 75 | Complaint integration API not verified |
| [ ] | IN-5 | [Uttarakhand](states/uttarakhand.md) | State | 13 | Complaint integration API not verified |
| [ ] | IN-19 | [West Bengal](states/west-bengal.md) | State | 23 | Complaint integration API not verified |

<!-- STATE_REGISTER_END -->

## District work and closure

Each state file lists every administrative district in the pinned LGD snapshot,
with its official LGD code. **LGD codes are not police-provider district or station
codes.** Nothing in the district tables is verified police routing yet.

For each district:

1. Verify current administrative identity and any new/renamed/split district using
   LGD plus state notifications or the district administration.
2. Record the actual police district/commissionerate, responsible office, official
   source, provider district/station identifiers and supported complaint classes.
   Add police-unit subrows where an administrative district crosses jurisdictions.
3. Mark **Mapping checked** only after the jurisdiction and provider-code mapping
   have a dated evidence link. Never derive these codes from names or LGD alone.
4. Record the applicable state adapter/contract and attachment restrictions, or a
   separately evidenced local exception. A district need not have its own API if
   the authorized state API demonstrably routes it correctly.
5. Mark **Resolved** only after the district's agreed service works in approved
   testing, or after an explicitly approved fallback/exclusion with a documented
   reason. Distinguish `API verified`, `handoff only` and `excluded`; a fallback
   does not mean automatic filing is available.

Place short evidence links and an issue/QA reference in the district's **Evidence
and disposition** cell. Use a dated subsection below the table for longer notes.
Record the reviewer, date and supported delivery mode. Do not store complainant
names, evidence photos, credentials, precise incident locations or real complaint
identifiers in this public-repository tracker.

The central district baseline is [the existing LGD reference snapshot](../../api/data/directory/in-lgd-administrative.json).
Its SHA-256 is `9f2b37f508f4f8a1dd638db884b4535ab0ada8c03bb039b14cb22370f305b14b`.
Administrative attribution and import details are in
[the multicountry source audit](../authority-sources/multicountry-2026-10-25.md).
The snapshot is an LGD-derived public mirror, not a new direct LGD download.
Keep its provenance when refreshing it, and preserve completed district evidence
across renames, merges or splits rather than replacing rows blindly.

Puducherry regions and Ladakh's district-reorganisation status need explicit
cross-checks before coverage claims. The baseline's two Puducherry districts and
two Ladakh districts are reference counts, not verified police coverage. The
older national police directory also has legacy labels and omits Ladakh in its
current dropdown; use the current UT's own sources for that entry.

## API details required for every state

Each state file carries the following review fields. Fill them from the current
provider documentation and approval, with version and checked date:

| Field | Required evidence |
| --- | --- |
| Service scope | Police owner, eligible complaint types, geographic coverage, emergency exclusions |
| API contract | Official docs/OpenAPI URL and version; base URL and create endpoint |
| Photo evidence | Actual upload/attachment endpoints, purpose, encoding, allowed types, size/count limits, original-file handling |
| Access | Organization/app eligibility, subscription/publisher approval, user login/OTP/consent requirements |
| Official reference | Provider acceptance fields; distinction between complaint, CSR and FIR |
| Tracking | Authorized status lookup/callback, ownership checks and reference format |
| Reliability | Idempotency, timeout reconciliation, duplicate prevention, quotas, rate limits and provider outage behavior |
| Jurisdiction | Provider police-district/station codes and mapping evidence for every included district |
| Verification | Approved test environment, synthetic upload/create/reference/status receipt and failure cases |
| Maintenance | Owner, reviewer, checked date, expiry/recheck trigger, issues and release evidence |

The CivicLens five-photo limit must not be assumed to be a government API limit.
No production complaint should be created as a test. Mock results, HTTP 200 and
opening a web form are not evidence of an accepted official filing.

## National services

| Service | Role | Integration status |
| --- | --- | --- |
| [112 ERSS](https://www.mha.gov.in/nirbhayaerss-section) | Urgent police, fire and medical assistance | Emergency guidance; no CivicLens dispatch API verified. Do not delay emergency access for login or moderation. |
| [Digital Police](https://digitalpolice.gov.in/) | Gateway to state citizen police services | Directory/gateway; not a universal complaint-create API. |
| [National Cyber Crime Reporting Portal](https://cybercrime.gov.in/) | Cybercrime complaints and supporting evidence | Citizen portal verified from official documentation; third-party create/upload/status access not verified. |
| [1930](https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=1814120&lang=2&reg=48) | Prompt reporting of online financial fraud | Phone route; not a general crime submission API. |
| [eSakshya](https://icjs.gov.in/esakshya/) | Digital evidence platform advertising an API bundle | Separate evidence/investigation integration lead; no CivicLens citizen complaint intake authorization verified. |
| [API Setu](https://docs.apisetu.gov.in/document-central/explore-apisetu/Overview.html) | API discovery, subscription and publisher approval | Consumer/app/provider approval required; inspect the actual operations rather than relying on a police-named listing. |

CPGRAMS, CM helplines, public service grievance portals, police-misconduct
authorities and anti-corruption forms have different mandates. Keep them as
separately labelled routes where relevant; they must not silently replace a
criminal complaint or FIR service.

## State resolution criteria

Use the checklist in each state file. Before checking a state as resolved:

- The supported delivery mode and incident classes have dated reviewer approval.
- All included police jurisdictions have verified provider routing; every
  administrative district has an explicit supported/fallback/excluded disposition.
- API authority and user consent are established, and current create/photo/status
  contracts are tested where automatic filing is claimed.
- Tests cover valid and rejected evidence, expired credentials, duplicate taps,
  partial uploads, lost submission responses, reference reconciliation, wrong
  jurisdiction, provider outages and account isolation.
- The user sees an official acknowledgement only when the provider returns one;
  uncertain outcomes are held for reconciliation rather than blindly retried.
- Private evidence/identity handling, retention, deletion and access auditing are
  reviewed. Government identity stays separate from public nicknames and captions.
- Actual deployment/device QA and the supported scope are recorded for an approved
  release. Local code or contract review alone is not release evidence.
- Remaining gaps are linked and explicitly accepted; record reviewer, date,
  contract version, QA evidence and recheck date in the state resolution record.

Keep real crime details out of social captions, humour generation and public
tracking documents. Original evidence needs a reviewed private-storage and
integrity design; metadata-stripped social images must not be described as
untouched originals. Application credentials belong in civiclens-prefixed OpenBao
paths separated by environment. This documentation authorizes no live migration,
police submission or production rollout.

## Review record

On 25 October 2026, initial public-source discovery was performed for all 36
states/UTs. Tamil Nadu and Madhya Pradesh have the previously inspected official
UMANG specifications; other entries retain unknown integration API status.
State files distinguish a direct page retrieval from indexed official-source
discovery. A failed local retrieval is not a conclusion that the public service
is unavailable nationally. A successful page retrieval is not a successful filing.

Raw source pages, local retrieval checks and the inspected API specifications are
kept in ignored `artifacts/research/india-crime/`. No registration, terms
acceptance, provider subscription, government API operation, phone call, evidence
upload or real filing was performed. Implementation remains separate from this
tracker.
