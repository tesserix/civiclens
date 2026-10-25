# Mizoram crime reporting integration

[India tracker](../README.md) · Task **IN-15** · State ·
**11 administrative districts in the pinned LGD snapshot**.

Initial discovery recorded **25 October 2026**. Integration remains **unresolved**.
The state-level resolution checkbox is in the [India register](../README.md#state-and-union-territory-register).
Owner: **Unassigned**. Next source review: **23 January 2027**, or earlier on change.

## Official routes and initial finding

- [Official entry point or service directory](https://police.mizoram.gov.in/)
- [Supporting official source](https://police.mizoram.gov.in/page/contact-numbers-of-police-stations-and-outposts)
- [National state police gateway](https://digitalpolice.gov.in/)

Official police homepage links a CCTNS Citizen Portal. Its linked URL uses HTTP; current secure complaint intake and API behavior remain unverified.

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
| Photo evidence | Not verified for complaint intake. |
| Track complaint or FIR | Official portal/source leads are listed above; authorized API and returned reference semantics not verified. |
| Authentication and approval | Confirm organization/app eligibility, publisher approval, citizen identity/login/OTP/consent and service-specific requirements. No CivicLens credentials issued or access exercised. |
| Receipt and duplicate handling | Official acceptance fields, reference format, idempotency and timeout reconciliation not verified. |
| Test environment and quotas | Approved sandbox/test credentials, disposable test records, limits and provider escalation not verified. |
| District and station identifiers | Not mapped. LGD administrative identifiers below must not be used as provider police codes. |

Next action: **Verify a current HTTPS CCTNS citizen endpoint, complaint scope and district coverage with SCRB. Do not enter private evidence or credentials over the linked HTTP address.**

Use [the common API contract checklist](../README.md#api-details-required-for-every-state)
and [district closure rules](../README.md#district-work-and-closure). State
portal availability does not automatically establish each district's coverage.

## Citizen portal source lead

The official police homepage's CCTNS link is
`http://www.cctns.mizoram.gov.in/`. This is a discovered link, not a verified
secure filing route. Confirm the current HTTPS service with the police technical
owner before collecting or transmitting credentials, identity or evidence.

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
| Aizawl | 261 | [ ] | [ ] | Pending |
| Champhai | 262 | [ ] | [ ] | Pending |
| Hnahthial | 726 | [ ] | [ ] | Pending |
| Khawzawl | 728 | [ ] | [ ] | Pending |
| Kolasib | 263 | [ ] | [ ] | Pending |
| Lawngtlai | 264 | [ ] | [ ] | Pending |
| Lunglei | 265 | [ ] | [ ] | Pending |
| Mamit | 266 | [ ] | [ ] | Pending |
| Saitual | 727 | [ ] | [ ] | Pending |
| Serchhip | 268 | [ ] | [ ] | Pending |
| Siaha | 267 | [ ] | [ ] | Pending |

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
