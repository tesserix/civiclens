# Reporter-confirmed sharing verification — 2026-10-25

The owner explicitly removed moderator approval from sharing a citizen's report
through their own social accounts. ADR-0018 records the boundary. Community
content, managed publishers and official complaints retain independent review.

## Verified behavior

- Successful submission opens the new report and consumes a session/report-bound
  one-shot sharing intent. Opening a report by URL alone cannot start a handoff.
- All selected destinations survive submission. Each handoff uses a fresh,
  owner-scoped caption and the complete sanitized photo set. Native completion
  is never marked as provider delivery.
- Existing pending reports can use fresh reporter confirmation and the current
  rules version without changing their independent-review/complaint approval.
- Cross-owner export returns 404. Missing identity acknowledgement, wrong photo
  count, outdated rules, unsupported destinations and managed-mode bypasses fail.
  Unsafe captions fail closed. Missing verified authority data omits authority
  mentions rather than preventing a generic awareness post.
- Unchanged native text callbacks preserve the draft and submission key. A real
  content edit still creates a new key. This fixes the repeated-update behavior
  encountered while exercising Description through XCUITest.

## Commands and results

- `npm run check`: 222 tests in 41 suites, TypeScript and ESLint passed.
- `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo build`.
- `CIVICLENS_TEST_DATABASE_URL=<isolated-loopback-database> cargo test -- --include-ignored`:
  all 60 tests passed, including every database integration test. The scratch
  Postgres instance uses port 55448; no production database was changed.
- `node --test scripts/ci/*.test.mjs`: all 11 passed.
- `EXPO_NO_DOTENV=1 npx expo-doctor`: 21/21 passed.
- `EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=https://civiclns-api.tesserix.app npm run export`:
  iOS, Android and web production exports passed again after the final native
  input guard. The development Metro instance was stopped during export because
  NativeWind shares generated CSS files between the processes.

## Native iOS evidence

Built the real Debug app with `expo run:ios` for the dedicated CivicLens Submit QA
simulator, UDID `23603B90-E8AD-4ED4-A96B-6685F6C2173B`, iPhone 17 Pro/iOS 26.5.
XCUITest drove Google QA sign-in, selection of the existing litter fixture, an
explicit Melbourne VIC location, all four social destinations, the reporter
confirmation/current rules and Submit Report. A low-accuracy simulated GPS fix
was correctly rejected; explicit place selection was used instead.

The real local API saved one report with status `ready_to_share`, one sanitized
photo, four destinations and NULL moderator approval. Submission automatically
opened the native share sheet, which offered Save Image. After cancellation, Next app opened the Instagram, WhatsApp and TikTok share
sheets in turn. History displayed “Saved · share post,” with no In review label.
The audit recorded two preparations per destination (initial package and fresh
handoff check), and the publications table remained empty. No public post was sent.
Reopening the saved report did not open another share sheet or add export audit
events: the submission intent was consumed exactly once. The native caption-safety gateway was a clearly isolated deterministic fixture,
not a live AI evaluation. The five-photo, unsafe-caption and cross-owner cases
were exercised through real Postgres/API integration tests with provider fixtures.

Private XCUITest source, result bundles, screenshots and build logs are under
`/tmp/civiclens-owner-native-qa/` and `/tmp/civiclens-owner-sharing-*.log`.
Bulk XCUITest key injection dropped characters in this Debug target; place search
was corrected and verified using one character per native action. No production
caption or password was used for the check.

## Release boundary

This is a locally verified change, not a production rollout or store submission.
No migration is needed. API deployment must precede the new client. The new rules
version requires fresh acceptance, including for restored drafts; old clients need
an update. Older reports accept the new rules at owner export without granting
moderator approval. The native runtime is `1.0.0-reporter-sharing-3`.

Android targeted Facebook/WhatsApp handoffs and missing-app behavior have mobile
test coverage. Expo native introspection verified the Facebook/WhatsApp package
queries and explicit removal of broad storage/media permissions. Actual
provider posting still needs physical devices with those apps installed. iOS and
Android Instagram preserve the full photo set through the system share sheet.
TikTok uses the chooser or explicit save/copy/open fallback. No universal consumer
multi-network publishing API is claimed.

Hold Android production draft build 9: it contains the old review-gated flow.
Prepare replacement store binaries after the approved API rollout and device QA.
Do not withdraw the existing Apple submission or treat a draft/upload as released.
