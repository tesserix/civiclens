# ADR 0018: Reporter-confirmed native social sharing

## Context

The owner wants citizen reports to go straight to their own social apps without
moderator approval. This supersedes the independent-review requirement in ADRs
0008, 0014 and 0016 only for this native handoff. Community content, managed
publishing and official complaints retain independent review.

Existing pilot assumptions remain: 1,000 reports/day, peak 0.12 writes/s, 10:1
reads:writes, typical 2 MB/photo, up to five photos. The original single-photo
storage estimate is 730 GB/year; five photos on every report would be 3.65 TB/year
and 10.95 TB over three years at constant volume. Target 99.9% availability;
metadata p99 <500 ms, with bounded 80-second media/safety exports. These are
planning assumptions, not measured service claims. No new service or datastore.

## Decision

Advertise additive reporterSharing. New clients explicitly confirm the caption,
all photos, responsibility and external identity before submission. The optional
reporterConfirmed input creates a private ready_to_share receipt, never a fake
moderator approval. Absent optional fields retain legacy serialization/idempotency.

Owner-scoped share-package accepts reporterConfirmed, the current community rules
version and the exact photo count. The audit records this fresh acceptance.
It allows existing pending manual reports too. Require current rules and identity
acknowledgement, fresh verified authority routing, final caption safety checks,
and all sanitized metadata-stripped photos. Missing verified authority data omits
mentions/place tags and does not block a generic awareness post. Other owners get
404. Assets are photos, private identity and precise location; malicious reporters
and other accounts cannot cross the authenticated owner/export boundary.

After successful submission the app opens the receipt and consumes a one-shot
in-memory intent bound to the session and report. A URL cannot authorize an
external action. Preserve all destinations; hand off one at a time with a deliberate
Next action. Android uses targeted sharing for Facebook/WhatsApp with allowlisted package
visibility queries; its Instagram SDK handler requires a single URL, so use the
full-photo system sheet there. iOS preserves all photos
through the system share sheet because targeted SDK paths can drop attachments.
TikTok uses the system sheet or explicit save/copy/open fallback. No native return
value is a provider delivery receipt. The user confirms the final post externally.

## Failure, rollout and alternatives

Submission is committed before handoff; retries reuse the owner/key/payload. A
safety outage fails export closed; a missing app, cancellation or network failure
keeps the private receipt and allows retry. No outbox jobs, token or implicit post.
Do not weaken reviewed_export used by official complaints. Reject universal fake
approval because it would wrongly authorize other publication paths.

No migration: report status already lives in JSON. Rules version 2026-10-25
requires fresh acceptance of reporter responsibility and social identity visibility.
Older clients with the previous rules version must update; restored drafts must
accept the new rules before submission. Roll out API first with named
approval, then updated binaries; old clients retain their reviewed flow. Roll back
client/API together if needed; a ready_to_share receipt remains private. No cloud
mutation is included here. Cost remains existing hosting plus photo egress and
caption-safety inference per preparation; measure provider charges before scaling.
