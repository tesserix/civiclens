# Uttar Pradesh crime reporting integration

[India tracker](../README.md) · Task **IN-9** · State ·
**75 administrative districts in the pinned LGD snapshot**.

Initial discovery recorded **25 October 2026**. Integration remains **unresolved**.
The state-level resolution checkbox is in the [India register](../README.md#state-and-union-territory-register).
Owner: **Unassigned**. Next source review: **23 January 2027**, or earlier on change.

## Official routes and initial finding

- [Official entry point or service directory](https://uppolice.gov.in/article/en/citizen-services)
- [Supporting official source](https://uppolice.gov.in/article/en/instruction-for-downloading-complaints)
- [National state police gateway](https://digitalpolice.gov.in/)

Police citizen services list complaint registration. Official staff guidance describes text/image/video complaints and action reports; it does not document public third-party create/upload APIs.

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
| Photo evidence | Image/video complaints described in police workflow; current citizen attachment limits and API are not verified. |
| Track complaint or FIR | Official portal/source leads are listed above; authorized API and returned reference semantics not verified. |
| Authentication and approval | Confirm organization/app eligibility, publisher approval, citizen identity/login/OTP/consent and service-specific requirements. No CivicLens credentials issued or access exercised. |
| Receipt and duplicate handling | Official acceptance fields, reference format, idempotency and timeout reconciliation not verified. |
| Test environment and quotas | Approved sandbox/test credentials, disposable test records, limits and provider escalation not verified. |
| District and station identifiers | Not mapped. LGD administrative identifiers below must not be used as provider police codes. |

Next action: **Verify current CCTNS/UPCOP complaint workflow and partner contract; distinguish police complaints from Jansunwai administrative escalation.**

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
| Agra | 118 | [ ] | [ ] | Pending |
| Aligarh | 119 | [ ] | [ ] | Pending |
| Ambedkar Nagar | 121 | [ ] | [ ] | Pending |
| Amethi | 640 | [ ] | [ ] | Pending |
| Amroha | 154 | [ ] | [ ] | Pending |
| Auraiya | 122 | [ ] | [ ] | Pending |
| Ayodhya | 140 | [ ] | [ ] | Pending |
| Azamgarh | 123 | [ ] | [ ] | Pending |
| Baghpat | 124 | [ ] | [ ] | Pending |
| Bahraich | 125 | [ ] | [ ] | Pending |
| Ballia | 126 | [ ] | [ ] | Pending |
| Balrampur | 127 | [ ] | [ ] | Pending |
| Banda | 128 | [ ] | [ ] | Pending |
| Bara Banki | 129 | [ ] | [ ] | Pending |
| Bareilly | 130 | [ ] | [ ] | Pending |
| Basti | 131 | [ ] | [ ] | Pending |
| Bhadohi | 179 | [ ] | [ ] | Pending |
| Bijnor | 132 | [ ] | [ ] | Pending |
| Budaun | 133 | [ ] | [ ] | Pending |
| Bulandshahr | 134 | [ ] | [ ] | Pending |
| Chandauli | 135 | [ ] | [ ] | Pending |
| Chitrakoot | 136 | [ ] | [ ] | Pending |
| Deoria | 137 | [ ] | [ ] | Pending |
| Etah | 138 | [ ] | [ ] | Pending |
| Etawah | 139 | [ ] | [ ] | Pending |
| Farrukhabad | 141 | [ ] | [ ] | Pending |
| Fatehpur | 142 | [ ] | [ ] | Pending |
| Firozabad | 143 | [ ] | [ ] | Pending |
| Gautam Buddha Nagar | 144 | [ ] | [ ] | Pending |
| Ghaziabad | 145 | [ ] | [ ] | Pending |
| Ghazipur | 146 | [ ] | [ ] | Pending |
| Gonda | 147 | [ ] | [ ] | Pending |
| Gorakhpur | 148 | [ ] | [ ] | Pending |
| Hamirpur | 149 | [ ] | [ ] | Pending |
| Hapur | 661 | [ ] | [ ] | Pending |
| Hardoi | 150 | [ ] | [ ] | Pending |
| Hathras | 163 | [ ] | [ ] | Pending |
| Jalaun | 151 | [ ] | [ ] | Pending |
| Jaunpur | 152 | [ ] | [ ] | Pending |
| Jhansi | 153 | [ ] | [ ] | Pending |
| Kannauj | 155 | [ ] | [ ] | Pending |
| Kanpur Dehat | 156 | [ ] | [ ] | Pending |
| Kanpur Nagar | 157 | [ ] | [ ] | Pending |
| Kasganj | 633 | [ ] | [ ] | Pending |
| Kaushambi | 158 | [ ] | [ ] | Pending |
| Kheri | 159 | [ ] | [ ] | Pending |
| Kushinagar | 160 | [ ] | [ ] | Pending |
| Lalitpur | 161 | [ ] | [ ] | Pending |
| Lucknow | 162 | [ ] | [ ] | Pending |
| Mahoba | 165 | [ ] | [ ] | Pending |
| Mahrajganj | 164 | [ ] | [ ] | Pending |
| Mainpuri | 166 | [ ] | [ ] | Pending |
| Mathura | 167 | [ ] | [ ] | Pending |
| Mau | 168 | [ ] | [ ] | Pending |
| Meerut | 169 | [ ] | [ ] | Pending |
| Mirzapur | 170 | [ ] | [ ] | Pending |
| Moradabad | 171 | [ ] | [ ] | Pending |
| Muzaffarnagar | 172 | [ ] | [ ] | Pending |
| Pilibhit | 173 | [ ] | [ ] | Pending |
| Pratapgarh | 174 | [ ] | [ ] | Pending |
| Prayagraj | 120 | [ ] | [ ] | Pending |
| Rae Bareli | 175 | [ ] | [ ] | Pending |
| Rampur | 176 | [ ] | [ ] | Pending |
| Saharanpur | 177 | [ ] | [ ] | Pending |
| Sambhal | 659 | [ ] | [ ] | Pending |
| Sant Kabir Nagar | 178 | [ ] | [ ] | Pending |
| Shahjahanpur | 180 | [ ] | [ ] | Pending |
| Shamli | 660 | [ ] | [ ] | Pending |
| Shrawasti | 181 | [ ] | [ ] | Pending |
| Siddharthnagar | 182 | [ ] | [ ] | Pending |
| Sitapur | 183 | [ ] | [ ] | Pending |
| Sonbhadra | 184 | [ ] | [ ] | Pending |
| Sultanpur | 185 | [ ] | [ ] | Pending |
| Unnao | 186 | [ ] | [ ] | Pending |
| Varanasi | 187 | [ ] | [ ] | Pending |

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
