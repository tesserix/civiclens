# CivicLens

Expo Router mobile app and a Rust/Axum API. Follow the parent working agreements.
Read docs/architecture.md before changing authentication, routing or publishing.
Run npm run check, npx expo-doctor and npm run export before delivery.
Never put provider access tokens or real names in reports, captions or client logs.
Google/Facebook identify accounts privately; only unique nicknames are public.
An unverified authority or unreviewed photo must never reach a social publisher.
Use OpenBao for all deployed application credentials, with civiclens-prefixed
identifiers and separate development/UAT/production paths. No live cloud changes.


## Captions and automatic tagging

Follow the caption style and tagging rules in docs/architecture.md.
Offer Serious, Light satire and Balanced tones in the preferred language.
Use natural, human phrasing and everyday English; retain useful detail rather
than forcing shorter captions. Humour should be witty, clear and constructive.
Keep profanity, privacy, factuality and human-review safeguards in every tone.
Derive issue hashtags on the server and city/region/council tags from reviewed
directory data. Mention only verified relevant accounts; never invent groups,
handles, officials, responsibility or blame. Recheck tags when category/location changes.
Show selectable hashtag suggestions beside generated prose and in Description.
Persist the selected subset separately; explicit Clear means no hashtags.
Reset on context changes and validate again against reviewed routing on the server.
Label model fixtures explicitly and never present emulator fixtures as live AI results.
