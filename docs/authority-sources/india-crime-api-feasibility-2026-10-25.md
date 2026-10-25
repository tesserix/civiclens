# India crime reporting API feasibility

Checked: 25 October 2026. Read-only research; no complaint, police call, evidence
upload, account registration, provider subscription or live cloud/database change.

Continue work in the [India crime reporting tracker](../india-crime/README.md),
with one file per state/UT and district mapping/resolution checklists. This audit
preserves the inspected API-contract findings; ongoing implementation status is
maintained in the tracker.

## Finding

An official API candidate exists for Tamil Nadu Police. The published UMANG/API
Setu OpenAPI collection includes complaint registration and status operations.
This corrects an assumption that a website handoff is the only possible route.
It does not establish access for CivicLens, current backend operation, photo upload
semantics, or nationwide coverage. Do not enable automatic submission yet.

## Evidence and coverage

| Provider | Official evidence | Verified from documentation | Not verified |
| --- | --- | --- | --- |
| Tamil Nadu Police / UMANG | [API collection](https://directory.apisetu.gov.in/api-collection/tngov), [OpenAPI YAML](https://cf-media.api-setu.in/specfiles/1714048321_UMANG-TNPolice.yaml) | Nine POST operations, including complaint registration, complaint/CSR/FIR status, district/station/subject/gender lookup. Header `x-api-key` security. | CivicLens eligibility, issued credentials, current service operation, user authentication/consent requirements, supported complaint classes, usable upload contract, official receipt semantics, duplicate reconciliation. |
| Madhya Pradesh Police / UMANG | [API collection](https://directory.apisetu.gov.in/api-collection/mppolice), [OpenAPI YAML](https://cf-media.api-setu.in/specfiles/1681369249_UMANG-MPeCop.yaml) | 37 documented operations: login/profile, reference/contact data, missing-person/vehicle/unidentified-body lookup and vendor token. | No complaint-create or evidence-upload operation identified in this published version. POST method alone does not mean an operation creates a complaint. |
| NCRP / I4C | [Official complaint checklist](https://cybercrime.gov.in/Webform/Crime_AuthoLogin.aspx), [FAQ](https://cybercrime.gov.in/Webform/FAQ.aspx) | Citizen portal supports reporting and image/video/document evidence. Checklist states evidence up to 10 MB each and identity image up to 5 MB, subject to the actual current form. | No public third-party create/upload/status API contract or CivicLens access verified. Portal upload support is not API access. |
| I4C / Delhi Police | [NIC integration report](https://informatics.nic.in/news/1535) | NIC describes NCRP-to-Delhi-Police eFIR API integration for qualifying high-value cyber-fraud complaints. | No public app onboarding or reusable API contract established; this inter-agency integration does not authorize CivicLens. |
| eSakshya / ICJS | [Official platform](https://icjs.gov.in/esakshya/) | Platform advertises digital evidence capture/storage and an API bundle for integration. | No verified third-party citizen complaint intake endpoint, CivicLens authorization or public sandbox. Evidence management is distinct from creating a police complaint. |
| Other states/UTs | [Digital Police](https://digitalpolice.gov.in/) | National gateway links state police citizen services. | Per-state create/upload/status API contracts and onboarding have not been audited across all 36 states/UTs. Do not label these APIs unavailable or coverage complete. |

API Setu's live police search and Services filter were inspected in Chrome.
The older `delhipolicewu` catalogue URL displayed "No API Collection Found".
Catalogue search results include document issuance and unrelated services; a
police-named publisher does not establish complaint submission capability.

Some official pages timed out or returned empty bodies through the web connector.
Indexed official text was used where stated above. The Tamil Nadu and MP OpenAPI
documents were downloaded directly from the specification links in the live
catalogue and parsed locally. No government service operations were invoked.

## Tamil Nadu candidate contract

Published production server: `https://apigw.umangapp.in`.

- `POST /umang/apisetu/dept/tnapi/ws1/registration`
- `POST /umang/apisetu/dept/tnapi/ws1/complaintStatus`
- `POST /umang/apisetu/dept/tnapi/ws1/csrStatus`
- `POST /umang/apisetu/dept/tnapi/ws1/firStatus`
- Reference operations: `policeStation`, `district`, `subject`, `gender` under the
  same path prefix.

Registration uses `application/x-www-form-urlencoded`. Fields include
`district_code`, `compl_name`, `compl_dob`, `address`, `email_address`,
`subject_code`, `compl_description`, `occurrence_date`, `occurrence_place`,
`image`, `image_code`, latitude/longitude and UMANG/session/device fields.

Important gaps in the actual downloaded specification:

1. `image` and `image_code` are strings without descriptions, formats, size or
   count bounds. Their presence is **not proof of evidence photo upload**. The
   provider must confirm their purpose (including whether either concerns a
   challenge/security image), encoding, MIME types, maximum size, and any
   additional attachment endpoint. There is no documented five-image array or
   multipart file upload contract in this collection.
2. There is no schema-level required-fields list. Device fields include IMEI and
   IMSI; do not fabricate them or assume an iOS app can obtain them. Confirm
   supported omission/alternatives and the actual current authentication flow.
3. Occurrence date is typed as integer without a defined date format/unit; mobile
   IP address is typed as number. Resolve these with the provider, rather than
   inventing serialization rules.
4. Responses use an envelope `rs`, `rc`, `rd` and
   `pd.tnpolice.response[]` entries with `name`/`value`. The registration schema
   does not name a complaint reference field. HTTP 200 is insufficient proof of
   registration; acceptance and returned reference need documented semantics and
   test examples.
5. No submission idempotency or reconciliation contract was identified. A timeout
   after submission cannot safely trigger an automatic duplicate complaint.
6. The live [advertised Tamil Nadu sandbox](https://sandbox.api-setu.in/org-collections/tngov)
   displayed "Selected API Coming Soon in Sandbox" and stated the API is
   unavailable in that environment. No end-to-end sandbox test was possible.

These are limitations of the published document, not confirmed limitations of the
provider's latest authorized service.

## Access path

[API Setu's consumer overview](https://docs.apisetu.gov.in/document-central/explore-apisetu/Overview.html)
describes consumer registration, API subscription and publisher approval before
access. [Permitted use](https://docs.apisetu.gov.in/document-central/terms-of-use/Permitted%20Use%20and%20Access.html)
requires issued credentials and approved use cases. [The SOP page](https://apisetu.gov.in/sop)
links the onboarding procedure and subscription manual. A public OpenAPI download
does not grant production submission permission.

The Tamil Nadu collection advertises a
[subscription entry](https://consume.apisetu.gov.in/consumer/tngov).
Confirm Tesserix's legal entity eligibility and required organizational documents,
whether citizen-facing complaint submission by CivicLens is permitted, authorized
use of private complainant details, test access and support arrangements. No
organization account, approval or credential was created during this audit.

## Recommended first integration

Use Tamil Nadu as the first **candidate**, conditional on provider confirmation
and approved test access. Keep each other state's capabilities independent. Do
not generalize this API to India as a whole.

Before implementation, obtain a current provider contract covering:

- Authorized application identity, per-user login/OTP/consent and allowed legal
  identity fields. Google sign-in and a public nickname are not government identity
  authorization.
- Eligible incident types, district/station responsibility and location rules.
- Evidence upload and attachment semantics, including whether multiple originals
  are supported, whether uploads happen before/after registration, quotas and
  cleanup of unattached uploads. CivicLens's five-photo product limit cannot be
  assumed to be a provider limit.
- Official acknowledgement, status transitions, tracking access and distinction
  between complaint registration, CSR and FIR.
- Idempotency, timeouts, duplicate lookup/reconciliation, rate limits and an
  approved test environment with disposable test records.

Then test the authorized flow: user confirmation -> private evidence upload ->
complaint creation -> official reference -> status lookup. Exercise failed/partial
uploads, size/type rejection, expired authorization, duplicate taps, submission
timeout and account isolation. No real incident or production complaint is a QA
fixture. A mock passing does not establish government integration.

Crime evidence needs a separate privacy and retention design before app-side
collection: private originals with integrity hashes and access audit, scoped
download access, and reviewed redacted derivatives for any separate public use.
The current social photo pipeline re-encodes and strips metadata; do not describe
its output as an untouched evidentiary original. Private legal identity must stay
outside public reports/captions/client logs. Do not infer guilt or generate satire
for official crime complaints. Emergency access must bypass moderation and login.
Any deployed credentials must use separate civiclens-prefixed OpenBao paths by
environment. No live migration or rollout is authorized by this research.

## Local research receipt

Ignored originals and operation inventories are under
`artifacts/research/india-crime/`. No credentials were used or stored.

| Specification | Bytes | SHA-256 |
| --- | ---: | --- |
| `tnpolice.openapi.yaml` | 45,111 | `8b68d23b71100fce6fc61725a7036bc13eb8e6652b144d25d052cac13f8b0de5` |
| `mpecop.openapi.yaml` | 188,195 | `0fa4f5ace5e935c26d08c302da5f66d6fa0abd963e3df68116782abb1798bd18` |

The initial unintegrated help-screen draft and its tests are parked in the ignored
`wip/` subdirectory following the request to verify API feasibility first. They are
not in app routes, test discovery, exports or a release. No production-ready crime
feature or successful end-to-end government filing is claimed.
