# ADR-0007: private report photos and versioned community rules

Status: local implementation; live rollout requires explicit approval.

## Context and sizing

Pilot assumptions: 1,000 reports/day, 10x daily-average peak = 0.12 writes/s,
five photos/report = 0.6 object writes/s; read:write 5:1. Typical report 10 MB,
maximum 30 MB decoded / 40 MB base64, six MB per image. Constant volume is
3.65 TB at 12 months, 10.95 TB at 36 months; 3x annual growth gives 47.45 TB
cumulative at 36 months. Targets: metadata p99 500 ms, upload deadline 75 seconds,
eventual pilot availability 99.9%. These are unmeasured planning assumptions.
At $0.02/GiB-month storage is about $68/month at year one, excluding egress,
operations, taxes and soft-deleted copies. Confirm regional pricing before apply.

## Decision

Keep the existing modular Rust API and PostgreSQL. Accept 1–5 ordered photos,
retaining the original first-photo request/DB field for compatibility. Sanitize
every image sequentially under bounded concurrency. Private GCS object names
include owner UUID, submission UUID, payload hash and image index. Create-only
generation preconditions plus byte verification make retries safe. Store exact
bucket/object/generation references atomically with the report. Advertise five
photos only when GCS is configured; local one-photo development remains possible.

Use GKE metadata credentials / Workload Identity with only object create/get on
one private bucket. No static keys, listing/deletion rights, public ACLs or public
URLs. Moderator photo endpoints authorize roles; the owner's sharing package
requires independent all-photo review (ADR-0008). User-supplied URLs are never
fetched. The original first-photo DB blob remains for old readers/rollback.

GCS and SQL cannot commit atomically. SQL failure can leave private orphans;
identical retries reuse verified immutable objects. After the retry window, an
operator reconciles inventory against DB references before separately approved
removal. Never auto-delete uncertain objects. Seven-day soft-delete recovery is
part of erasure timing. No irreversible locked retention policy is introduced.

Submission requires the current community-rules version and explicit sharing
consent. An append-only audit event records account, report, version and server
time; the report stores the version and location provenance. No provider name,
email, access token or exact location is inserted in a public caption.

## Failure, migration and rollback

GCS down: fail submission/export; keep device draft/key or saved report, with no
fake receipt. SQL down: fail writes; orphan objects remain private. Missing review,
expired/ambiguous authorities or safety outage: no sharing package. External app
unavailable: keep the report and show retry; never mark a public post delivered.

Only additive migration `0006_private_report_photos.sql` is needed. Apply through
the existing backed-up migrator hook under an approved rollout. The abandoned
country-publication migration/credential map/Graph staging additions were removed.
Do not drop new data on rollback. Stop new traffic before rollback to an old API;
old binaries cannot process multi-photo records safely. Restore into a scratch DB
first; new API can continue reading old reports. Legacy managed publishing stays
disabled. Production collection also retains the existing scoped-erasure,
independent-review and backup-expiry launch gates.

Rejected: five Postgres blobs grow backup/restore cost; public object URLs expose
private evidence; a new upload service adds a failure domain at pilot scale.
