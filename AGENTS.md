# CivicLens

Expo Router mobile app and a local Node.js API. Follow the parent working agreements.
Read docs/architecture.md before changing authentication, routing or publishing.
Run npm run check, npx expo-doctor and npm run export before delivery.
Never put provider access tokens or real names in reports, captions or client logs.
Google/Facebook identify accounts privately; only unique nicknames are public.
An unverified authority or unreviewed photo must never reach a social publisher.
Use OpenBao for all deployed application credentials, with civiclens-prefixed
identifiers and separate development/UAT/production paths. No live cloud changes.
