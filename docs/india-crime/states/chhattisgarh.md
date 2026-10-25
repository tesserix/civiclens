# Chhattisgarh crime reporting integration

[India tracker](../README.md) · Task **IN-22** · State ·
**33 administrative districts in the pinned LGD snapshot**.

Initial discovery recorded **25 October 2026**. Integration remains **unresolved**.
The state-level resolution checkbox is in the [India register](../README.md#state-and-union-territory-register).
Owner: **Unassigned**. Next source review: **23 January 2027**, or earlier on change.

## Official routes and initial finding

- [Official entry point or service directory](https://citizen.cgpolice.gov.in/citizen/login.htm)
- [Supporting official source](https://digitaldwaar.cgstate.gov.in/faq)
- [National state police gateway](https://digitalpolice.gov.in/)

CCTNS citizen portal advertises online complaints and case/FIR status. CHiPS Digital Dwaar describes approval-based API consumption for departments; this is a discovery lead, not an identified police complaint API.

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

Next action: **Ask the police CCTNS owner whether a complaint/evidence API is published through CHiPS and whether CivicLens is eligible.**

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
| Balod | 646 | [ ] | [ ] | Pending |
| Balodabazar-Bhatapara | 644 | [ ] | [ ] | Pending |
| Balrampur-Ramanujganj | 649 | [ ] | [ ] | Pending |
| Bastar | 374 | [ ] | [ ] | Pending |
| Bemetara | 650 | [ ] | [ ] | Pending |
| Bijapur | 636 | [ ] | [ ] | Pending |
| Bilaspur | 375 | [ ] | [ ] | Pending |
| Dakshin Bastar Dantewada | 376 | [ ] | [ ] | Pending |
| Dhamtari | 377 | [ ] | [ ] | Pending |
| Durg | 378 | [ ] | [ ] | Pending |
| Gariyaband | 645 | [ ] | [ ] | Pending |
| Gaurela-Pendra-Marwahi | 734 | [ ] | [ ] | Pending |
| Janjgir-Champa | 379 | [ ] | [ ] | Pending |
| Jashpur | 380 | [ ] | [ ] | Pending |
| Kabeerdham | 382 | [ ] | [ ] | Pending |
| Khairagarh-Chhuikhadan-Gandai | 759 | [ ] | [ ] | Pending |
| Kondagaon | 643 | [ ] | [ ] | Pending |
| Korba | 383 | [ ] | [ ] | Pending |
| Korea | 384 | [ ] | [ ] | Pending |
| Mahasamund | 385 | [ ] | [ ] | Pending |
| Manendragarh-Chirmiri-Bharatpur(M C B) | 760 | [ ] | [ ] | Pending |
| Mohla-Manpur-Ambagarh Chouki | 761 | [ ] | [ ] | Pending |
| Mungeli | 647 | [ ] | [ ] | Pending |
| Narayanpur | 637 | [ ] | [ ] | Pending |
| Raigarh | 386 | [ ] | [ ] | Pending |
| Raipur | 387 | [ ] | [ ] | Pending |
| Rajnandgaon | 388 | [ ] | [ ] | Pending |
| Sakti | 762 | [ ] | [ ] | Pending |
| Sarangarh-Bilaigarh | 763 | [ ] | [ ] | Pending |
| Sukma | 642 | [ ] | [ ] | Pending |
| Surajpur | 648 | [ ] | [ ] | Pending |
| Surguja | 389 | [ ] | [ ] | Pending |
| Uttar Bastar Kanker | 381 | [ ] | [ ] | Pending |

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
