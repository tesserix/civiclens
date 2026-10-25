# Rajasthan crime reporting integration

[India tracker](../README.md) · Task **IN-8** · State ·
**41 administrative districts in the pinned LGD snapshot**.

Initial discovery recorded **25 October 2026**. Integration remains **unresolved**.
The state-level resolution checkbox is in the [India register](../README.md#state-and-union-territory-register).
Owner: **Unassigned**. Next source review: **23 January 2027**, or earlier on change.

## Official routes and initial finding

- [Official entry point or service directory](https://police.rajasthan.gov.in/portal/CitizenServicesNew)
- [Supporting official source](https://police.rajasthan.gov.in/citizen/login.htm)
- [National state police gateway](https://digitalpolice.gov.in/)

Official police citizen services and CCTNS login located; service page refers to RajCop Citizen. The unrelated eBusiness Complaint/Create API is not evidence of a police filing API.

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
| Photo evidence | Not verified for the selected police complaint service. |
| Track complaint or FIR | Official portal/source leads are listed above; authorized API and returned reference semantics not verified. |
| Authentication and approval | Confirm organization/app eligibility, publisher approval, citizen identity/login/OTP/consent and service-specific requirements. No CivicLens credentials issued or access exercised. |
| Receipt and duplicate handling | Official acceptance fields, reference format, idempotency and timeout reconciliation not verified. |
| Test environment and quotas | Approved sandbox/test credentials, disposable test records, limits and provider escalation not verified. |
| District and station identifiers | Not mapped. LGD administrative identifiers below must not be used as provider police codes. |

Next action: **Obtain the RajCop/CCTNS crime complaint contract and reject unrelated generic complaint API matches.**

Use [the common API contract checklist](../README.md#api-details-required-for-every-state)
and [district closure rules](../README.md#district-work-and-closure). State
portal availability does not automatically establish each district's coverage.

## Excluded API search match

The discoverable
[eBusiness Complaint Create API](https://ebusinessapi.rajasthan.gov.in/Help/Api/POST-api-Complaint-Create)
has not been established as a police service. Do not use it as the Rajasthan
crime adapter merely because its path contains `Complaint/Create`.

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
| Ajmer | 86 | [ ] | [ ] | Pending |
| Alwar | 87 | [ ] | [ ] | Pending |
| Balotra | 775 | [ ] | [ ] | Pending |
| Banswara | 88 | [ ] | [ ] | Pending |
| Baran | 89 | [ ] | [ ] | Pending |
| Barmer | 90 | [ ] | [ ] | Pending |
| Beawar | 774 | [ ] | [ ] | Pending |
| Bharatpur | 91 | [ ] | [ ] | Pending |
| Bhilwara | 92 | [ ] | [ ] | Pending |
| Bikaner | 93 | [ ] | [ ] | Pending |
| Bundi | 94 | [ ] | [ ] | Pending |
| Chittorgarh | 95 | [ ] | [ ] | Pending |
| Churu | 96 | [ ] | [ ] | Pending |
| Dausa | 97 | [ ] | [ ] | Pending |
| Deeg | 767 | [ ] | [ ] | Pending |
| Dholpur | 98 | [ ] | [ ] | Pending |
| Didwana-Kuchaman | 768 | [ ] | [ ] | Pending |
| Dungarpur | 99 | [ ] | [ ] | Pending |
| Ganganagar | 100 | [ ] | [ ] | Pending |
| Hanumangarh | 101 | [ ] | [ ] | Pending |
| Jaipur | 102 | [ ] | [ ] | Pending |
| Jaisalmer | 103 | [ ] | [ ] | Pending |
| Jalore | 104 | [ ] | [ ] | Pending |
| Jhalawar | 105 | [ ] | [ ] | Pending |
| Jhunjhunu | 106 | [ ] | [ ] | Pending |
| Jodhpur | 107 | [ ] | [ ] | Pending |
| Karauli | 108 | [ ] | [ ] | Pending |
| Khairthal-Tijara | 770 | [ ] | [ ] | Pending |
| Kota | 109 | [ ] | [ ] | Pending |
| Kotputli-Behror | 782 | [ ] | [ ] | Pending |
| Nagaur | 110 | [ ] | [ ] | Pending |
| Pali | 111 | [ ] | [ ] | Pending |
| Phalodi | 772 | [ ] | [ ] | Pending |
| Pratapgarh | 629 | [ ] | [ ] | Pending |
| Rajsamand | 112 | [ ] | [ ] | Pending |
| Salumbar | 777 | [ ] | [ ] | Pending |
| Sawai Madhopur | 113 | [ ] | [ ] | Pending |
| Sikar | 114 | [ ] | [ ] | Pending |
| Sirohi | 115 | [ ] | [ ] | Pending |
| Tonk | 116 | [ ] | [ ] | Pending |
| Udaipur | 117 | [ ] | [ ] | Pending |

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
