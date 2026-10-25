# CivicLens

Expo Router mobile app and a Rust/Axum API. Follow the parent working agreements.
Read docs/architecture.md before changing authentication, routing or publishing.
Run npm run check, npx expo-doctor and npm run export before delivery.
Never put provider access tokens or real names in reports, captions or client logs.
Google/Facebook identify accounts privately; only unique nicknames are public.
Managed publishers require independent photo/authority review. User-owned native
sharing requires the reporter’s explicit all-photo/caption and identity confirmation;
it does not require moderator approval. Keep automatic language/privacy safeguards.
Use OpenBao for all deployed application credentials, with civiclens-prefixed
identifiers and separate development/UAT/production paths. No live cloud changes.


## Captions and automatic tagging

Follow the caption style and tagging rules in docs/architecture.md.
Offer Serious, Light satire and Balanced tones in the preferred language.
Use natural, human phrasing and everyday English; retain useful detail rather
than forcing shorter captions. Humour should be witty, clear and constructive.
Keep profanity, privacy, factuality and reporter-confirmation safeguards in every
tone. Independent moderation remains for community content and managed publishing.
Derive issue hashtags on the server and city/region/council tags from reviewed
directory data. Mention only verified relevant accounts; never invent groups,
handles, officials, responsibility or blame. Recheck tags when category/location changes.
Show selectable hashtag suggestions beside generated prose and in Description.
Persist the selected subset separately; explicit Clear means no hashtags.
Reset on context changes and validate again against reviewed routing on the server.
Label model fixtures explicitly and never present emulator fixtures as live AI results.

## Device verification

Use Apple simulators for app verification. Do not start or use Android emulators.

## User-owned sharing and release gate

New report flows use users' own social accounts and communities; do not offer
CivicLens country-Page posting controls. Allow one, several or all destinations,
with an explicit native handoff for each and no invented delivery receipt.
Keep real names out of CivicLens captions; explain the external platform's
sender identity before sharing. Do not require moderator approval for sharing to the reporter’s own accounts.
Keep independent review for managed publishers and official complaints.
Use real API-connected builds for TestFlight. Do not ship demo paths or fixtures.
Public Apple App Store and Google Play releases require the user's explicit
confirmation after their TestFlight testing. TestFlight approval is not approval
for a public store release or an unapproved backend migration/cloud rollout.


## Selection controls

Use the shared native single-choice dropdown for compact form choices and filters.
Use SocialDestinationSelect for social app multi-selection in capture and reviewed
sharing; keep Select all/Clear inside its native sheet, with Cancel and explicit
Done. Preserve existing choices on cancellation and prevent stale native callbacks
from applying to a changed form. Keep touch targets at least 44 points, allow text
to wrap, and keep sheet content scrollable at large accessibility sizes. Check
related selection controls for the same inconsistency when refining a screen.
