# Delhi crime reporting integration

[India tracker](../README.md) · Task **IN-7** · UT ·
**13 administrative districts in the pinned LGD snapshot**.

Initial discovery recorded **25 October 2026**. Integration remains **unresolved**.
The state-level resolution checkbox is in the [India register](../README.md#state-and-union-territory-register).
Owner: **Unassigned**. Next source review: **23 January 2027**, or earlier on change.

## Official routes and initial finding

- [Official entry point or service directory](https://delhipolice.mha.gov.in/citizen-services.html)
- [Supporting official source](https://informatics.nic.in/news/1535)
- [National state police gateway](https://digitalpolice.gov.in/)

Delhi Police citizen services located. NIC documents an I4C/NCRP-to-Delhi-Police eFIR integration for qualifying high-value cyber fraud; it is not evidence of CivicLens access or a general public complaint API.

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
| Photo evidence | Citizen-service and complaint-specific upload contracts need review; no reusable public upload API verified. |
| Track complaint or FIR | Official portal/source leads are listed above; authorized API and returned reference semantics not verified. |
| Authentication and approval | Confirm organization/app eligibility, publisher approval, citizen identity/login/OTP/consent and service-specific requirements. No CivicLens credentials issued or access exercised. |
| Receipt and duplicate handling | Official acceptance fields, reference format, idempotency and timeout reconciliation not verified. |
| Test environment and quotas | Approved sandbox/test credentials, disposable test records, limits and provider escalation not verified. |
| District and station identifiers | Not mapped. LGD administrative identifiers below must not be used as provider police codes. |

Next action: **Separate ICMS, theft/lost-property, traffic and cybercrime services, and request approved integrator contracts for the selected scope.**

Use [the common API contract checklist](../README.md#api-details-required-for-every-state)
and [district closure rules](../README.md#district-work-and-closure). State
portal availability does not automatically establish each district's coverage.

## Inter-agency integration lead

[NIC's Delhi integration report](https://informatics.nic.in/news/1535) describes
an NCRP-to-Delhi-Police eFIR flow for qualifying high-value cyber-fraud complaints.
It does not publish an authorized general citizen-app contract for CivicLens.
Keep this separate from ICMS, theft, traffic and lost-property services.

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
| Central | 77 | [ ] | [ ] | Pending |
| Central North | 796 | [ ] | [ ] | Pending |
| East | 78 | [ ] | [ ] | Pending |
| New Delhi | 79 | [ ] | [ ] | Pending |
| North | 80 | [ ] | [ ] | Pending |
| North East | 81 | [ ] | [ ] | Pending |
| North West | 82 | [ ] | [ ] | Pending |
| Old Delhi | 795 | [ ] | [ ] | Pending |
| Outer North | 794 | [ ] | [ ] | Pending |
| South | 83 | [ ] | [ ] | Pending |
| South East | 670 | [ ] | [ ] | Pending |
| South West | 84 | [ ] | [ ] | Pending |
| West | 85 | [ ] | [ ] | Pending |

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
