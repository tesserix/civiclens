# Civic expansion QA — 25 October 2026

## Status and scope

Implementation is local on `feat/civic-participation`, based on merge `1c5ab95`.
It is uncommitted and not deployed. The persistent isolated worktree is
`/Users/samyakrout/Desktop/samyak-work/projects/new-repos/civiclens-civic-participation`.
The original worktree and its unrelated local edits were preserved.

The previously released user-owned sharing build remains internal TestFlight
**0.1.5 (12)**. The new source is prepared as **0.1.6 (13)** with a separate native
runtime and sensitive-information privacy disclosure. There is no new IPA,
TestFlight submission, public-store release or live database import for this work.
The project instruction is **No live cloud changes**. Migrations 0007–0009 and
country imports ran only against disposable local PostgreSQL schemas/database.

## Implemented and verified

- Requests, moderated opinions and timed Yes/No/Don't know polls. One current
  response per authenticated account; changes and withdrawal stop at the server
  deadline. Each result query uses one stable statement timestamp so a closing
  boundary cannot reveal partial totals. This is neither verified human/electoral identity nor a legal signature.
  There is no money or wagering. Interim poll totals are withheld; closing reveals
  the three-choice denominator and rounded percentages. Private choices and flag
  reporters are not exposed to other participants.
- Owner/moderator separation, idempotent creates, database-backed daily quotas,
  deadline locking, pagination, moderation queues, abuse flags, account-scoped
  drafts and explicit consent. Pending content is not public. Shared app links
  survive sign-in and are cleared after arrival. Sharing rechecks current approval
  and aborts if the account changes while waiting. Closed totals reconcile each
  minute rather than freezing an early snapshot.
- India: 36 states/UTs, 784 districts, 5,050 urban local bodies. Nepal: 7 provinces,
  77 districts, 753 local governments and 22 separately classified other areas.
  NZ: 78 distinct councils. Country/level/parent/API-status columns, immutable
  import history, source licences and input SHA-256 are retained. Reproduction
  after parser typing/lint changes matched all three recorded snapshot hashes.
- Reference-directory browsing with country flags, drilldown, search, pagination,
  source/licence disclosures and explicit unverified-API labels. References do not
  grant publishing or complaint routing. See the
  [source audit](../authority-sources/multicountry-2026-10-25.md) for real coverage gaps.
- Government-only or combined destinations. Complaint preparation requires owner,
  all-photo privacy review, current verified authority and channel, separate factual
  moderator prose, content safety and explicit consent. Native text/photo export
  excludes original metadata, exact coordinates and private identity. Stable keys
  and owner/report/channel uniqueness prevent duplicate records; key reuse for
  another report fails. Expired or changed destinations fail closed.
- Official-form handoff and evidence-saving chooser, with durable `prepared` /
  `handoff_requested` states. Neither implies a government receipt. No government
  API adapter, fake acknowledgement or automatic complaint retry is shipped.
- Explicit `/sign-in` fixes an iOS-discovered ambiguous-root redirect loop. Visible
  back controls restore community navigation. Local sign-out works when the server
  cannot be reached; device-storage failure remains recoverable. Political/opinion
  and complaint data are covered in privacy text and the export/erasure runbook.

## Commands actually run

```sh
npm ci --no-audit --no-fund
npm run check
node --test scripts/ci/*.test.mjs
actionlint .github/workflows/ci.yml
npx expo-doctor
EXPO_PUBLIC_API_URL=https://civiclns-api.tesserix.app npm run export
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo build
cargo test
CIVICLENS_TEST_DATABASE_URL='postgres://samyakrout@127.0.0.1:55439/postgres?sslmode=disable' cargo test -- --ignored --nocapture
```

The test database URL is a local socket-bound fixture, not a deployed credential.
Cargo used the existing shared target cache. `npm run check` passed **133 tests in
31 suites**, typecheck and lint. Node CI checks passed **10 tests**; Expo Doctor
passed **21/21** and exports completed for iOS, Android and web. Rust unit tests,
format, warnings-as-errors Clippy, build and all **11 ignored PostgreSQL integration
tests** passed. No Android emulator was used.

The Python test environment was created with Python 3.13 and the hash-locked
`scripts/authorities/requirements-test.txt`, using `uv pip sync --require-hashes`.
`python -m pytest scripts/authorities` passed **6 tests**; Ruff check/format and
strict mypy passed for both new importer/refresher scripts. CI repeats these checks
in an isolated venv. The bounded NZ refresher stopped before bulk requests when
robots policy was unavailable.

A deterministic database clock regression reproduced a closing-boundary read
returning zero despite three stored responses. Result reads now use one stable
statement timestamp, while writes retain the post-lock database-clock check.
The test and all 11 database integration scenarios pass. A temporary-table
`EXPLAIN (ANALYZE, BUFFERS)` check with 100,000 synthetic response rows, including
50,000 on one card, executed the result aggregate in 9.617 ms. PostgreSQL chose
a sequential scan for that deliberately hot 50% key. The plan is retained as
`response-query-plan.txt`; it is a local baseline, not a production p99 claim.

Gitleaks scanned tracked plus new source files with full redaction. Two obviously
synthetic UUID fixtures initially matched a generic-key heuristic; they were made
visibly synthetic and the scan passed with no findings. A separate check found
no private `.env` values in exported bundles. Local `.env`, QA principals, raw
inputs, screenshots and receipts are ignored and not part of the source change.

## Native iOS evidence

Device: the existing CivicLens iPhone 17 Pro Max simulator, iOS 26.5. The Roamie
simulator/app was not changed. The installed development client uses the released
0.1.5 native runtime; this checks new JavaScript without claiming that a 0.1.6 binary
was built. Google login completed through the real broker against the real local
Rust API. The local database was isolated. Only the external content-safety
boundary was deterministic QA data; this is not a production-provider safety test.
Test moderator/voter principals existed only in that isolated database.

The native walkthrough created a poll, selected a native deadline, held it for
independent review, then recorded Yes/No/Don't know from three accounts. Closing
time was advanced in the local fixture only. Open results stayed private; final
results displayed 33.3% (1) per choice and disclosed rounding. Native back routing,
Indian state/district/body pagination, Nepal province/district/local-government
navigation and NZ council contacts were exercised.

A litter photo with no usable GPS was imported through the system photo picker;
the user explicitly selected simulated current Melbourne location. All social
choices were cleared. SQL confirmed zero social publishing jobs. After separate
visual and factual moderator review, the app prepared stripped evidence and opened
Melbourne's genuine Clean public space form in Safari. No form fields were filled
and no real complaint was submitted. The native evidence chooser exposed saving
options and was cancelled without sending. One durable handoff intent remained,
with no official receipt.

Evidence is under ignored `artifacts/qa/civic-participation/`:
`poll-results.png`, `india-municipality.png`, `nz-council.png`,
`complaint-package.png`, `official-form-handoff.png`, `evidence-share-sheet.png`.
Machine/local-test receipts contain no provider receipt claims.
The maximum iOS accessibility size exposed fixed camera/step frames and long
choice labels. Camera/step frames now expand and choice/button labels support wrapping.
The simulator showed the corrected step frame and wrapped back-button label. The original normal text setting was restored.
Full compact-device and physical-device accessibility acceptance remains a release
gate; this walkthrough does not certify every device or text setting. The persistent worktree owns its dependencies. Metro watcher crashes also
reproduced with that isolated installation: NativeWind's virtual stylesheet change
event lacks the `changes.addedFiles` shape expected by Expo 57's Metro. The supported
`forceWriteFileSystem: true` option avoids that incompatible virtual-module path.
It is a one-line config fix verified by native reload and exports. Native style
edits require a manual reload in this mode; production exports already write CSS
to the filesystem. No dependency or vendor source was patched.

## Remaining release gates

The source audit's unknown contacts/APIs, 12 unresolved Indian district links,
missing rural Indian governments, missing verified ministry/police responsibility
coverage and NZ bulk-contact gap remain open. Ordinary Melbourne cleaning is the
only newly reviewed official-form channel. Nationwide automated filing is not
available; it needs documented, agency-authorized interfaces and provider receipt
reconciliation. Do not interpret directory completeness as service verification.

Before a permitted rollout: review/commit/push this branch and CI; obtain a named
migration/data-import/rollout authorization that explicitly supersedes the project
hold; take and restore-test a fresh backup; apply migrations/imports with the
migration role; verify runtime grants, ledger, counts, health, capabilities and
owner-denial checks; build a new native binary with updated privacy/store answers;
then submit only to approved internal TestFlight groups. Public stores and external
beta remain held. Physical-device social delivery, App Store privacy answers,
moderation operations and an export/erasure drill still require acceptance.

Tracking: [#11](https://github.com/tesserix/civiclens/issues/11),
[#12](https://github.com/tesserix/civiclens/issues/12),
[#13](https://github.com/tesserix/civiclens/issues/13). Issues remain open until
coverage and release acceptance are actually complete.
