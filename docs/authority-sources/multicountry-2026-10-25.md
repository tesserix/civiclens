# India, Nepal and New Zealand reference audit — 25 October 2026

This is a reference inventory, not verified geographic/service routing. The
live release still routes only Melbourne waste/litter. New imports and migrations
0007–0009 are tested locally and have not been applied to the cluster.

| Country | Included reference identities | Known gaps |
| --- | --- | --- |
| India | 36 states/UTs, 784 districts, 5,050 urban local bodies | Rural panchayats/villages are not included. Twelve bodies need district-link review; 26 span multiple districts. No reviewed local complaint APIs, boundaries, police or environment-ministry responsibility mapping. |
| Nepal | 7 provinces, 77 districts, 753 local governments | 22 other/protected administrative areas are retained separately. No reviewed municipal contact/API inventory or legal boundary routing. |
| New Zealand | 78 distinct regional/territorial/unitary councils | Regional/territorial overlap is preserved, not converted into an invented hierarchy. All have official directory profiles; one actual website/contact profile is captured. Police and environment-agency routing remain pending. |

Every new reference record has `complaintApiStatus: unknown`. Unknown does not
mean no API exists. A website, contact page or social handle is not an API.
Source identities do not grant publishing or complaint authorization.

## Sources and reproduction

India: [LGD](https://lgdirectory.gov.in/), Ministry of Panchayati Raj. The live
homepage counters matched 28 states + 8 UTs, 784 districts and 5,050 ULBs during
capture. Dated public 24 Oct 2026 CSV archives were obtained from
[ramSeraph's public LGD archive index](https://ramseraph.github.io/opendata/lgd/)
and the ramSeraph/opendata release assets, not by running its extractor or
solving a CAPTCHA. The official [copyright policy](https://lgdirectory.gov.in/copyRightPolicy.do)
permits attributed reproduction. Keep LGD codes unchanged. Unresolved or
multi-district bodies remain under their official state; district memberships are
retained separately, including the unresolved source codes. Do not infer boundaries.

Nepal: [HDX COD-AB v02](https://data.humdata.org/dataset/cod-ab-npl), government-derived
OCHA FIS reference, reviewed 30 Oct 2025 and published 14 Aug 2026,
[CC BY-IGO](https://creativecommons.org/licenses/by/3.0/igo/). The workbook has
775 admin-3 features: type codes 1–4 give 753 local governments (6 metropolitan,
11 sub-metropolitan, 276 municipalities, 460 rural municipalities); type 5 gives
22 other areas. The older mixed GitHub geography dataset was rejected. Ministry
contact requests timed out; no municipal website was guessed.

NZ: [Govt.nz organisations](https://www.govt.nz/organisations/), Crown/Public Service
Commission, [CC BY 4.0 terms](https://www.govt.nz/about/the-govt-nz-website/using-this-website/copyright-and-attribution/).
Council identities are filtered explicitly from other public organisations. The
Auckland profile supplies its actual website and report-problem contact page.
A bounded bulk-profile refresher is supplied, but the robots policy was unavailable
and it stopped before bulk requests. The manifest records this gap. Retry only
when policy can be obtained; never bypass restrictions or overwrite successful
source records with guesses.

Raw inputs are retained locally in the ignored directory
`artifacts/directory-sources/2026-10-25/`. Each snapshot embeds the source filenames,
SHA-256, licence, source link and retrieval timestamp. The fixed retrieval time
below is the actual final input capture timestamp. Do not substitute a later
script execution time for an old capture.

```sh
uv run --with openpyxl python scripts/authorities/administrative_reference.py \
  --india-dir artifacts/directory-sources/2026-10-25/india-csv \
  --nepal-xlsx artifacts/directory-sources/2026-10-25/nepal-hdx-2026-08-14.xlsx \
  --nz-html artifacts/directory-sources/2026-10-25/civiclens-nz-organisations.html \
  --nz-profiles artifacts/directory-sources/2026-10-25/nz-profiles/profiles.json \
  --output api/data/directory \
  --retrieved-at 2026-10-24T15:24:52.398408+00:00
```

The replay after typing/lint changes reproduced all three hashes exactly:

| Snapshot | Rows | SHA-256 |
| --- | ---: | --- |
| in-lgd-administrative.json | 5,871 | `9f2b37f508f4f8a1dd638db884b4535ab0ada8c03bb039b14cb22370f305b14b` |
| np-hdx-administrative.json | 860 | `ecd336894bb5d86241f6bff0693347d5786710f1d25f975ab52feee28be3cb2d` |
| nz-govt-councils.json | 79 | `048ca3a2bdd83622d7308e2a61e16da0d4ef6ea754db8932d522ffa15ae1d488` |

The importer validates duplicate codes, one country root, parent existence and
levels, cycles and district membership. PostgreSQL keeps immutable source imports
and record history. `country_code`, `administrative_level`, `parent_record_id` and
`complaint_api_status` are generated columns on those records, with country/level
and parent indexes. Importing references leaves exactly one verified routing
record. Refresh by a reviewed import; never edit historical rows in place.

## Complaint channels

Chrome review on 24 Oct 2026 UTC verified that Melbourne's
[street-cleaning page](https://www.melbourne.vic.gov.au/street-cleaning-and-maintenance)
links the [Clean public space form](https://services.melbourne.vic.gov.au/report/cleanpublicspace).
The form visibly presents prior-report, location, issue, photos and confirmation
steps. No fields were completed and no complaint was submitted. The evidence page
excludes hazardous spills/emergencies from online reporting and requires a call
for urgent danger. This channel is reviewed for ordinary litter/cleaning only,
expires after 30 days, and still has unknown API support.

Migration 0009 records this channel and owner-scoped preparation/handoff intents.
Runtime can read channels but cannot create or alter them. Maintain official URL,
category, authority ID, evidence, authentication guidance, review and expiry in a
reviewed migration. Source revisions must be recorded here and in Git. Do not
promote a generic national portal into local responsibility automatically.

CPGRAMS' public homepage was reachable; its Signin flow does not establish an
application submission contract. NZ Police's 105 endpoint returned 403 to a
read-only CLI request; Nepal's grievance portal timed out. These are recorded as
research gaps, not proof of absent APIs. No police complaints or emergency calls
were made. A future documented API needs agency-authorized client/tenant access,
OpenBao credentials, receipt/reconciliation and exact-scope tests before enabling
any automatic filing. There is no generic automated filing adapter in this change.

Tracking: [#11 directory](https://github.com/tesserix/civiclens/issues/11),
[#12 complaints](https://github.com/tesserix/civiclens/issues/12),
[#13 participation](https://github.com/tesserix/civiclens/issues/13).
