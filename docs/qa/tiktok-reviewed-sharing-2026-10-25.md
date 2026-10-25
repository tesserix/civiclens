# TikTok reviewed-sharing QA — 2026-10-25

Local worktree: `civiclens-civic-participation`, branch `feat/civic-participation`.
No commit, push, cloud mutation, migration, TestFlight upload or public release.

## Implemented scope

Manual TikTok destination, capability-gated capture selection, all-four selection,
owner-only reviewed packages and native OS chooser. Explicit save/copy/open
fallback; no direct TikTok SDK/API publishing. Current review, identity disclosure,
caption/hashtag and photo safeguards remain. No new credentials. See ADR-0014.

## Red → green

- Capture tests first failed because no TikTok checkbox or unsupported-draft notice
  existed. They now cover all-four manual submission and preserved/blocked drafts
  against older servers.
- Native-sharing tests first failed because fallback controls did not exist. They
  now cover add-only permission denial, ordered five-photo saving, cleanup,
  retry after partial failure, confirmed-save deduplication, account change during
  a save, fresh-review rejection for each action, changed caption, open failure,
  all-photo chooser payload and unverified delivery.
- Real SQL/API integration first rejected the new TikTok enum (422). After the
  enum/validation changes, corrected a fixture case which inherited manual mode
  instead of omitting it. Managed and omitted-mode TikTok requests now return 400;
  manual all-four submission/independent approval creates zero publishing jobs.
  Wrong owner, missing acknowledgement, pending review, expired authority and
  unauthenticated access cannot export the TikTok package.

## Checks actually run

- `npm run check`: 38 suites / 177 tests; typecheck and ESLint passed.
- `npx expo-doctor`: 21/21 checks passed.
- `EXPO_PUBLIC_API_URL=https://civiclns-api.tesserix.app npm run export`: iOS,
  Android and static web exports passed.
- `node --test scripts/ci/*.test.mjs`: 10 passed, including permission assertions.
- `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo build`:
  passed.
- `cargo test`: 37 passed; 17 database tests intentionally require explicit opt-in.
- With `CIVICLENS_TEST_DATABASE_URL` pointing to isolated localhost:55439 UTF8 QA
  database, `cargo test -- --ignored --nocapture`: all 17 passed.
- `git diff --check`: passed.
- `npx expo prebuild --platform ios --no-install` then `npx expo run:ios --device
  CD3A52F1-275E-482A-82B6-089BBBF9791D --no-bundler`: fresh build 14 succeeded,
  installed and ran on iPhone 17 Pro Max / iOS 26.5. Two upstream build warnings,
  including duplicate libc++; zero errors. Initial command with both --port and
  --no-bundler was rejected; reran with compatible arguments. Selected existing
  Metro server 8100; local API 8098, publishing disabled.

## Native evidence

A visibly labelled synthetic litter report was created through the local API,
visually checked for identifying details, and approved using a separate local
moderator. The external safety boundary was explicitly synthetic, not live AI.
The app remained connected to the real local Rust API and isolated Postgres.

- Capture shows TikTok as a selectable destination.
- Reviewed report shows TikTok, nickname-only caption and reviewed location tags.
- Actual iOS prompt says “would like to add to your Photos”; no library read
  request. Allowing add-only access returned “1 of 1 reviewed photos saved”.
  Opened Photos and visually verified the newest saved JPEG was intact, with
  the current save time and no identifying details.
- Actual native Clipboard call returned “Reviewed caption copied”.
- Native share menu opened with caption and Save Image action; cancelled without
  publishing. Return state explicitly says delivery unverified.
- Open TikTok opened Safari at `tiktok.com`, without sending report data to it.

Screenshots and logs are in ignored `artifacts/qa/civic-participation/tiktok-*`.
Local-only fixture helper and receipt are ignored; no credentials appear in this
record. Report reference starts `01a17125`.

## Remaining physical-device gate

TikTok is not installed in the simulator. Actual TikTok attachment acceptance,
caption paste, account selection and final posting are not verified. A physical
phone with TikTok is required. Android export and permission checks passed; no
Android emulator was started, per project instructions. Android 13+ native gallery
saving remains device-unverified; older Android uses chooser save actions. This
is user-confirmed manual sharing, not automated provider delivery or registered
TikTok Share Kit/Content Posting API integration.
