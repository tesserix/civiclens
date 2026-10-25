# Assam crime reporting integration

[India tracker](../README.md) · Task **IN-18** · State ·
**35 administrative districts in the pinned LGD snapshot**.

Initial discovery recorded **25 October 2026**. Integration remains **unresolved**.
The state-level resolution checkbox is in the [India register](../README.md#state-and-union-territory-register).
Owner: **Unassigned**. Next source review: **23 January 2027**, or earlier on change.

## Official routes and initial finding

- [Official entry point or service directory](https://police.assam.gov.in/information-services)
- [Supporting official source](https://services.india.gov.in/service/detail/file-online-complaints-with-assam-police)
- [National state police gateway](https://digitalpolice.gov.in/)

Police information-services page lists Assam Police Seva Setu. National services directory lists an online complaint facility. General Sewa Setu service grievances are not automatically police complaints.

Source access check on 25 October 2026: Direct public page GET returned `HTTP Error 404: Not Found`. Indexed official-source discovery is retained; current browser/service verification remains open.

No citizen login, complaint submission, evidence upload or phone call was made.
A public page or indexed service description is discovery evidence, not proof of
a working government API or accepted complaint.

## API and evidence review

| Review field | Current finding |
| --- | --- |
| API discovery | Not verified. No externally usable complaint-create/upload contract established in the initial public-source discovery. |
| Published base URL and version | Not verified for a CivicLens complaint adapter. |
| Create complaint | No current authorized third-party endpoint verified. |
| Photo evidence | Not verified for police complaint intake. |
| Track complaint or FIR | Official portal/source leads are listed above; authorized API and returned reference semantics not verified. |
| Authentication and approval | Confirm organization/app eligibility, publisher approval, citizen identity/login/OTP/consent and service-specific requirements. No CivicLens credentials issued or access exercised. |
| Receipt and duplicate handling | Official acceptance fields, reference format, idempotency and timeout reconciliation not verified. |
| Test environment and quotas | Approved sandbox/test credentials, disposable test records, limits and provider escalation not verified. |
| District and station identifiers | Not mapped. LGD administrative identifiers below must not be used as provider police codes. |

Next action: **Follow the current official Seva Setu police complaint route and verify registration, media, acknowledgement and integrator access.**

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
| Bajali | 739 | [ ] | [ ] | Pending |
| Baksa | 616 | [ ] | [ ] | Pending |
| Barpeta | 280 | [ ] | [ ] | Pending |
| Biswanath | 705 | [ ] | [ ] | Pending |
| Bongaigaon | 281 | [ ] | [ ] | Pending |
| Cachar | 282 | [ ] | [ ] | Pending |
| Charaideo | 708 | [ ] | [ ] | Pending |
| Chirang | 612 | [ ] | [ ] | Pending |
| Darrang | 283 | [ ] | [ ] | Pending |
| Dhemaji | 284 | [ ] | [ ] | Pending |
| Dhubri | 285 | [ ] | [ ] | Pending |
| Dibrugarh | 286 | [ ] | [ ] | Pending |
| Dima Hasao | 299 | [ ] | [ ] | Pending |
| Goalpara | 287 | [ ] | [ ] | Pending |
| Golaghat | 288 | [ ] | [ ] | Pending |
| Hailakandi | 289 | [ ] | [ ] | Pending |
| Hojai | 709 | [ ] | [ ] | Pending |
| Jorhat | 290 | [ ] | [ ] | Pending |
| Kamrup | 291 | [ ] | [ ] | Pending |
| Kamrup Metro | 618 | [ ] | [ ] | Pending |
| Karbi Anglong | 292 | [ ] | [ ] | Pending |
| Kokrajhar | 294 | [ ] | [ ] | Pending |
| Lakhimpur | 295 | [ ] | [ ] | Pending |
| Majuli | 706 | [ ] | [ ] | Pending |
| Marigaon | 296 | [ ] | [ ] | Pending |
| Nagaon | 297 | [ ] | [ ] | Pending |
| Nalbari | 298 | [ ] | [ ] | Pending |
| Sivasagar | 300 | [ ] | [ ] | Pending |
| Sonitpur | 301 | [ ] | [ ] | Pending |
| South Salmara Mancachar | 707 | [ ] | [ ] | Pending |
| Sribhumi | 293 | [ ] | [ ] | Pending |
| Tamulpur | 756 | [ ] | [ ] | Pending |
| Tinsukia | 302 | [ ] | [ ] | Pending |
| Udalguri | 617 | [ ] | [ ] | Pending |
| West Karbi Anglong | 710 | [ ] | [ ] | Pending |

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
