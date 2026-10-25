# ADR 0010: Shared official complaint provider gateway

## Decision and scope

Reuse the existing Axum API, Postgres, authenticated account and reviewed-report
model. Add one country-neutral official-complaint gateway for provider discovery,
administrative reference selection, routing readiness and owner-scoped internal
requests. Begin with all 36 Indian states/UTs and 784 LGD district references;
Tamil Nadu is the first documented submission-provider candidate. This adds no
new service, worker, paid dependency or live government connection.

The existing municipal official-form preparation remains separate. The gateway
does not turn crime allegations into public posts, bypass existing review,
collect legal identity, or treat re-encoded social photos as original evidence.
Government submission and original-evidence collection remain unavailable until
authorized provider contracts and the evidence privacy design are verified.

## Contract and location identity

One normalized API serves all providers. A provider descriptor declares country,
region, documented operations, evidence source, review expiry and verified media
limits. Unknown limits are null, not defaults. Tamil Nadu advertises registration
and status documentation; MP advertises lookup/authentication documentation only.
Other state/UT entries have no registered adapter and remain explicitly unknown.

The pinned LGD snapshot supplies names and hierarchy. State and district selections
are validated together, rejecting cross-state, cross-country, ambiguous and
unknown IDs. These are administrative reference mappings, not police boundaries.
Provider police identifiers are a different namespace; no code is inferred from
an LGD number, state name or ISO abbreviation. Administrative provenance/review
expiry are returned separately from police verification. New countries can reuse
the contract by registering their hierarchy and provider; unsupported countries
return no fabricated coverage.

No external provider request is possible in this version. Provider descriptors
cannot enable dispatch by configuration alone. An actual adapter requires current
approved credentials, verified police mappings, supported incident classes, photo
encoding/limits, official acknowledgement and duplicate reconciliation semantics,
plus authorized test evidence. An unavailable sandbox and unknown contract fields
are returned as structured readiness blockers.

## Internal requests and reliability

Creating an internal request requires an owned report, explicitly confirmed
country/region/district and consent. Only public-safety reports are eligible.
The stored status is `blocked`; the response explicitly states that dispatch was
not attempted and no official reference exists. Internal IDs are never labelled
police complaint numbers. Requests store identifiers and a readiness snapshot,
not legal names, raw evidence, credentials, or duplicated report text.

Use a unique owner/idempotency key, canonical request hashing and one transaction
to bound account quotas and prevent concurrent duplicates. Same key/payload
returns the same request; changed payload returns conflict. Reads are owner scoped,
including report parents. Reports cannot be altered through this gateway. Missing
authentication, invalid hierarchy, refused consent and wrong category fail before
creating a request. An expired source remains blocked. Rechecking provider
readiness must precede any future submission; a stored snapshot is not permission
to dispatch after provider configuration changes.

A future authorized adapter must separate internal state from official acceptance
and reconcile an uncertain network result before retrying a non-idempotent create.
Do not invent generic retries, receipts, callbacks or a working API from a public
OpenAPI document. Secrets remain in civiclens-prefixed OpenBao environment paths.

## Capacity, verification and rollout

Assume at most 1,000 internal requests/day initially and a 10x peak below 2 writes/s.
Requests contain only small JSON snapshots and references. Budget roughly 4 KB
per row before indexes and normal Postgres overhead; measure actual growth before
extending retention. Reuse existing photo storage with no additional copies.
Owner/report/key indexes support bounded reads. Rate limits and a per-account
request cap prevent unbounded creation. No unpaginated district or history API.

Verify canonical coverage, cross-region rejection, documented versus usable
capabilities, source expiry, unknown upload limits, authenticated access, IDOR,
consent, report ownership/category, duplicate/concurrent keys and quota behavior.
Exercise the actual HTTP router against isolated Postgres migrations; no real
government submission or call is a QA fixture. Existing mobile tests, typecheck,
lint, Expo Doctor and exports remain release checks.

Migration 0010 is additive and local-test-only in this work. Any later live
migration or rollout needs separate named approval and the existing backup/GitOps
workflow. Recovery is to disable the new routes while retaining private request
records for approved retention/erasure. Include the new records in export/erasure
inventory and verify backup expiry before collecting real citizen reports.
