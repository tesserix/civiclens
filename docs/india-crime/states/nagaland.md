# Nagaland crime reporting integration

[India tracker](../README.md) · Task **IN-13** · State ·
**17 administrative districts in the pinned LGD snapshot**.

Initial discovery recorded **25 October 2026**. Integration remains **unresolved**.
The state-level resolution checkbox is in the [India register](../README.md#state-and-union-territory-register).
Owner: **Unassigned**. Next source review: **23 January 2027**, or earlier on change.

## Official routes and initial finding

- [Official entry point or service directory](https://cp.police.nagaland.gov.in/)
- [Supporting official source](https://ipr.nagaland.gov.in/index.php/dgp-launches-e-challan-e-suraksha-for-traffic)
- [National state police gateway](https://digitalpolice.gov.in/)

Police CCTNS citizen portal advertises requests and tracking. A recent official e-Suraksha announcement describes complaints through app/portal; verify any transition and actual service scope.

Source access check on 25 October 2026: Direct public page GET returned HTTP 200. This establishes page access only; JavaScript/login/form behavior and filing were not exercised.

No citizen login, complaint submission, evidence upload or phone call was made.
A public page or indexed service description is discovery evidence, not proof of
a working government API or accepted complaint.

## API and evidence review

| Review field | Current finding |
| --- | --- |
| API discovery | Not verified. No externally usable complaint-create/upload contract established in the initial public-source discovery. |
| Published base URL and version | Not verified for a CivicLens complaint adapter. |
| Create complaint | No current authorized third-party endpoint verified. |
| Photo evidence | Citizen Tips form offers document upload; do not assume the same limits/semantics apply to formal complaints. |
| Track complaint or FIR | Official portal/source leads are listed above; authorized API and returned reference semantics not verified. |
| Authentication and approval | Confirm organization/app eligibility, publisher approval, citizen identity/login/OTP/consent and service-specific requirements. No CivicLens credentials issued or access exercised. |
| Receipt and duplicate handling | Official acceptance fields, reference format, idempotency and timeout reconciliation not verified. |
| Test environment and quotas | Approved sandbox/test credentials, disposable test records, limits and provider escalation not verified. |
| District and station identifiers | Not mapped. LGD administrative identifiers below must not be used as provider police codes. |

Next action: **Confirm current e-Suraksha/CCTNS intake ownership, supported offices, evidence rules and external API.**

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
| Chumoukedima | 758 | [ ] | [ ] | Pending |
| Dimapur | 244 | [ ] | [ ] | Pending |
| Kiphire | 614 | [ ] | [ ] | Pending |
| Kohima | 245 | [ ] | [ ] | Pending |
| Longleng | 615 | [ ] | [ ] | Pending |
| Meluri | 788 | [ ] | [ ] | Pending |
| Mokokchung | 246 | [ ] | [ ] | Pending |
| Mon | 247 | [ ] | [ ] | Pending |
| Niuland | 764 | [ ] | [ ] | Pending |
| Noklak | 736 | [ ] | [ ] | Pending |
| Peren | 613 | [ ] | [ ] | Pending |
| Phek | 248 | [ ] | [ ] | Pending |
| Shamator | 765 | [ ] | [ ] | Pending |
| Tseminyu | 757 | [ ] | [ ] | Pending |
| Tuensang | 249 | [ ] | [ ] | Pending |
| Wokha | 250 | [ ] | [ ] | Pending |
| Zunheboto | 251 | [ ] | [ ] | Pending |

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
