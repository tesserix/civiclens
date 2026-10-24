# Photo location and contextual writing

Status: proposed for emulator QA; no live rollout.

At the existing pilot size (1,000 reports/day, 10× peak, at most 6 MB per sanitised
photo), keep location resolution on the device and reuse the existing authority
preview and writing endpoints. Vision retains its 15-second deadline and account
quota. A location lookup has an eight-second deadline. Native place search runs
only on an explicit search and returns at most three candidates.

For a new camera photo, collect foreground GPS while the native camera is open.
Accept only finite, in-range fixes with accuracy ≤100 m and age ≤120 seconds at
completion. Always stop the watcher, including cancellation, failures and late
startup. A simulator cannot establish real-camera capture accuracy; physical-device
QA remains necessary.

For a library photo, read only the selected asset's GPS metadata before resizing.
Validate signed decimal/DMS coordinates and hemisphere references. Metadata is
untrusted evidence, not proof of authenticity or capture location. Missing or
invalid metadata leaves a location choice; never silently use today's location
for an older upload. An explicit manual point overrides inferred locations.

Store only the chosen point, town/country and source in the private local draft;
do not retain raw EXIF, camera identifiers or original address-search text. The
server independently decodes/re-encodes the photo and strips metadata. Only town
and country go to the model. Exact coordinates drive reviewed-database routing.

Writing has serious, light-satire and balanced tones. Satire targets the situation
and public-service response with constructive action requests; unsupported blame,
private-person identification, profanity and harassment remain disallowed. Image
understanding does not replace moderator privacy review. New source inputs invalidate
old suggestions. Verified directory data supplies council mentions/tags; missing,
ambiguous or expired matches stay held. Parent escalation remains a moderator choice.

Camera/location failures leave manual reporting available. Native geocoding failures
retain a selected valid point and permit town/country correction. AI failures retain
written text. No photo, location or generated text is silently published.


Hashtags reuse the existing preview response and publication caption. Fixed
category topics come from the API enum; optional reviewed `topicTags` on authority
records supply city, region and country tags. This defaults to an empty list for
older records and needs no SQL migration. Validate at most eight ASCII hashtag
tokens per authority, each at most 80 letters/digits after `#`; reject mentions,
links and malformed tokens. Preview and caption share the same derivation. Editable
locality text and AI output never supply tags or handles. Missing/expired/ambiguous
routing supplies no office or place tags. This reuses the existing lookup, adds no
network calls and preserves the pilot latency/cost budget. API and seed changes
remain local until a specifically approved rollout.

The description tools expose shared, selectable hashtag suggestions without an
extra lookup. The private draft and report JSON preserve optional choices: omitted
means automatic, an empty array means none. The submission endpoint checks an
authenticated member's selection against current reviewed routing; approval checks
it again. Old clients omit this field, and new clients require `hashtagSelection`
before sending it. Changing location/category resets the selection; failures leave
the caption intact and offer retry. No database migration or extra provider cost.
