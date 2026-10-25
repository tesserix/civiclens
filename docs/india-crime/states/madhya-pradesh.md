# Madhya Pradesh crime reporting integration

[India tracker](../README.md) · Task **IN-23** · State ·
**55 administrative districts in the pinned LGD snapshot**.

Initial discovery recorded **25 October 2026**. Integration remains **unresolved**.
The state-level resolution checkbox is in the [India register](../README.md#state-and-union-territory-register).
Owner: **Unassigned**. Next source review: **23 January 2027**, or earlier on change.

## Official routes and initial finding

- [Official entry point or service directory](https://indore.mppolice.gov.in/complaint-lodging/)
- [Supporting official source](https://directory.apisetu.gov.in/api-collection/mppolice)
- [National state police gateway](https://digitalpolice.gov.in/)

CCTNS complaint lodging requires citizen registration. The inspected UMANG MPeCop OpenAPI has 37 lookup/authentication operations, without complaint creation or an evidence-upload operation in that published version.

Source access check on 25 October 2026: Direct public page GET returned HTTP 200. This establishes page access only; JavaScript/login/form behavior and filing were not exercised.

No citizen login, complaint submission, evidence upload or phone call was made.
A public page or indexed service description is discovery evidence, not proof of
a working government API or accepted complaint.

## API and evidence review

| Review field | Current finding |
| --- | --- |
| API discovery | Documented lookup/authentication API; complaint create/upload not verified. |
| Published base URL and version | `https://apigw.umangapp.in`; inspected MPeCop OpenAPI 3.0, version 1.0.0. |
| Create complaint | Not present in the inspected 37-operation MPeCop contract; obtain a separate CCTNS/eFIR contract. |
| Photo evidence | No upload operation identified in inspected MPeCop specification; the separate citizen complaint service needs review. |
| Track complaint or FIR | Official portal/source leads are listed above; authorized API and returned reference semantics not verified. |
| Authentication and approval | Published MPeCop contract defines `x-api-key`, UMANG/authorization fields and vendor-token operation. Issued app access and complaint integration approval not established. |
| Receipt and duplicate handling | Official acceptance fields, reference format, idempotency and timeout reconciliation not verified. |
| Test environment and quotas | Approved sandbox/test credentials, disposable test records, limits and provider escalation not verified. |
| District and station identifiers | Not mapped. LGD administrative identifiers below must not be used as provider police codes. |

Next action: **Request the separate CCTNS/eFIR submission contract; do not use MPeCop lookup endpoints as a create connector.**

Use [the common API contract checklist](../README.md#api-details-required-for-every-state)
and [district closure rules](../README.md#district-work-and-closure). State
portal availability does not automatically establish each district's coverage.

## Published MPeCop API scope

[Official collection](https://directory.apisetu.gov.in/api-collection/mppolice) and
[inspected specification](https://cf-media.api-setu.in/specfiles/1681369249_UMANG-MPeCop.yaml).
The published 37 operations include login/profile, district/station/contact and
missing-person/vehicle/unidentified-body lookups. All being POST operations does
not make them complaint-create APIs. No evidence-upload operation was identified
in that version. Obtain a distinct current complaint/eFIR contract from SCRB; do
not infer that the separate citizen portal lacks an API.

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
| Agar-Malwa | 667 | [ ] | [ ] | Pending |
| Alirajpur | 639 | [ ] | [ ] | Pending |
| Anuppur | 390 | [ ] | [ ] | Pending |
| Ashoknagar | 391 | [ ] | [ ] | Pending |
| Balaghat | 392 | [ ] | [ ] | Pending |
| Barwani | 393 | [ ] | [ ] | Pending |
| Betul | 394 | [ ] | [ ] | Pending |
| Bhind | 395 | [ ] | [ ] | Pending |
| Bhopal | 396 | [ ] | [ ] | Pending |
| Burhanpur | 397 | [ ] | [ ] | Pending |
| Chhatarpur | 398 | [ ] | [ ] | Pending |
| Chhindwara | 399 | [ ] | [ ] | Pending |
| Damoh | 400 | [ ] | [ ] | Pending |
| Datia | 401 | [ ] | [ ] | Pending |
| Dewas | 402 | [ ] | [ ] | Pending |
| Dhar | 403 | [ ] | [ ] | Pending |
| Dindori | 404 | [ ] | [ ] | Pending |
| Guna | 406 | [ ] | [ ] | Pending |
| Gwalior | 407 | [ ] | [ ] | Pending |
| Harda | 408 | [ ] | [ ] | Pending |
| Indore | 410 | [ ] | [ ] | Pending |
| Jabalpur | 411 | [ ] | [ ] | Pending |
| Jhabua | 412 | [ ] | [ ] | Pending |
| Katni | 413 | [ ] | [ ] | Pending |
| Khandwa (East Nimar) | 405 | [ ] | [ ] | Pending |
| Khargone (West Nimar) | 414 | [ ] | [ ] | Pending |
| MAUGANJ | 766 | [ ] | [ ] | Pending |
| Maihar | 784 | [ ] | [ ] | Pending |
| Mandla | 415 | [ ] | [ ] | Pending |
| Mandsaur | 416 | [ ] | [ ] | Pending |
| Morena | 417 | [ ] | [ ] | Pending |
| Narmadapuram | 409 | [ ] | [ ] | Pending |
| Narsimhapur | 418 | [ ] | [ ] | Pending |
| Neemuch | 419 | [ ] | [ ] | Pending |
| Niwari | 722 | [ ] | [ ] | Pending |
| Pandhurna | 785 | [ ] | [ ] | Pending |
| Panna | 420 | [ ] | [ ] | Pending |
| Raisen | 421 | [ ] | [ ] | Pending |
| Rajgarh | 422 | [ ] | [ ] | Pending |
| Ratlam | 423 | [ ] | [ ] | Pending |
| Rewa | 424 | [ ] | [ ] | Pending |
| Sagar | 425 | [ ] | [ ] | Pending |
| Satna | 426 | [ ] | [ ] | Pending |
| Sehore | 427 | [ ] | [ ] | Pending |
| Seoni | 428 | [ ] | [ ] | Pending |
| Shahdol | 429 | [ ] | [ ] | Pending |
| Shajapur | 430 | [ ] | [ ] | Pending |
| Sheopur | 431 | [ ] | [ ] | Pending |
| Shivpuri | 432 | [ ] | [ ] | Pending |
| Sidhi | 433 | [ ] | [ ] | Pending |
| Singrauli | 638 | [ ] | [ ] | Pending |
| Tikamgarh | 434 | [ ] | [ ] | Pending |
| Ujjain | 435 | [ ] | [ ] | Pending |
| Umaria | 436 | [ ] | [ ] | Pending |
| Vidisha | 437 | [ ] | [ ] | Pending |

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
