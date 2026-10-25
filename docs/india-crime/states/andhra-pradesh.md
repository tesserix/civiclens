# Andhra Pradesh crime reporting integration

[India tracker](../README.md) · Task **IN-28** · State ·
**28 administrative districts in the pinned LGD snapshot**.

Initial discovery recorded **25 October 2026**. Integration remains **unresolved**.
The state-level resolution checkbox is in the [India register](../README.md#state-and-union-territory-register).
Owner: **Unassigned**. Next source review: **23 January 2027**, or earlier on change.

## Official routes and initial finding

- [Official entry point or service directory](https://citizen.appolice.gov.in/)
- [Supporting official source](https://apnrts.ap.gov.in/police/complaint_register.php)
- [National state police gateway](https://digitalpolice.gov.in/)

Police citizen gateway located. A separate APNRTS/CID NRI grievance form accepts complaints and supporting evidence; its NRI scope must not be treated as general police reporting.

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
| Photo evidence | Specialised NRI web form advertises JPG/PNG/PDF/DOC/DOCX up to 3 MB; general police API attachment support not verified. |
| Track complaint or FIR | Official portal/source leads are listed above; authorized API and returned reference semantics not verified. |
| Authentication and approval | Confirm organization/app eligibility, publisher approval, citizen identity/login/OTP/consent and service-specific requirements. No CivicLens credentials issued or access exercised. |
| Receipt and duplicate handling | Official acceptance fields, reference format, idempotency and timeout reconciliation not verified. |
| Test environment and quotas | Approved sandbox/test credentials, disposable test records, limits and provider escalation not verified. |
| District and station identifiers | Not mapped. LGD administrative identifiers below must not be used as provider police codes. |

Next action: **Verify the general police complaint route and app/API access; keep NRI and railway-specific services separate.**

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
| Alluri Sitharama Raju | 745 | [ ] | [ ] | Pending |
| Anakapalli | 744 | [ ] | [ ] | Pending |
| Ananthapuramu | 502 | [ ] | [ ] | Pending |
| Annamayya | 753 | [ ] | [ ] | Pending |
| Bapatla | 750 | [ ] | [ ] | Pending |
| Chittoor | 503 | [ ] | [ ] | Pending |
| Dr. B.R. Ambedkar Konaseema | 747 | [ ] | [ ] | Pending |
| East Godavari | 505 | [ ] | [ ] | Pending |
| Eluru | 748 | [ ] | [ ] | Pending |
| Guntur | 506 | [ ] | [ ] | Pending |
| Kakinada | 746 | [ ] | [ ] | Pending |
| Krishna | 510 | [ ] | [ ] | Pending |
| Kurnool | 511 | [ ] | [ ] | Pending |
| Markapuram | 790 | [ ] | [ ] | Pending |
| Nandyal | 755 | [ ] | [ ] | Pending |
| Ntr | 749 | [ ] | [ ] | Pending |
| Palnadu | 751 | [ ] | [ ] | Pending |
| Parvathipuram Manyam | 743 | [ ] | [ ] | Pending |
| Polavaram | 791 | [ ] | [ ] | Pending |
| Prakasam | 517 | [ ] | [ ] | Pending |
| Sri Potti Sriramulu Nellore | 515 | [ ] | [ ] | Pending |
| Sri Sathya Sai | 754 | [ ] | [ ] | Pending |
| Srikakulam | 519 | [ ] | [ ] | Pending |
| Tirupati | 752 | [ ] | [ ] | Pending |
| Visakhapatnam | 520 | [ ] | [ ] | Pending |
| Vizianagaram | 521 | [ ] | [ ] | Pending |
| West Godavari | 523 | [ ] | [ ] | Pending |
| Y.S.R. Kadapa | 504 | [ ] | [ ] | Pending |

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
