# Jharkhand crime reporting integration

[India tracker](../README.md) · Task **IN-20** · State ·
**24 administrative districts in the pinned LGD snapshot**.

Initial discovery recorded **25 October 2026**. Integration remains **unresolved**.
The state-level resolution checkbox is in the [India register](../README.md#state-and-union-territory-register).
Owner: **Unassigned**. Next source review: **23 January 2027**, or earlier on change.

## Official routes and initial finding

- [Official entry point or service directory](https://citizen.jhpolice.gov.in/)
- [Supporting official source](https://www.jharkhand.gov.in/Home/G2P)
- [National state police gateway](https://digitalpolice.gov.in/)

Government links identify Jharkhand police citizen services and an Online FIR/Complaint Management System. Verify the currently active flow rather than assuming both historical endpoints remain usable.

Source access check on 25 October 2026: Direct public page GET was inconclusive from this workstation (connection, TLS or timeout failure). Indexed official-source discovery is retained; current browser/service verification remains open. Do not interpret this as a nationwide outage.

No citizen login, complaint submission, evidence upload or phone call was made.
A public page or indexed service description is discovery evidence, not proof of
a working government API or accepted complaint.

## API and evidence review

| Review field | Current finding |
| --- | --- |
| API discovery | Not verified. No externally usable complaint-create/upload contract established in the initial public-source discovery. |
| Published base URL and version | Not verified for a CivicLens complaint adapter. |
| Create complaint | No current authorized third-party endpoint verified. |
| Photo evidence | Not verified for complaint intake. |
| Track complaint or FIR | Official portal/source leads are listed above; authorized API and returned reference semantics not verified. |
| Authentication and approval | Confirm organization/app eligibility, publisher approval, citizen identity/login/OTP/consent and service-specific requirements. No CivicLens credentials issued or access exercised. |
| Receipt and duplicate handling | Official acceptance fields, reference format, idempotency and timeout reconciliation not verified. |
| Test environment and quotas | Approved sandbox/test credentials, disposable test records, limits and provider escalation not verified. |
| District and station identifiers | Not mapped. LGD administrative identifiers below must not be used as provider police codes. |

Next action: **Confirm the active citizen/JOFs service, supported complaint types and external create/upload/status contracts.**

Use [the common API contract checklist](../README.md#api-details-required-for-every-state)
and [district closure rules](../README.md#district-work-and-closure). State
portal availability does not automatically establish each district's coverage.

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
| Bokaro | 322 | [ ] | [ ] | Pending |
| Chatra | 323 | [ ] | [ ] | Pending |
| Deoghar | 324 | [ ] | [ ] | Pending |
| Dhanbad | 325 | [ ] | [ ] | Pending |
| Dumka | 326 | [ ] | [ ] | Pending |
| East Singhbum | 327 | [ ] | [ ] | Pending |
| Garhwa | 328 | [ ] | [ ] | Pending |
| Giridih | 329 | [ ] | [ ] | Pending |
| Godda | 330 | [ ] | [ ] | Pending |
| Gumla | 331 | [ ] | [ ] | Pending |
| Hazaribagh | 332 | [ ] | [ ] | Pending |
| Jamtara | 333 | [ ] | [ ] | Pending |
| Khunti | 606 | [ ] | [ ] | Pending |
| Koderma | 334 | [ ] | [ ] | Pending |
| Latehar | 335 | [ ] | [ ] | Pending |
| Lohardaga | 336 | [ ] | [ ] | Pending |
| Pakur | 337 | [ ] | [ ] | Pending |
| Palamu | 338 | [ ] | [ ] | Pending |
| Ramgarh | 607 | [ ] | [ ] | Pending |
| Ranchi | 339 | [ ] | [ ] | Pending |
| Sahebganj | 340 | [ ] | [ ] | Pending |
| Saraikela Kharsawan | 341 | [ ] | [ ] | Pending |
| Simdega | 342 | [ ] | [ ] | Pending |
| West Singhbhum | 343 | [ ] | [ ] | Pending |

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
