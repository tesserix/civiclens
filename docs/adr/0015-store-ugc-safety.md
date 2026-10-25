# ADR-0015: community blocking and store release boundaries

## Context and sizing

Apple guideline 1.2 and Google Play's UGC policy require reporting and blocking
for public community content. Current reports and community cards are independently
moderated, but account-scoped blocking is missing. The existing pilot assumptions
remain 1,000 daily submissions, a tenfold peak and ten reads per write. At 1,000
accounts and at most 1,000 blocks each, the upper bound is one million narrow
rows; normal usage should be much smaller. Threefold growth over 36 months fits
the existing indexed Postgres deployment. Keep the current 99.9% availability and
sub-500 ms p99 metadata targets; these are targets requiring measurement.

## Decision

Keep the feature in the existing API/database. An authenticated account may set
or remove its own block of a unique public nickname. PUT expresses the desired
state, so retries are idempotent. A private, bounded cursor-paginated list supports
unblocking. Reject self-blocking and never expose provider identities, emails or
internal target-account IDs.

A block hides either account's cards/opinions from the other authenticated
account and prevents new responses, saved-card additions and share preparation
across that relationship. Existing private responses and aggregate results are
retained. In-flight requests may finish; subsequent reads apply the block.
Public logged-out pages still expose only independently approved public content.
Independent moderation must remain possible even if an abusive account blocks
a moderator. A single SQL visibility function owns the relationship rule.

Add specific opinion abuse reports, using the opinion's actual author/card
relationship. Both content and author reporting remain available before blocking.
Keep moderation queues and abuse evidence independent of personal block filters.
Add an Account screen to view and undo blocks, with current-account query keys
and cache invalidation after changes.

Store builds do not offer an unconnected police/crime filing integration. The
internal official-complaint prototype remains disabled by default and cannot be
enabled in production without a documented authorized provider and separately
reviewed deployment. Civic hazards and municipal official-form handoffs retain
their existing review and consent boundaries. No money or wagering is introduced.

## Storage, failures and rollout

Migration 0013 adds private block/opinion-flag tables, bounded-time DDL and
least-privilege runtime grants. Indexed owner/target relationships support reads
and account erasure; include both record types in export/deletion procedures.
The migration is additive and forward-only in production. Rehearse migration and
new-table removal only in an isolated scratch database; never drop live records
as rollback. A production migration/rollout needs the owner's specific approval
after the tested change is reviewable.

If the database is unavailable, block changes fail visibly and cannot report
success. No queue, external call, new secret, service or infrastructure is needed.
Quota checks and the block write share one transaction. Reuse the existing API's
rate limit, input limits and request deadlines. Incremental storage is the only
cost; there is no new provisioned service. Client-only hiding was rejected because
direct API requests would bypass it.

## Sources

- https://developer.apple.com/app-store/review/guidelines/#user-generated-content
- https://support.google.com/googleplay/android-developer/answer/9876937
