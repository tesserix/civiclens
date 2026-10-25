# Civic participation, administrative reference and grievance channels

## Context

Issues #11–#13 extend CivicLens from private photo reports to civic requests,
petitions, deadline-based opinion polls and official complaint handoffs. Keep the
existing Rust API/PostgreSQL/Expo deployment. Planning assumptions: 10,000 active
accounts, 10,000 ballots/day, 10× peak ≈1.2 writes/second, 20 reads/write, 4KB card
payloads and ≤1KB ballots. One year ≈3.65m ballots (~2GB with indexes), three years
≈11m (~6GB), excluding 3× growth. Administrative reference is <500,000 rows and
<2GB per snapshot. Target eventual 99.9% availability and p99 <500ms metadata
requests; external grievance providers have independent deadlines and availability.
These are sizing assumptions, not measured guarantees.

## Decision

Add relational, indexed tables in the existing product schema. One participation
card has a kind (request or poll), immutable reviewed question/body, author,
country/locality and UTC close time. New content starts pending; an independent
moderator approves it before other users can see or respond. Public credit uses
nicknames. One private response per authenticated account/card is enforced by a
primary key. Account uniqueness does not establish unique humans or eligibility
to vote in an official election. Polls are voluntary opinion surveys with no
money, wagering, market prices or settlement.

The API locks the card before changing a response and checks database clock time
after acquiring that lock. Retrying the same response is idempotent; responses can
change or be withdrawn before closing. Questions cannot be edited after creation.
Each result read uses a stable statement timestamp so its closing flag and
aggregate cannot disagree while the deadline passes. Poll totals are hidden until
the deadline, including from the author. Closed
results include all Yes, No and Don't know votes in the denominator, exact counts,
percentages to one decimal, and zeroes for an empty poll. Rounding can total
99.9/100.1; UI states this. Petition support totals may be visible while open.
Signatures mean account-backed support with explicit consent, not legal digital
signatures. Opinions are separately moderated; private identities/ballot lists
are never exposed. Lists use capped cursor pagination.

Administrative units use stable source codes, country, kind and explicit parent
links rather than a column per country. Countries have different hierarchies:
India state/UT/district/local body, Nepal province/district/local government, NZ
regional/territorial/unitary councils. Reference import history is immutable and
contains source/licence/retrieved date/hash and coverage status. It does not grant
reviewed geographic, service-responsibility or publishing verification. Never
infer municipalities or current officers from AI output.

A grievance channel records official URL, category/responsibility, type,
verification/expiry, authentication requirements, and documented API availability.
Unknown API support stays unknown. An authenticated reporter can prepare an
owner-scoped package only after the existing all-photo/content/authority review
and a separate confirmation of the destination and transmitted data. Official
form/email handoff is useful when no authorized API exists; handoff is never a
successful government filing. Supported API adapters must persist intent before
I/O, use owner/destination idempotency, and distinguish accepted, failed and
uncertain using official acknowledgement evidence. No blind timeout retries,
CAPTCHA bypass, scraped session reuse or guessed submission endpoints. No real
complaints are sent during testing. Verified local emergency contacts are guidance;
CivicLens does not dispatch police or emergency services.

## Safety, privacy and failure behavior

Private sessions, political preferences, signatures, exact coordinates and photos
are the protected assets. Unauthenticated users, other account holders, abusive
creators and compromised moderators cross explicit server authorization boundaries.
Moderator grants remain administrator-managed. Missing/stale authority evidence
holds complaints. Missing provider authorization disables API delivery and explains
form handoff. Content-safety outage blocks new public content; saved drafts remain.
Database outage fails writes without fabricated receipts. Duplicate/concurrent
votes cannot increase an account's count. Moderators cannot approve their own
content. Hide/report flows and append-only audit events cover abuse operations.
Account export/erasure must include cards, opinions and responses; do not advertise
self-service completion before operator fulfilment and backup expiry are verified.

## Delivery and recovery

Use additive migrations and test against isolated PostgreSQL schemas before any
live change. Keep the released sharing version stable while developing here.
A later named production rollout needs a fresh restorable backup, reviewed import
counts/hashes and specific approval. Do not drop tables/data as rollback; disable
new-client access and retain private participation records for approved recovery.
No new services, queues or paid directory vendor are needed. At the assumed scale,
existing API/database capacity should suffice; storage increases by single-digit
GB/year before growth. Measure queries and cost before scaling.

A third-party petition/poll platform was considered and rejected because it adds
identity/data ownership and another paid dependency without solving official
grievance authorization. Reuse the existing database and broker identity instead.

## Implemented complaint boundary

Migration 0009 adds administrator-owned, expiring official-form/contact channels
and owner-scoped `complaint_intents`. Runtime channel writes are denied. Report
approval can include separate `complaintDescription` and
`complaintFactualReviewed`; preparation refuses absent factual review and never
silently converts social satire. Reports can request complaint preparation with
zero social destinations. Preparation repeats the same export guard as native
social sharing, checks content safety and loads only metadata-stripped reviewed
photos. Durable snapshots contain text and channel provenance, not duplicated
photo bytes. A stable owner/report/channel unique constraint prevents duplicate
preparation records; key reuse for changed requests returns 409. Handoff rechecks
expiry and snapshot equality. Status is `prepared` or `handoff_requested`; no
submission endpoint, provider receipt or automatic retry is fabricated. The user
finishes the official form and supplies required identity there. The initial
verified cleaning form is Melbourne only, as documented in the source audit.

Local iOS testing exposed an ambiguous `/` redirect loop at sign-out. Sign-in now
has an explicit `/sign-in` route, tested with Expo's real router. Device credentials
and private query data are cleared before best-effort server revoke; a failed
remote revoke produces an honest expiry notice. Native tests use the real broker
and an isolated local API/database; only the external content-safety boundary is
deterministic test data. This is not live-provider safety or production evidence.
