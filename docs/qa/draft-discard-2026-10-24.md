# Draft discard verification

The Report screen offers **Discard draft**, followed by **Keep draft** or
**Discard and start again**. Confirmation clears the local draft photo,
description, category, location source, hashtag selection, channels and consent,
and issues a fresh submission key. The original library photo, signed-in account,
writing-language preference and submitted reports remain intact. Device location
may be detected again for the new draft, following the existing location policy.

Storage writes are serialized. Reset invalidates pending autosaves and waits for
an already running save before removing its key. It removes only app-owned
`civiclens-photo-*.jpg` files directly inside the app document directory. A locked
SecureStore does not remove the photo; failed photo cleanup restores the saved
draft for retry. The form is locked during confirmation/reset and submission;
confirmation pauses location acquisition. A fresh form unmounts old writing and
place-picker state, and old photo/authority operations are invalidated.

Threat boundary: private photos, text and precise location belong to the current
local account. A stale asynchronous write or a malformed persisted URI must not
restore discarded content or delete arbitrary files. The cleanup checks the exact
app-owned directory and filename pattern. This feature changes no API endpoint
and does not authorize deletion of submitted reports or server-side data.

## Checks

- `npm run check`: 95 tests passed, TypeScript and ESLint passed.
- `npx expo-doctor`: all 21 checks passed.
- `npm run export`: iOS, Android and web exports passed (build validation only).
- Tests reproduced missing cleanup and the outstanding-save race before the fix.
  Screen integration covers cancellation, reset, fresh input, reopening, failed
  storage deletion and retry. Hook tests cover key regeneration, all field resets,
  file ownership and rollback when cleanup fails.
- iPhone 17 Pro Max simulator, iOS 26.5: existing photo retained on Keep draft;
  confirmed discard returns to the photo picker with empty description and
  consent off. Termination/relaunch keeps the discarded draft cleared. A library
  photo can be selected again after reset and discarded again.
- Native testing used the existing local QA API adapter, which blocks report and
  account writes; no public report or social post was submitted. No API rollout
  or database migration is needed. Physical-device testing remains separate.

User preference: use Apple simulators only; do not use Android emulators.
Release target: iOS 0.1.4 via the repository TestFlight workflow; EAS assigns the
remote build number. Build/submission evidence is recorded in GitHub Actions.

## Signed release evidence

PR #8 merged as `19f7dc5b7186ac2209a6fbe471eabc7150397058`; every applicable
PR CI check passed, including mobile, Rust/database, contracts, bundles,
container scan and secret scans. The TestFlight workflow's validation passed,
but its submit job stopped because GitHub has no `EXPO_TOKEN`. The authenticated
EAS cloud build was blocked by the account's exhausted included build credits.
No plan upgrade or credential rotation was performed.

The existing documented local EAS/Xcode signing process built the exact merged
commit as **0.1.4 (10)**. Verification checked the bundle/team identity, App Store
profile, signature, debugging disabled, production HTTPS API URL and reset UI
strings inside the packaged bundle. IPA SHA-256:
`79ca0b5b85b77ae5254320faccf8eae7ae9d1ae6f2493782937e163bf828b94f`.
The exact verified IPA was uploaded successfully through EAS submission
`78e47bf5-bfde-4b3e-9b3e-795f071302c6` to App Store Connect app `6825667307`.
Local release logs and receipts are in `artifacts/qa/testflight-0.1.4/` (ignored).
The GitHub Expo token remains a separate automation setup item; this release
used the existing authenticated local signing/submission path.

Apple build `882d1c99-3cd3-4802-9c0d-dc350b751545` was verified at
2026-10-24 11:49 UTC as **VALID / IN_BETA_TESTING**, available in both existing
`Internal Testing` and `CivicLens Internal` groups with the existing tester
present. Release notes describe the discard flow. No new tester invitation or
external/public release was made. Physical-device installation is not confirmed.
