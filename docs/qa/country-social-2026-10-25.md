# User-owned social sharing QA — 25 October 2026

Released through app [PR #10](https://github.com/tesserix/civiclens/pull/10)
and infra [PR #1526](https://github.com/tesserix/tesserix-k8s/pull/1526).
The approved backend, private storage, migration 0006 and internal TestFlight
0.1.5 (12) rollout are complete. See [the release receipt](../testflight.md).
Public Apple/Google store releases remain held. Preparation notes below retain
the earlier local verification context; the receipt records the final live state.

## Final product scope

User-owned sharing only in the new UI: any one, several or all of Facebook,
Instagram and WhatsApp. The country-Page switch, abandoned country credential
map, Graph staging changes and country-publication migration were removed.
The briefly authorized demo variant was cancelled and its source/profile removed.
No demo login, sample content or network interceptor is included in the IPA.

Restoring an old managed draft preserves content/selected channels but switches
to manual sharing with consent off and a new submission key. No extra provider
login or email-based account linking is added. Users create/administer their
communities in the destination apps. Nicknames appear in captions; external
sender identity may still be visible and requires acknowledgement.

The backend accepts 1–5 sanitized photos, records current rules acceptance and
location provenance, and stores private generation-pinned GCS references. Manual
approval requires independent all-photo review and current verified authorities;
it never creates a publisher job. The owner-only share-package endpoint checks
review, selected channel, rules, authority freshness and content safety. The client
rechecks immediately before each separate native handoff. Completion/cancellation
is never labelled delivery. Only verified Melbourne waste/litter routing is
currently available; country/global coverage is not implied.

## Verification

- `npm run check`: 21 suites, 107 tests passed; TypeScript and ESLint passed.
- `npx expo-doctor`: 21/21 passed.
- `npm run export`: iOS, Android and static web exports passed; no Android emulator.
- `cargo fmt --all -- --check` and clippy with `-D warnings`: passed.
- Scratch-DB `cargo test -p civiclens-api -- --include-ignored`: 30 passed, zero
  ignored. Covers five-photo retry/idempotency after partial storage failure,
  metadata stripping, role/owner access, exact all-photo review, current rules,
  all three requested sharing channels and authority expiry after approval.
- GCS is replaced only at the third-party boundary by a loopback contract fixture.
  No real cloud storage or social-provider delivery is claimed by those tests.
- Linux ARM64 release container built from the pinned Dockerfile and passed
  `scripts/ci/smoke-api.sh`: real TLS PostgreSQL, migrator/runtime permissions,
  health, capabilities and protected endpoint checks. Local Linux AMD64 builds
  failed in QEMU linker processes (SIGSEGV), including a BFD attempt; native
  AMD64 CI remains required before rollout. No failed check was suppressed.
- `cargo audit`: zero vulnerabilities; existing `atomic-polyfill` unmaintained
  warning. npm reported existing Expo CLI node-forge/Zod advisories covered by
  the repository's existing expiring audit policy; no new waiver was added.
  Existing npm audit policy passed without a new waiver. The one-line standard
  runtime digest update removed vendor-fixable HIGH/CRITICAL findings; the rebuilt
  ARM64 container passed TLS/migration/auth smoke and Trivy with --ignore-unfixed
  and --exit-code 1. Unfixed vendor advisories are retained in the audit evidence.
  No red/green unit test was added for the one-line image pin; real image rebuilding
  and smoke/scanning verified it instead.

## Apple verification

A rebuilt iPhone 17 Pro Max, iOS 26.5 development binary opened the real native
share sheet with five attachments. Final UI verification confirmed no country-Page
control, one/several/all selection, three prepared destinations and separate
Facebook/Instagram/WhatsApp handoff buttons. This simulator used clearly labelled
`[QA fixture]` content through an ignored loopback adapter; those fixtures are not
in the release binary. No app/destination was selected and nothing was posted.
Actual receiving behavior in the installed social apps remains a physical-device
test. Native cancellation was not positively verified; automated tests cover
cancellation-safe status, session changes and failed final review revalidation.
Screenshots are under ignored `artifacts/qa/country-social/`.

## Real signed TestFlight artifact

The real production-targeted IPA was built locally with the existing approved
EAS/Apple credentials as **0.1.5 (12)**. App ID `6825667307`, bundle
`app.tesserix.civiclens`, team `2CRHRRYBPL`; store profile, no device list,
debugging disabled, strict signature verification passed. The packaged bundle
contains the production HTTPS API URL and user-owned multi-selection UI, and
contains none of the cancelled demo identifiers or country-Page UI text.
IPA SHA-256: `3bd1e33695faccec0d286fa995f45ad4df4c42517052d55adcf1b4a5646c7c80`.
Artifact/receipt: ignored `artifacts/qa/testflight-real-0.1.5/`.
A cancelled preliminary demo build reserved build 11 but was never uploaded.

The named rollout was approved and completed. Current live capabilities include
manualSharing=true, maxPhotos=5 and rules=2026-10-24. TestFlight 0.1.5 (12) is
VALID and available in both internal groups. Public store release waits for the
user's later explicit confirmation after mobile testing.

## Infrastructure preparation

Clean infra worktree `/tmp/tesserix-k8s-civiclens-social`, now based on current
`c172511f`; unrelated remote Helivanta changes were fast-forwarded and preserved.
36 CivicLens infra tests, Helm lint, Terraform fmt/validate pass. The targeted
read-only Terraform plan adds exactly three resources and changes/destroys none:
private bucket `civiclens-prod-report-media-in`, a create/get-only custom IAM role,
and the direct KSA Workload Identity bucket binding. No static cloud key or new
application secret is needed. Existing OpenBao readers remain unchanged.
Prepared routes have bounded large-request deadlines and no retries; pod memory
and termination grace cover upload/export processing.

Active read-only discovery: account `unidevidp@gmail.com`, GCP project
`tesseracthub-480811`, context
`gke_tesseracthub-480811_asia-south1_tesseract-prod-in-gke`, namespace `civiclens`.
Current API digest `sha256:2e4c4767cb6d32d5fa468d9f726fd3f3d6165253331e96397df9008d6a9e176a`.
CNPG healthy; observed backup timestamp 24 October 02:10:56 UTC, retention 3d;
require a fresh approved backup and scoped schema capture before migration.
Only migration `0006_private_report_photos.sql` remains in the final change.
The user subsequently approved the named rollout; see the release receipt for
completed backup/restore, migration, digest, live checks and internal availability.
