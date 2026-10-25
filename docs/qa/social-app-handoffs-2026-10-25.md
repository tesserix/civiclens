# Sequential social app handoffs — 2026-10-25

## Change and scope

The report sharing screen now shows one selected destination at a time.
Previous/Next navigation preserves the selected app order and each platform's
reviewed caption. The system share menu receives all reviewed JPEGs and caption.
Every destination also has an explicit combined save/copy/open action, with
individual retry controls. Saved photos are reused across destinations.

Facebook, Instagram and WhatsApp have native launch schemes and iOS availability
queries. TikTok retains its HTTPS destination and may open its app or website.
There is no silent consumer-account API publishing or provider delivery receipt.
Opening an app alone does not attach media or paste text. The user finishes the
post inside that app. Photo, caption and verified-authority review remain required.

## Automated validation

Regression tests first failed because the three original destinations lacked
native launch/save/copy controls; two further tests failed because no sequential
queue or combined action existed. They passed after implementation.

Commands run:

- `npm run check`: all 39 suites / 206 tests, TypeScript and ESLint passed.
  Sharing coverage includes five-photo payloads, per-app captions, queue order,
  missing apps, permission denial, partial saves, cross-destination reuse,
  changed content, revoked approval, final review withdrawal and account changes.
- `npx expo-doctor`: all 21 checks passed.
- `npm run export`: iOS, Android and web exports passed.
- `node --test scripts/ci/*.test.mjs`: release/privacy/authority checks passed.
- `cargo test --locked -p civiclens-api`: 37 tests passed; 20 database tests
  were then run explicitly against isolated local Postgres and all passed.
- `cargo fmt --all --check`, `cargo clippy --locked --all-targets -- -D warnings`
  and `cargo build --locked -p civiclens-api` passed for the carried-forward
  compliance work. No new sharing endpoint or migration was added.
- `npx expo prebuild --platform ios --no-install` and an iOS simulator build
  passed. The generated plist contains only `fb`, `instagram`, `whatsapp`
  social query schemes; existing storage/read permission blocks remain.

## Native exercise

Rebuilt the development client for the existing iPhone 17 Pro Max, iOS 26.5.
Used a clearly labelled synthetic report in local Postgres with independent
moderator approval, a loopback API and a synthetic safety dependency. No real
report, public post, official complaint or production service was modified.
Local storage advertises one photo; five-photo behavior is covered by automated
mobile and API/object-storage contract tests, not claimed from this simulator run.

Verified all-four selection, destination order, caption/hashtags preview, native
share-sheet presentation and cancellation, continued Instagram step after cancel,
add-only photo save, caption copy, and continuing to WhatsApp then TikTok. Missing
Facebook showed an unavailable-app explanation before exporting any copies.
The same saved photo was reused for the next destination.

Local evidence: `/tmp/civiclens-sharing-sequence-20261025.png` and the
`/tmp/civiclens-sharing-*-20261025.log` validation logs. Synthetic report fixtures
and private local principals remain under ignored `artifacts/qa/`.

## Release boundary

No Android emulator was used. No cloud rollout, production migration, store
release or new TestFlight upload was performed. Native changes use runtime
`1.0.0-social-handoffs-2`, iOS build 15 and Android version code 6.

The simulator has no Facebook, Instagram, WhatsApp or TikTok installation.
Actual native app launch, account/destination selection, attachment acceptance,
caption behavior and final posting must be checked on physical devices before
public release. A report pending privacy/authority review remains on hold.
Existing TestFlight build 14 does not include these fixes.
