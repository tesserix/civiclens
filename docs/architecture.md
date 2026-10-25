# CivicLens pilot architecture

## Product contract

Sign in with Google or Facebook; choose a unique public nickname or receive one
automatically. Photograph a civic issue, confirm GPS/location, choose a category,
and submit. Reports are private until reviewed. Managed posting publishes as CivicLens, crediting the nickname only. User sharing
hands an approved caption and reviewed photos to the phone’s share sheet; the
external app controls sender identity and may show a profile name, username or
phone number. This is public pseudonymity: the service knows the
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

## Photo location

Before resizing a selected photo, read only its validated GPS metadata. Camera
capture samples fresh foreground device GPS while the native camera is open.
An explicit user-selected point takes precedence; a gallery photo with no usable
GPS clears an unrelated device point and asks for a location. Native place search
moves the point used for council-boundary routing. Editing town/country labels
alone does not move it. Precise coordinates remain private; writing assist receives
only the chosen town/city and country. See ADR-0006 for deadlines and failure paths.

## Writing assist

Optional help with the description, through the Tesserix private AI gateway
(ADR-0003). "Write it for me" drafts from the re-encoded photo, category and notes
in the reporter's chosen language; "Fix spelling" corrects text without
translating it. The API calls the logical model `civiclens-compose` at the
dedicated in-cluster `civiclens-ai` gateway with a product client key; the gateway owns the
provider, quotas and model choice. New clients offer Serious, Light satire and Balanced tones when `assistContext`
is advertised. Omitted tone defaults to Serious. Humour remains factual, constructive
and free of personal attacks or unsupported blame. Draft replies must explicitly
confirm the selected issue is visible and identifying details are absent; missing
or malformed verdicts fail closed. Model checks cannot establish photo authenticity
or replace human review. Verified routing records supply authority mentions and
topic tags separately from generated prose. Suggestions are never applied without the
reporter's tap and still pass normal description validation and human review.
Limits: 20 requests per account per 15 minutes per replica, 15 s deadline, 64 KB
reply cap. Logs record mode, language, latency and outcome, never text or photos.
When the gateway or key is missing, capabilities report `assist: false` and the
app disables the actions with an explanation; a gateway failure returns 503 and leaves the text as is.
Native keyboard spellcheck stays on for typing.

### Caption style and tagging rules

All drafting tones use the reporter's preferred language. English should sound
like a local person talking: familiar words, natural contractions and readable
sentences. Keep useful visible detail; a caption need not be shortened for humour.
Avoid stiff official phrasing, forced jokes and stock slogans. Serious stays clear
and direct; Light satire can be noticeably funny and playfully sarcastic about
the mess; Balanced combines a witty observation with facts and a serious request
for action. Encourage shared responsibility without identifying or inventing a
culprit. Criticism of service delivery must not invent a history of neglect or blame.

For example, a litter caption could say: “Lovely, the grass has started its own
rubbish collection. Blue and white litter is scattered around this patch of
Melbourne, giving the place a look nobody ordered. Can we get a clean-up here?
And for the next round, let’s give the bins a go.” This is a style example, not a
verified incident. Describe only supported details in an actual report.

The model writes prose; it must not invent hashtags, mentions, council names or
contact details. The API separately adds fixed issue-topic hashtags and the
matched authority's reviewed topic tags and name hashtag. Reviewed topic tags
cover applicable city, region and country identities. Do not derive city tags from
an editable locality label, scrape result or model guess. The same helper supplies
the preview and reviewed public caption. No verified match means no authority or
place tags. Relevant groups, agencies, ministers and mayors require reviewed
responsibility and account evidence before mentions; parent escalation remains a
moderator decision. Hashtags are topic labels, not proof that an account was
notified or a Facebook group received the post.

The Description section and generated suggestion both offer the same tappable
hashtag choices, with Select all and Clear. Choices are stored privately with the
draft and report, separately from prose. An omitted selection uses automatic tags;
an explicit empty list means no hashtags. Changing category or location resets
choices. Retry and fresh lookup reconcile choices against current reviewed tags.
The `hashtagSelection` capability gates clients sending explicit choices. The API
rejects malformed, duplicate or out-of-route tags on submission and re-filters
choices against fresh routing on approval. Verified account mentions remain
separate. Reports use their existing JSON storage; no schema migration is needed.

Every tone retains profanity/harassment checks, photo privacy checks, factuality,
reporter approval and moderator review before publishing. Exact coordinates stay
out of model context and public hashtags. Emulator fixtures must be visibly labelled
and their results kept distinct from live-provider evaluation.

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

PostgreSQL now retains immutable authority-source imports and record history
(ADR-0005). Free national reference data is kept separate from reviewed routing
data. The API loads only the current reviewed source at startup; reference
imports cannot become routing records. Source hashes, licences, retrieval times,
regional coverage gaps and old versions remain available for maintenance. See
docs/authority-sources/australia.md for refresh and verification procedures.

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

### User-owned communities

ADR-0008 adds user-owned sharing without changing broker sign-in. The new UI
offers no CivicLens country-Page mode. Old managed drafts require fresh consent
and a submission key when restored into the user-owned flow.
An owner-only export repeats all-photo approval, current authority and content
safety checks. Manual approval creates no outbox jobs and needs no country Page
token. Nicknames remain in captions; users acknowledge external identity visibility
before preparation and the final handoff. Users create/administer communities in
the destination app. Native completion is never recorded as provider delivery.
Google/Facebook/Apple sign-in remains private; there is no automatic email linking
or invented consumer WhatsApp login. Automated user-owned Page/professional-account
publishing still needs Meta authorization and owner-scoped OpenBao credentials.

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

## Civic participation and official complaint preparation

ADR-0009 adds account-backed requests, independently moderated opinions and timed
Yes/No/Don't know polls. There is no money or wagering. One account has one current
response per card; account uniqueness does not establish unique people or electoral
eligibility. PostgreSQL checks deadlines after locking the card. Interim poll
counts remain private; final totals include all three choices and disclose rounding.
New-client capabilities hide these features against the older released API.

The directory browser exposes source-backed reference identities with provenance,
licence and explicit API-unknown status. See
[the multicountry audit](authority-sources/multicountry-2026-10-25.md) for actual
counts and gaps. These records do not expand the verified routing directory.

A reporter can select official complaint preparation with or without social apps.
No complaint is automatically filed. Owner-scoped preparation repeats current
all-photo, rules and authority checks, requires separately reviewed factual text
(`complaintDescription` and `complaintFactualReviewed` on independent report approval),
and rechecks content safety. Social humour is not reused as complaint prose.
The package excludes original metadata, precise coordinates and private sign-in
identity. The user confirms destination/data and explicitly opens the official
form or saves evidence. They supply any required identity directly to that service.
Preparation and `handoff_requested` are persisted and audited, never labelled an
official receipt. Each export/open rechecks current channel expiry and review;
retries cannot create duplicate destination intents. No government API credentials
are collected until a real documented, authorized integration exists.

The `/sign-in` route is explicit because `/` also identifies the capture tab.
Authenticated community links are strictly allowlisted, remembered through sign-in
without credentials in AsyncStorage, and cleared on arrival. Sign-out removes
SecureStore credentials and private query data before best-effort server revocation;
if that server call fails, the user sees that the old session expires automatically.
A device-storage failure leaves the session visible for retry. Drafts remain scoped
to their original account. Export/erasure must include participation and complaint
records; see the fulfilment runbook. No new expansion migration or rollout is live.

## Reusable official complaint gateway

ADR-0010 adds country/region-neutral provider discovery, a pinned administrative
reference catalogue, readiness checks and private owner-scoped internal requests.
The first catalogue covers India's 36 states/UTs and 784 administrative districts;
Tamil Nadu and MP have separately scoped documented provider candidates. LGD
references are never provider police identifiers. Invalid cross-region/country
selections are rejected. Unknown providers have no fabricated coverage, and
reference/contract expiry are explicit.

Migration 0010 stores blocked request snapshots and report/account references.
Same-key retries are transactional; quotas are checked under a database lock.
Composite ownership constraints prevent linking another account's report. A
database check forbids snapshots claiming dispatch readiness. No legal identity,
original evidence, external token or duplicated caption is collected by this API;
there is no government client/worker. Publication review and municipal official
form handoff retain their existing behavior.

The [API guide](india-crime/api.md) covers endpoints, pagination, provider
registration and first-adapter prerequisites. Internal IDs are not official
complaint numbers. Authorized provider access, verified police mapping, evidence
and identity contracts, independent review, receipts and timeout reconciliation
remain required before an adapter or live rollout. Migration 0010 has only been
exercised on isolated local schemas.

## Account profiles and live typography

ADR-0013 adds owner-only photo/bio editing. The photo and bio are never included in
public report captions, community payloads or social exports. Profile metadata
comes from `/v1/me/profile`; photos are stripped and resized to 256 px. Optional
import candidates come only from verified broker `picture` claims after the OIDC
`profile` scope and are fetched only on an explicit import action. Missing claims
leave device photo selection available. No additional deployed credentials are
created.

Shared display text observes system font scale through TypographyProvider. Only
native text nodes remount when Dynamic Type changes; fields, draft state, routes
and editor state remain mounted. This fixes stale native text measurements that
left huge blank areas after restoring normal text size. Community lists no longer
need to remount their entire contents for a font-scale change.

### TikTok reviewed export

ADR-0014 extends user-owned sharing to TikTok with capability-gated selection,
a native chooser and explicit save/copy/open fallback. TikTok is manual only;
independent review and owner-scoped fresh exports apply before every action.
No managed TikTok publishing or provider delivery receipt is supported. Native
photo copies remain under user control, including device photo backup settings.

ADR-0016 extends save/copy/open controls to every selected social app. The system
share menu is labelled explicitly. Facebook, Instagram and WhatsApp have separate
native launch actions; unavailable apps show a retry/install explanation. TikTok
uses its HTTPS link and may open the app or website. Opening an app does not attach
photos or paste text. Users finish each post in that app. Confirmed photo saves
are reused across destinations on the same screen, with add-only Photos access.
No personal-sharing clearance bypasses independent photo or authority review.
Selected destinations appear one at a time with Previous/Next navigation. A
combined action saves reviewed photos, copies the caption and opens the chosen
app after another server review check. Returning from an app never advances
automatically or means a post was delivered. Partial saves, missing apps and
withdrawn approval stop the action; individual steps remain retryable.
