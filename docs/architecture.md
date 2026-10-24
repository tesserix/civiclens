# CivicLens pilot architecture

## Product contract

Sign in with Google or Facebook; choose a unique public nickname or receive one
automatically. Photograph a civic issue, confirm GPS/location, choose a category,
and submit. Reports are private until reviewed. The app publishes as CivicLens,
crediting the nickname only. This is public pseudonymity: the service knows the
account's provider identifier, and photos/text/location can themselves identify
someone. Never promise untraceability. This is not an emergency dispatch service.

## Scope and sizing assumptions

Pilot assumptions, not measured demand: 1,000 reports/day, 10x peak = 0.12 report
writes/sec; 10 reads per write, 2 MB typical sanitized photo, max 6 MB decoded
upload. At constant volume: 365k reports / ~730 GB photos at 12 months, 1.1m /
~2.2 TB at 36 months before retention. Plan for 3x annual growth. Target eventual
production availability 99.9%, p99 metadata requests <500 ms; submission <5 sec
excluding upload; publishing within 5 minutes after moderation and routing.
These targets require production measurement and are not claims about this pilot.

## Decision

One Rust/Axum API, SQLx, a dedicated database/schema on the existing global CNPG
Postgres cluster, private re-encoded JPEG blobs, and a transactional publishing
outbox. A local Postgres container is for development/tests only. Move photos to
private object storage before public-volume launch to protect shared disk. No microservices, broker or
Temporal cluster: report approval + outbox is one database transaction and the
first publisher is a single external side effect. A future multi-step Instagram
workflow must persist its container before publishing or use Temporal.

Rust contracts in api/src/contracts.rs generate shared/generated.ts for mobile;
shared/contracts.ts re-exports these types and adds UI labels. Routes use /v1;
error shape is code/message/request_id. Sessions are opaque, random, expiring,
revocable, hashed at rest, and stored in device SecureStore. Browser preview uses
memory only. Google/Facebook authentication uses the existing Tesserix Zitadel broker, as
Roamie does. Native code+PKCE and one-time server nonce precede issuer/audience/
signature/expiry validation against the trusted broker JWKS.
Raw provider tokens, names and emails are never persisted by the CivicLens API.
The private verified broker subject is retained for scoped deletion fulfilment;
it is never exposed in mobile or public report payloads. Identity uniqueness
uses an HMAC of issuer + subject with a dedicated runtime application key.
Nicknames are unique case-insensitively; auto names have random suffixes and a
database uniqueness constraint. Provider linking belongs to the broker's verified identity policy; the API never links by email. Loss/rotation of the HMAC key needs a planned account migration.

## Writing assist

Optional help with the description, through the Tesserix private AI gateway
(ADR-0003). "Write it for me" drafts from the re-encoded photo, category and notes
in the reporter's chosen language; "Fix spelling" corrects text without
translating it. The API calls the logical model `civiclens-compose` at the
dedicated in-cluster `civiclens-ai` gateway with a product client key; the gateway owns the
provider, quotas and model choice. Suggestions are never applied without the
reporter's tap and still pass normal description validation and human review.
Limits: 20 requests per account per 15 minutes per replica, 15 s deadline, 64 KB
reply cap. Logs record mode, language, latency and outcome, never text or photos.
When the gateway or key is missing, capabilities report `assist: false` and the
app disables the actions with an explanation; a gateway failure returns 503 and leaves the text as is.
Native keyboard spellcheck stays on for typing.

## Geography and responsibility

New reports request foreground device location automatically while the report
screen is active. Existing draft locations are preserved until the reporter taps
Update location. The native OS provides a high-accuracy fix; the app does not use
an IP-geolocation service or select coordinates from a VPN exit address. This
is not VPN detection or a guarantee against device-location spoofing. Browsers
choose their own geolocation provider; emulators use their configured simulated
location rather than the host computer's physical position.

Fixes must have valid coordinates, a timestamp within two minutes, and reported
accuracy of 100 metres or better. Location acquisition times out after 15 seconds;
address lookup times out after eight seconds and leaves town/country editable.
Permission denial and disabled Location Services show settings/retry actions.
Backgrounded or unfocused requests cannot overwrite a draft, and returning from
Settings retries a missing location. No background location permission is used.

Coordinates support any country. Device geocoding is a location suggestion,
confirmed by the reporter; it is not evidence of legal jurisdiction. Only a
reviewed, source-backed authority directory can route to an office. Match country,
category and GeoJSON boundary; refuse ambiguous matches. Entries expire. Include
municipality/police/department and optional parent offices (state leadership, CM,
etc.) only when their boundaries, responsibility, official account and sources
are verified. Parent escalation is an explicit moderator choice, not mass tagging.
No fabricated handles, assumed current officers, search-result scraping, or
countrywide claim of coverage. The pilot directory covers City of Melbourne waste
and litter only; see docs/authority-sources/README.md for evidence, expiry and
Australia/India expansion. Unverified previews distinguish missing country, area
or category coverage from records needing review (ADR-0004).

## Publication and failure behavior

Report submission commits before any social network I/O. Repeated submission
with the same owner/key/payload returns the original report; changed payload gets
409. Moderator approval requires a fresh authority match, reviewed public text,
and explicit visual privacy review of the metadata-stripped photo. Approval and
one job per selected channel commit atomically. Public captions use approximate
coordinates (2 decimals) and reviewed locality, never the original description.

Facebook Page publishing is opt-in and uses official Graph API photo upload.
Instagram and WhatsApp are explicitly blocked until suitable account access and
their workflows are implemented and verified; the queue never marks them sent.
A group invite URL is not API authorization. See integrations.md for requirements.

The outbox claims a job before I/O. Confirmed 429 may retry with bounded jitter;
network timeout, 5xx or a crash while sending become 'uncertain' and require manual
reconciliation, preventing blind duplicate public posts. Known permanent failures
become failed; missing channel configuration becomes blocked. Sent requires a
provider post ID. On restart, in-flight jobs become uncertain. Never assert
exactly-once delivery: the provider and Postgres cannot share a transaction.

When OAuth is down, login fails clearly and saved drafts remain. When geocoding
fails, coordinate capture still works and locality can be entered manually. When
authority data is missing/stale, accept the report for review and hold publishing.
When Meta is down, retain the outbox; it never blocks report creation. When the
database is down, writes fail; never return a fabricated receipt. Device retains
the draft and submission key for retry. Queued drafts are private and are not
silently sent after logout or to another account.

## Threat model and launch boundary

Assets: private provider subjects, session credentials, photos, exact location,
moderator authority, social credentials and the AI gateway client key. Attackers include unauthenticated
clients, other reporters, abusive uploaders and compromised moderators. Validate
all API boundaries; scope every report read to its authenticated owner, returning
404 otherwise. Moderator/operator endpoints require server-managed account roles; reporters
cannot self-grant roles. Runtime SQL credentials cannot edit role grants.
No general URL fetching or arbitrary remote image uploads. Limit bodies, decode
and re-encode actual JPEG/PNG/WebP input, cap pixels, strip metadata, deny CORS by
default, and rate-limit by connection IP. No request headers/bodies or coordinates
in logs. On-device app sandbox plus OS storage protection is not a guarantee of
anonymity on a compromised phone. Review faces, plates, minors and identifiable
allegations before publication. Reporting crimes does not establish guilt.

Local dev secrets can be set in an ignored .env; deployed secrets must be fetched
from OpenBao KV v2, using workload identity/namespace-bound readers and separate
environment paths. All secret identifiers are civiclens-prefixed. No GCP Secret
Manager application-secret fallback. No deployment or database migration is part
of this initial repo creation. Production requires independent moderator accounts,
append-only audit export, abuse controls, retention/deletion/export tools, photo
redaction, moderation operations, country-specific legal review and real device QA.
Deletion initiation uses a persistent authenticated request and the existing
Tesserix 30-day manual fulfilment model; see account-deletion-fulfilment.md.
Never collect real public reports until scoped erasure, provider cleanup and
backup expiry have been exercised end to end.

## Rollout and cost

Run locally with test provider apps and synthetic reports first. Back up the product database and capture schema state before a reviewed schema
change; migrations run only through the explicit administrator command. Restore local scratch database state to revert a development experiment.
Deleting local test data loses sessions/reports; no live deletion is authorized.
Future GitOps rollout needs a schema migration/rollback plan and explicit approval.
Development cost is local compute; production estimate at pilot scale: roughly
$50–150/month API/database plus photo storage/egress, provider charges and moderation
labor. This is an assumption for budgeting, not a quoted or provisioned service.

Authority preview uses the same verified directory as publication routing and
requires an authenticated, explicit lookup of the confirmed location. AI captions
are checked for respectful language before and after generation. The publisher
also checks the final caption and holds it when safety cannot be established,
including during a model outage. These controls do not replace photo privacy
review or platform-policy review; see ADR-0003 for boundaries and evaluation.
