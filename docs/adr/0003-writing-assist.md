# Writing assist through the private AI gateway

Reporters can ask for a drafted description ("Write it for me") from the photo,
category and optional notes in their chosen language, or a minimal spelling and
grammar correction ("Fix spelling") that keeps the original language. Both return a
suggestion the reporter must accept; nothing is rewritten silently and the
moderator still writes the reviewed public text before any publication.

Pilot sizing inherits architecture.md: 1,000 reports/day with about two assists
each is 0.25 requests/sec at 10x peak. Input is at most 1,000 characters plus one
re-encoded JPEG of 1024 px or less (typically under 300 KB); output is at most
1,000 characters. Nothing is stored. Target p99 under 15 s, bounded below the
router's 20 s timeout and the mobile 25 s deadline. Assist is optional: report
submission never calls it.

The API calls a dedicated `civiclens-ai` gateway with the OpenAI-compatible
`/v1/chat/completions` contract Roamie and Kora already use, sending the logical
model `civiclens-compose`. The shared `ai-gateway` is DevAI's and its mesh policy
denies other callers, so CivicLens follows Roamie's per-product gateway. The
gateway pins the concrete Vertex model and reaches it through Workload Identity.
CivicLens sessions are opaque and the API keeps no broker tokens, so the gateway
authenticates the workload with a client key (Kora's `apiKeyAuthentication`
pattern) read from OpenBao as `civiclens-ai-gateway-key`, and the mesh admits only
the `civiclens-api` service account.
Switching to a Zitadel machine identity later only changes one request header.
Production accepts only the private in-cluster gateway URL; development also
accepts a loopback URL for a local mock or port-forward.

Auto-correction uses two layers. The native keyboard's spellcheck and autocorrect
stay on while typing: instant, on-device and free for every keyboard the reporter
has installed. Model correction is explicit and on demand. We rejected
correcting on every keystroke, which would send each edit off the device, cost a
model call per pause and move text under the cursor. We also rejected
LanguageTool-style rule engines, which cover only part of the required languages
(no Odia, Thai or Korean grammar).

Threats: a reporter injecting instructions through notes or text in a photo can
only change their own suggestion, which they review and a moderator reviews
again. Prompts forbid identifying people, plates or homes, and forbid invented
facts, mentions, links and contact details. Output must pass the same 10–1,000
character description validation as a report. Each account is limited to 20
assists per 15 minutes per replica, and the gateway applies its own rate and
token limits. Photos are re-encoded and stripped of metadata before forwarding.
Logs record mode, language and latency, never text or images.

When the gateway is unconfigured, capabilities report `assist: false` and the app
disables the actions with an explanation. When it is slow, down or returns invalid output, the endpoint
answers 503 within the deadline and the reporter keeps writing manually. A
missing key disables assist without stopping the API.

Rollback is removing `CIVICLENS_AI_GATEWAY_URL`; the contract change is additive.
Model cost at pilot volume is roughly 2,000 small multimodal calls a day on a
flash-class model, single-digit US dollars a month, an estimate to verify against
gateway usage telemetry. No new service, queue or table is introduced.

## Verified authority preview

`POST /v1/authorities/preview` accepts a category and reporter-confirmed location,
requires a normal CivicLens session, and performs a read-only lookup against the
same reviewed directory used at publication. It returns either one unambiguous,
unexpired jurisdiction match with official/source URLs and channel-specific
handles, or `unverified` with no handles. Missing coverage, overlapping matches,
wrong categories and expired records must not become AI guesses. This lookup
makes no model or external HTTP calls, stores no location, and inherits the API
request limits. It adds no database migration or infrastructure. The directory
still requires separately reviewed records; the initial empty directory is not
worldwide coverage.

The reporter explicitly requests the lookup after checking location, can inspect
its sources and acknowledge the offices for the current draft. This is a preview,
not permission to publish or a persisted routing override. The server rechecks
jurisdiction, expiry and photo review during moderator approval. Changing location
or category discards the preview, including late responses. Topic hashtags stay
separate from verified @mentions; platform support determines whether a mention
actually tags or notifies the office.

Caption suggestions require a factual/privacy check before Use this. Editing the
source draft, replacing a photo or changing language invalidates the suggestion;
a late response cannot overwrite newer work. The model's output is rejected if
it includes mentions, hashtags or URLs. This does not certify an image as safe:
the reporter must crop/replace identifying photos, and moderator review still
applies. No automatic redaction or identity detection is claimed.

Capabilities advertise `authorityPreview` separately from `assist`. Older APIs
and unconfigured gateways show explanatory unavailable states while manual
reporting remains usable. The mobile app can roll out before the API. Authority
lookup failure permits retry and never manufactures a match; model failures leave
the original description intact. Rollback is removing the new API route/flag;
there is no stored state to migrate. Live activation requires the approved API
rollout, gateway configuration and verified authority data in the owning GitOps
repository; changing the simulator does not deploy them.

## Respectful-language and publication safety

The reporter's non-empty notes are checked before generation; the resulting text
is checked again by a separate classifier request before it can reach the app.
Both the drafting and correction prompts prohibit profanity, slurs, insults,
harassment, threats, explicit sexual content and encouragement of harm. The
classifier policy covers all languages, mixed languages, transliteration,
obfuscation, leetspeak, homoglyphs and zero-width characters. Quoted offensive
language is rejected too. Neutral descriptions of civic hazards and respectful
criticism of public services are allowed. The classifier treats all submitted
text as data and rejects instructions to bypass its policy.

Only an explicit, strictly parsed `{"safe":true}` verdict passes. Unsafe text
returns HTTP 422 / `CONTENT_REJECTED` with a neutral rewording instruction, never
an echo of the offending text. Missing configuration, timeout, transport errors
and malformed verdicts fail closed. Input check, generation and output check
share the existing 15-second total assist deadline. Responses remain capped at
64 KB and no text, photos, verdict explanations or private identifiers are logged.

The publisher independently checks the final assembled caption, including the
reviewer's edits, locality, nickname and verified handles, immediately before a
Facebook request. This protects queued captions created before these checks and
operator retries. Rejected captions are held as `blocked`; unavailable safety
checks also hold the job. Nothing is sent in either case, and operator retry
cannot bypass the check. Manual private reporting remains available without AI;
moderator approval alone cannot bypass the final publication check. Safety-model
failure never becomes permission to publish. The existing visual photo review
is still required; this text classifier does not certify image safety.

Tests use a controlled external gateway to verify input/output boundaries,
strict verdict parsing, unchanged drafts and real-database publication holds.
They do not establish a classifier's multilingual accuracy. Before enabling live
publishing, evaluate the configured model on representative allowed and blocked
examples in each supported language (including obfuscation), review false
positives/negatives, and review the current platform policies. Model screening
and human review reduce risk; they are not a guarantee or certification of
social-platform compliance. Keep blocked text out of analytics and user-facing
errors, and use synthetic evaluation examples.

Capacity now includes up to three model calls per assist (input screening,
generation, output screening), plus one per actual publication attempt. At 2,000
assists/day this is up to 6,000 small model calls/day before publication checks;
measure gateway latency, quota and actual spend before rollout. No new service,
credential or database table is introduced. Reverting this change removes the
publication safety gate, so keep publishing disabled during any rollback until
the replacement safety control is verified.
