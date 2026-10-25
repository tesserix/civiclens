# Bihar crime reporting integration

[India tracker](../README.md) · Task **IN-10** · State ·
**38 administrative districts in the pinned LGD snapshot**.

Initial discovery recorded **25 October 2026**. Integration remains **unresolved**.
The state-level resolution checkbox is in the [India register](../README.md#state-and-union-territory-register).
Owner: **Unassigned**. Next source review: **23 January 2027**, or earlier on change.

## Official routes and initial finding

- [Official entry point or service directory](https://police.bihar.gov.in/services)
- [Supporting official source](https://scrb.bihar.gov.in/FIRiew.aspx)
- [National state police gateway](https://digitalpolice.gov.in/)

Police services landing page and SCRB FIR-view service located. Public services content needs corroboration with SCRB/CCTNS before enabling a complaint connector; FIR lookup is not complaint creation.

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

Next action: **Obtain the current authenticated SCRB/CCTNS complaint route and confirm supported incident types and submission API.**

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
| Araria | 188 | [ ] | [ ] | Pending |
| Arwal | 611 | [ ] | [ ] | Pending |
| Aurangabad | 189 | [ ] | [ ] | Pending |
| Banka | 190 | [ ] | [ ] | Pending |
| Begusarai | 191 | [ ] | [ ] | Pending |
| Bhagalpur | 192 | [ ] | [ ] | Pending |
| Bhojpur | 193 | [ ] | [ ] | Pending |
| Buxar | 194 | [ ] | [ ] | Pending |
| Darbhanga | 195 | [ ] | [ ] | Pending |
| Gaya | 196 | [ ] | [ ] | Pending |
| Gopalganj | 197 | [ ] | [ ] | Pending |
| Jamui | 198 | [ ] | [ ] | Pending |
| Jehanabad | 199 | [ ] | [ ] | Pending |
| Kaimur (Bhabua) | 200 | [ ] | [ ] | Pending |
| Katihar | 201 | [ ] | [ ] | Pending |
| Khagaria | 202 | [ ] | [ ] | Pending |
| Kishanganj | 203 | [ ] | [ ] | Pending |
| Lakhisarai | 204 | [ ] | [ ] | Pending |
| Madhepura | 205 | [ ] | [ ] | Pending |
| Madhubani | 206 | [ ] | [ ] | Pending |
| Munger | 207 | [ ] | [ ] | Pending |
| Muzaffarpur | 208 | [ ] | [ ] | Pending |
| Nalanda | 209 | [ ] | [ ] | Pending |
| Nawada | 210 | [ ] | [ ] | Pending |
| Pashchim Champaran | 211 | [ ] | [ ] | Pending |
| Patna | 212 | [ ] | [ ] | Pending |
| Purbi Champaran | 213 | [ ] | [ ] | Pending |
| Purnia | 214 | [ ] | [ ] | Pending |
| Rohtas | 215 | [ ] | [ ] | Pending |
| Saharsa | 216 | [ ] | [ ] | Pending |
| Samastipur | 217 | [ ] | [ ] | Pending |
| Saran | 218 | [ ] | [ ] | Pending |
| Sheikhpura | 219 | [ ] | [ ] | Pending |
| Sheohar | 220 | [ ] | [ ] | Pending |
| Sitamarhi | 221 | [ ] | [ ] | Pending |
| Siwan | 222 | [ ] | [ ] | Pending |
| Supaul | 223 | [ ] | [ ] | Pending |
| Vaishali | 224 | [ ] | [ ] | Pending |

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
