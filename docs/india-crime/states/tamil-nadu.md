# Tamil Nadu crime reporting integration

[India tracker](../README.md) · Task **IN-33** · State ·
**38 administrative districts in the pinned LGD snapshot**.

Initial discovery recorded **25 October 2026**. Integration remains **unresolved**.
The state-level resolution checkbox is in the [India register](../README.md#state-and-union-territory-register).
Owner: **Unassigned**. Next source review: **23 January 2027**, or earlier on change.

## Official routes and initial finding

### Local gateway progress

- [x] Validate all 38 administrative district IDs/names/parents against the pinned LGD source.
- [x] Register the documented Tamil Nadu provider candidate with explicit blockers.
- [x] Implement the shared discovery/readiness and private request/status API.
- [x] Test authenticated access, cross-region rejection, ownership, retries and quotas locally.
- [ ] Obtain and verify actual police-district/station codes and their geographic coverage.
- [ ] Obtain approved access, usable test records and a complete photo/receipt contract.
- [ ] Complete authorized provider upload/create/reference/status testing and approved rollout.

See [the reusable API guide](../api.md). The district Mapping/Resolved boxes below
remain unchecked because administrative reference identity is not police routing.

- [Official entry point or service directory](https://directory.apisetu.gov.in/api-collection/tngov)
- [Supporting official source](https://informatics.nic.in/files/websites/april-2024/tn-police-citizen-app.php)
- [National state police gateway](https://digitalpolice.gov.in/)

First implementation candidate. Inspected official UMANG/API Setu OpenAPI documents complaint registration and complaint/CSR/FIR status plus reference lookups. Publisher approval and current service access remain pending.

Source access check on 25 October 2026: Direct public page GET returned HTTP 200. This establishes page access only; JavaScript/login/form behavior and filing were not exercised.

No citizen login, complaint submission, evidence upload or phone call was made.
A public page or indexed service description is discovery evidence, not proof of
a working government API or accepted complaint.

## API and evidence review

| Review field | Current finding |
| --- | --- |
| API discovery | Documented complaint-registration/status candidate; authorization and complete media/receipt contract pending. |
| Published base URL and version | `https://apigw.umangapp.in`; published OpenAPI 3.0, API version 1.0.0. Current production compatibility unverified. |
| Create complaint | `POST /umang/apisetu/dept/tnapi/ws1/registration`; `application/x-www-form-urlencoded`. Published candidate; no authorized request made. |
| Photo evidence | image/image_code are undocumented strings. Evidence-photo purpose, encoding, MIME/size/count limits and five-image support are not established. |
| Track complaint or FIR | `POST /umang/apisetu/dept/tnapi/ws1/complaintStatus`, `/csrStatus`, `/firStatus`; the latter two share the same path prefix. Reference/acceptance semantics still require provider confirmation. |
| Authentication and approval | Published `x-api-key` header plus UMANG/session fields. API Setu consumer/app/provider approval and current per-citizen identity/consent flow pending; no issued CivicLens access. |
| Receipt and duplicate handling | Official acceptance fields, reference format, idempotency and timeout reconciliation not verified. |
| Test environment and quotas | Advertised sandbox says selected API is unavailable/coming soon. Provider-approved test access and current quotas pending. |
| District and station identifiers | Not mapped. LGD administrative identifiers below must not be used as provider police codes. |

Next action: **Obtain provider-approved test access, clarify image fields, current required identity/device fields and official reference semantics, then implement the first approved district pilot.**

Use [the common API contract checklist](../README.md#api-details-required-for-every-state)
and [district closure rules](../README.md#district-work-and-closure). State
portal availability does not automatically establish each district's coverage.

## Tamil Nadu contract and first pilot

- [Official API collection](https://directory.apisetu.gov.in/api-collection/tngov)
- [Inspected OpenAPI specification](https://cf-media.api-setu.in/specfiles/1714048321_UMANG-TNPolice.yaml)
- [Advertised sandbox](https://sandbox.api-setu.in/org-collections/tngov)
- [Subscription entry](https://consume.apisetu.gov.in/consumer/tngov)
- [Detailed feasibility findings and hashes](../../authority-sources/india-crime-api-feasibility-2026-10-25.md)

District, station, subject and gender lookup operations are documented. Confirm
that all 38 LGD districts can be mapped to current provider police codes; do not
assume a district or commissionerate is represented by the same number.

### First pilot actions

- [ ] Confirm Tesserix legal-entity eligibility and permitted citizen-facing use.
- [ ] Obtain provider approval and usable non-production credentials/test records.
- [ ] Confirm what `image` and `image_code` actually represent; obtain actual
  evidence-upload encoding, endpoints, type/size/count limits and five-image support.
- [ ] Resolve missing required-fields rules, date serialization, IP/device fields,
  and iOS-compatible handling without fabricating IMEI/IMSI or citizen identity.
- [ ] Document official acceptance/reference fields and safe duplicate reconciliation.
- [ ] Select one district/police jurisdiction with verified station identifiers.
- [ ] Test consent -> evidence upload -> complaint create -> official reference ->
  status query in the approved test environment, including failures and isolation.
- [ ] Record iOS device QA and an approved rollout before expanding the pilot.

Pilot district: **Not selected**. Implementation owner: **Unassigned**.
Access request: **Not submitted**. No API call or real police record was created.

## State closure checklist

- [ ] Confirm police owner, service scope and current official documentation.
- [ ] Verify create, evidence and status contracts, or record an approved fallback.
- [ ] Establish provider/app authorization and citizen consent/identity requirements.
- [ ] Verify official acknowledgement and duplicate/timeout reconciliation.
- [ ] Map current police jurisdictions and provider codes for every district, or
  record an approved fallback/exclusion for each outstanding area.
- [ ] Complete authorized end-to-end and failure tests with synthetic evidence.
- [ ] Review private evidence storage, access audit, retention and deletion.
- [ ] Record approved deployment, iOS QA, supported scope and reviewer sign-off.

## District checklist

Names and LGD codes below are administrative reference identities, not police
provider codes. **All police mappings and district resolutions are pending.**
Follow the [district evidence rules](../README.md#district-work-and-closure) before
checking either box. Add police-district/commissionerate subrows where needed.

| Administrative district | LGD code | Mapping checked | Resolved | Evidence and disposition |
| --- | --- | --- | --- | --- |
| Ariyalur | 610 | [ ] | [ ] | Pending |
| Chengalpattu | 730 | [ ] | [ ] | Pending |
| Chennai | 568 | [ ] | [ ] | Pending |
| Coimbatore | 569 | [ ] | [ ] | Pending |
| Cuddalore | 570 | [ ] | [ ] | Pending |
| Dharmapuri | 571 | [ ] | [ ] | Pending |
| Dindigul | 572 | [ ] | [ ] | Pending |
| Erode | 573 | [ ] | [ ] | Pending |
| Kallakurichi | 729 | [ ] | [ ] | Pending |
| Kancheepuram | 574 | [ ] | [ ] | Pending |
| Kanniyakumari | 575 | [ ] | [ ] | Pending |
| Karur | 576 | [ ] | [ ] | Pending |
| Krishnagiri | 577 | [ ] | [ ] | Pending |
| Madurai | 578 | [ ] | [ ] | Pending |
| Mayiladuthurai | 735 | [ ] | [ ] | Pending |
| Nagapattinam | 579 | [ ] | [ ] | Pending |
| Namakkal | 580 | [ ] | [ ] | Pending |
| Perambalur | 581 | [ ] | [ ] | Pending |
| Pudukkottai | 582 | [ ] | [ ] | Pending |
| Ramanathapuram | 583 | [ ] | [ ] | Pending |
| Ranipet | 731 | [ ] | [ ] | Pending |
| Salem | 584 | [ ] | [ ] | Pending |
| Sivaganga | 585 | [ ] | [ ] | Pending |
| Tenkasi | 733 | [ ] | [ ] | Pending |
| Thanjavur | 586 | [ ] | [ ] | Pending |
| The Nilgiris | 587 | [ ] | [ ] | Pending |
| Theni | 588 | [ ] | [ ] | Pending |
| Thiruvallur | 589 | [ ] | [ ] | Pending |
| Thiruvarur | 590 | [ ] | [ ] | Pending |
| Thoothukkudi | 594 | [ ] | [ ] | Pending |
| Tiruchirappalli | 591 | [ ] | [ ] | Pending |
| Tirunelveli | 592 | [ ] | [ ] | Pending |
| Tirupathur | 732 | [ ] | [ ] | Pending |
| Tiruppur | 634 | [ ] | [ ] | Pending |
| Tiruvannamalai | 593 | [ ] | [ ] | Pending |
| Vellore | 595 | [ ] | [ ] | Pending |
| Viluppuram | 596 | [ ] | [ ] | Pending |
| Virudhunagar | 597 | [ ] | [ ] | Pending |

## Resolution record

- Delivery mode and supported incident classes: **Pending**
- Provider contract/version and authorization evidence: **Pending**
- District dispositions and police-unit coverage evidence: **Pending**
- Test/QA issue and sanitized evidence: **Pending**
- Deployment and iOS verification: **Pending**
- Accepted exceptions and follow-up issues: **Pending**
- Reviewer and approval date: **Pending**
- Next review date: **Pending final sign-off**

Keep private complainant data, credentials, photos and real complaint references
out of this record. Mark the India-register checkbox only after the
[state resolution criteria](../README.md#state-resolution-criteria) are met.
