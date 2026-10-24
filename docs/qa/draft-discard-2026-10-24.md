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
