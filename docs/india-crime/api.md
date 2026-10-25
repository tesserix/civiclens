# Reusable official complaint API

Status: **implemented and tested locally; not deployed**. The gateway provides
administrative selection, provider discovery, readiness and private internal
requests. It cannot submit a government complaint yet. Tamil Nadu is the first
documented submission candidate; MP has a lookup-only candidate. Other state/UT
providers remain unregistered.

## Shared contract

Use the existing `Authorization: Session <session-token>` header. The capability
`officialComplaintGateway: true` announces the internal gateway, not live police
submission. Types are exported from [shared/contracts.ts](../../shared/contracts.ts).

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/v1/official-complaints/providers?countryCode=IN` | Provider candidates, documentation and blockers; optional `regionId` |
| GET | `/v1/official-complaints/jurisdictions?countryCode=IN` | Administrative regions: 36 Indian states/UTs |
| GET | `/v1/official-complaints/jurisdictions?countryCode=IN&regionId=in-state-33` | Tamil Nadu's 38 administrative districts |
| POST | `/v1/official-complaints/resolve` | Validate the selected hierarchy and return readiness |
| POST | `/v1/reports/{reportId}/official-complaints` | Create a private blocked internal request |
| GET | `/v1/reports/{reportId}/official-complaints` | History for an owned report |
| GET | `/v1/official-complaints/requests/{requestId}` | Retrieve an owned internal request |

Jurisdiction/history pages accept `limit` (1–50, default 20) and return
`nextCursor`; pass it back as `cursor`. A jurisdiction cursor must belong to the
selected country/region. Responses expose reference provenance and hashes. Restart
selection if the source hash changes across an update. Unregistered countries
return empty discovery lists, not fabricated coverage; nonexistent selections
fail validation.

## Tamil Nadu readiness

Select canonical IDs returned by the API. Do not infer a police code from a name
or LGD number. Example request:

```http
POST /v1/official-complaints/resolve
Authorization: Session <session-token>
Content-Type: application/json

{
  "countryCode": "IN",
  "regionId": "in-state-33",
  "districtId": "in-district-610",
  "issueType": "crime",
  "locationConfirmed": true
}
```

The response includes canonical region/district names and `referenceSource`.
`locationConfirmed` records explicit user selection, not verified legal police
jurisdiction or GPS boundary matching. Selected response fields:

```json
{
  "canSubmit": false,
  "providerDistrictCode": null,
  "providerStationCode": null,
  "applicationMaxPhotos": 5,
  "provider": {
    "id": "in-tamil-nadu-police-umang",
    "submissionSupported": false,
    "photoContract": {
      "verified": false,
      "mimeTypes": [],
      "maxPhotos": null,
      "maxBytesPerPhoto": null,
      "originalsRequired": null
    }
  }
}
```

Five is the product ceiling, not a provider limit or proof of configured media
storage. Existing report creation uses `capabilities.maxPhotos`. Unknown provider
limits stay null. This gateway has no evidence-upload endpoint and sends no report
photos elsewhere. A verified private original-evidence pipeline remains necessary
before a real government adapter.

Typed `blockers` include `provider_access_pending`,
`police_jurisdiction_unverified`, `evidence_contract_unverified`,
`receipt_contract_unverified`, `sandbox_unavailable`,
`independent_review_unverified` and `adapter_not_implemented`. Expired or
not-yet-effective source reviews add explicit blockers. Regions without a
registered provider return `provider: null` and `no_provider_registered`.

## Internal request creation and tracking

Use an owned `public_safety` report whose incident country matches routing. The
request needs explicit consent and a fresh UUID `Idempotency-Key`. This stores
intent only and does not bypass report review.

```http
POST /v1/reports/{owned-report-id}/official-complaints
Authorization: Session <session-token>
Idempotency-Key: <new-UUID>
Content-Type: application/json

{
  "routing": {
    "countryCode": "IN",
    "regionId": "in-state-33",
    "districtId": "in-district-610",
    "issueType": "crime",
    "locationConfirmed": true
  },
  "consent": true
}
```

The response includes an internal `id`, `reportId`, `createdAt`, captured
`resolution`, `status: "blocked"`, `dispatchAttempted: false` and
`officialReference: null`. Display this as **not filed**. Never use the internal
ID as a police complaint, CSR or FIR number. Fetch by ID or use report history.
The snapshot describes readiness at creation; call `resolve` for current metadata.
Any future dispatch must independently recheck all requirements and approvals.

Same owner/key/payload returns the same record, including concurrent retries.
Changed payload with an existing key returns 409. The database enforces report
ownership and rejects snapshots claiming `canSubmit: true`. Account limits are
50 new requests per rolling 24 hours and 1,000 retained requests. Retries do not
consume another slot; existing records remain readable at the limit. Normal API
rate limiting also applies.

| Result | Meaning |
| --- | --- |
| 200 with `status: blocked` | Internal record exists; no government submission attempted |
| 400 | Invalid hierarchy, category/country, consent, submission key or pagination |
| 401 | Session required |
| 404 | Not found or not owned; another user's existence is not disclosed |
| 409 | Key reused with changed payload |
| 413 | Resolve/request JSON exceeds 4 KB |
| 422 | Invalid JSON fields/types/enums; unknown fields are rejected |
| 429 | Account quota or normal API rate limit reached |

Arbitrary provider URLs, credentials, legal identity and photo blobs are not
accepted. Keep emergency access separate: this gateway cannot dispatch help or
replace 112.

## Connect another state or country

1. Complete the relevant [state tracker](README.md#state-and-union-territory-register),
   distinguishing citizen websites, API contracts, approval and working filing.
2. Add a reviewed descriptor to the
   [provider registry](../../api/data/official-complaint-providers.json). Scope it
   by country, region and issue; include official contract/version and review
   expiry. Register documented operations only. No descriptor means unknown API
   availability, not a fabricated endpoint.
3. The current registry accepts only non-dispatching candidates with unknown media
   contracts. Overlapping providers, invalid geography and configuration enabling
   submission are rejected at router initialization. JSON cannot enable filing.
4. For another country, add a source and normalized hierarchy to the
   [reference catalogue](../../api/data/official-complaint-geography.json). Keep
   provenance, stable IDs/parents, reference codes and review expiry. The India
   entry derives from pinned LGD data; a Rust test verifies every derived name,
   code and parent. Do not force a different police hierarchy into invented units.
5. Obtain reviewed provider police-district/station identifiers. LGD codes are a
   separate namespace; this version returns null police codes until a verified
   mapping layer exists.
6. Implement an adapter after approved access/test credentials, incident scope,
   photo/identity contract, official acknowledgement and timeout reconciliation are
   verified. This version contains no government HTTP client or dispatch worker.
7. Add authorized end-to-end/failure tests, independent content/photo review,
   account isolation and retention/export/erasure handling. Complete an explicitly
   approved migration/rollout; deployed credentials belong in civiclens-prefixed
   OpenBao paths separated by environment.

Architecture and recovery are in [ADR 0010](../adr/0010-official-complaint-provider-gateway.md).
Administrative mapping and local tests do not resolve any state/district police
integration by themselves.
