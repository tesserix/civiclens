# Android release verification — 25 October 2026

## Candidate and native regression

The production bundle is CivicLens 1.0.0, Android version code 8, package
`app.tesserix.civiclens`. SHA-256:

`ef0b30a0c5a79ea960286e846a07f0307332ad11b6eaac36d9fea32a3ace18e0`

The signed AAB passed `jarsigner -verify` and bundletool validation. Emulator
APKs were generated from that exact bundle with the local debug signing key;
they are QA artifacts, not the bundle uploaded to Google Play.

A fresh Google Play ARM64 API 36 emulator reproduced a truncated Facebook label
at 1600×2560, density 240. Adding text padding in candidate 7 did not fix it;
that candidate must not be released. Giving the label available flex width in
candidate 8 fixed the native rendering while retaining wrapping. The sign-in
column is capped at 680 dp on wide displays. The 1080×2424 phone layout and the
previously failing density were inspected visually. Screenshots are kept under
ignored `artifacts/releases/1.0.0-android8/screenshots/`.

The initial renderer stalled when viewport checks overlapped installation.
Only the verified CivicLens emulator was restarted, with explicit SwiftShader
and Vulkan disabled. Subsequent installation verification and screenshots were
performed sequentially. Display size, density and font scale were restored.
Helivanta project files and runtimes were not targeted.

## Commands run

- `npm run check`: 39 suites / 206 tests, TypeScript and ESLint passed after the
  final mobile layout change. Existing React test `act` warnings were emitted.
- `npx --yes expo-doctor`: 21/21 passed.
- `EXPO_PUBLIC_API_URL=https://civiclns-api.tesserix.app npm run export`: iOS,
  Android and web exports passed.
- `node --test scripts/ci/*.test.mjs`: 10 checks passed.
- `cargo test --locked -p civiclens-api`: 38 passed. The 20 existing database
  tests were not rerun locally for the static page/header change; PR CI runs
  isolated database coverage.
- `cargo fmt --all`, `cargo clippy --locked --all-targets -- -D warnings`, and
  `cargo build --locked -p civiclens-api`: passed.
- The public-policy header test failed first because `Cache-Control` was absent,
  then passed after `no-transform` was added. Cloudflare documents this header
  as preventing email obfuscation; the strict existing CSP is retained.

## Policy rollout and review access

The owner approved publishing child-safety standards and confirmed that the
existing contact is ready. PR #19 merged as `3981336`; its API image pipeline
`40175984633` passed, including published-image database/TLS smoke verification.
GitOps deployed digest
`sha256:b73ac83c1ec06a48d0081dab9e9eec90b3fdb6f02d39c233f468c08e8dfc92d1`.
Argo was Synced/Healthy, with two ready replicas and zero restarts. The public
terms contain the child-safety section. No migration was added.

Google Play's private reviewer-access fields now contain the dedicated QA
Google account and login steps. The optional trusted-partner-device feedback
switch is off. No credential values belong in this document or screenshots.

## Authenticated Android checks

A fresh secure sign-out and Google sign-in selected the dedicated QA account
from Google's real account chooser and returned to the authenticated report tab.
The public nickname remained unchanged. Account/profile controls, the report
form, empty report history, community discovery and request composition rendered.
The native Browse and Request type dropdowns opened, and the Android photo picker
handled an empty device library. These are UI checks, not proof of image upload,
AI generation, moderation or social delivery on Android.

Four unedited 1080×1920 screenshots were captured for the Play phone listing.
That temporary size caused black bands inside the taller Pixel emulator skin;
`adb -s emulator-5554 shell wm size reset` and `wm density reset` restored its
native 1080×2424, density 420 display. Full-height captures confirm the app fills
the display. The ignored release directory contains the screenshots and
`authenticated-qa-receipt.json`.

Production checks after PR #20 still returned `Cache-Control: no-store` and
obfuscated email links: the response-protection middleware overwrote the legal
handler's header. A regression test through the real router failed with
`Some("no-store")` instead of `Some("no-store, no-transform")`. The middleware
now preserves no-store protection and prevents edge transformations on legal pages;
private and other API responses retain their existing `no-store` header.
The router test also checks all three legal pages, unauthenticated account
access, health and not-found responses, preserving CSP and nosniff. Local Rust
checks passed: 39 tests, with 20 database tests still reserved for CI, plus fmt,
Clippy and build. This correction is prepared for a separately approved rollout;
it is not yet a verified production fix and does not resolve BIC's 403 response.

## Remaining release gates

- Google login and the authenticated UI checks above passed. Android image
  upload, AI assistance and reviewed social handoffs still need end-to-end QA.
- Google's URL validator and a Python HTTP client receive Cloudflare error 1010
  for the public deletion page, while curl/browser requests succeed. Zone
  Browser Integrity Check is enabled. A proposed exception is restricted to
  GET/HEAD requests on this CivicLens host's three legal-page paths and skips
  only BIC. It has not been approved or applied. Existing Cloudflare credentials
  cannot read the custom WAF ruleset, and the dashboard requires sign-in.
- Production email links are rewritten by Cloudflare into JavaScript-dependent
  links that the page CSP blocks. The `no-transform` fix requires its own
  post-rollout verification before claiming usable contact links.
- Google Play's child-safety declaration is not submitted. The published policy,
  in-app reporting path and owner's declaration must be verified first.
- The owner manually uploaded the icon and feature graphic; both were assigned
  and saved. Four authenticated Android phone screenshots are prepared, but their
  upload is pending. Automatic approval review denied file uploads on the store
  listing. Do not bypass that denial through another automated upload route.
- Store screenshots, production bundle upload and production review submission
  remain incomplete. Native social app delivery has not been demonstrated on
  this emulator. A native handoff is never a delivery receipt.

Apple build 15 remains the separately submitted iOS version; no new iOS binary
was uploaded or its review submission withdrawn for these Android changes.
