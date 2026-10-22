# Account deletion initiation and manual fulfilment

CivicLens follows Roamie's persistent request/30-day support fulfilment pattern.
The API accepts a request only for the opaque session's user, rejects caller-supplied
identity fields, and returns the same receipt/deadline on retry. GET only returns
that user's receipt. Runtime can insert requests and read status, but cannot mark
completion or delete evidence. A committed request is pending, never proof of erasure.

Pilot sizing inherits architecture.md: at most 1,000 accounts/day is under 0.12
requests/sec at 10x peak; request payload is `{}` and receipt is under 1 KB. A
unique user index suffices. At 365k requests/year the metadata remains small
relative to photos. Target p99 <500 ms and existing 99.9% pilot goal. Strong
consistency is required for deduplication; no remote call runs in the transaction.
When Postgres is down, initiation fails visibly and retries are safe.

The broker subject is stored privately on successful sign-in so authorized
fulfilment can locate the exact CivicLens identity without guessing by nickname.
It never enters mobile responses or public captions. Existing rows remain nullable
until their next verified login. Requests do not immediately revoke access, so
users can still view their receipt; support must quiesce writes and publication
before erasure. Scope all identity work to consumer-civiclens and preserve other
products and the user's Apple/Google/Meta account.

The additive migration retains rows on code rollback. Runtime gets SELECT plus
INSERT on named request columns only. Request completion and actual data/provider
erasure require the separately authorized operations procedure. Backups, audit
records and social copies need explicit handling; a cascading user delete is not
sufficient and is deliberately not exposed as a misleading button.

No new service, queue or paid processor is needed. Operational cost is support's
daily queue review and verified fulfilment. The full deletion drill, staffed queue,
backup expiry and deployed public URLs are production release gates. This change
implements initiation, not an automated erasure worker or proof of store compliance.
