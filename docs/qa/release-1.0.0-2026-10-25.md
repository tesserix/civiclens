# CivicLens 1.0.0 release verification — 2026-10-25

Release source: PR #15 (`1f8ffc6`) and build corrections in PR #16 (`df1d299`).
Release configuration uses version 1.0.0 and a new native runtime. EAS owns remote
build counters. The existing opaque CivicLens logo is configured for iOS, Android
and web. Build 14 is selected in the App Store draft; its included App Icon was
visually verified in App Store Connect as the existing CivicLens logo.

## Verification

188 mobile tests, TypeScript, ESLint, 37 Rust unit tests and 17 isolated database
integration tests passed. Rust fmt/clippy passed. Authority imports: six tests,
Ruff and strict mypy passed. Expo Doctor, production exports and CI checks pass.
The staged 5.35 MB source/data diff passed Gitleaks with no leaks. Private QA
fixtures, tokens and backup contents are ignored, not release assets.

## Approved rollout and migration boundary

The connected cloud identity is `unidevidp@gmail.com`, project
`tesseracthub-480811`, context
`gke_tesseracthub-480811_asia-south1_tesseract-prod-in-gke`.
Application target: `civiclens/civiclens-api`, public API
`https://civiclns-api.tesserix.app`. Existing database: `civiclens_db`, schema
`civiclens`, on `global/global-postgres`.

The owner explicitly approved migrations 0007–0012, the production API rollout,
admin merge and public repository visibility. The image was published and promoted
through `kargo-civiclens/prod`; Argo's migration hook ran before the new Deployment.
No new database or identity-key rotation was part of this rollout.

Applied migrations:

- 0007: moderated community requests, responses, opinions and flags.
- 0008: administrative directory/generated columns and indexes.
- 0009: reviewed official-form complaint preparation and intent records.
- 0010: blocked official complaint gateway request snapshots.
- 0011: community discovery indexes and account watch records.
- 0012: private user avatar, bio and trusted sign-in photo URL.

The CNPG cluster is healthy, 2/2 ready, with a successful backup at
2026-10-25T02:10:59Z. A fresh CivicLens-only custom-format backup and isolated
local restore/migration rehearsal are recorded privately under
`artifacts/releases/1.0.0/`; do not commit its contents. The isolated restored
database successfully ran migrations 0001–0012 before the approved rollout.

Migrations are forward-only. An old API image may ignore additive tables/columns,
but cannot deserialize newly stored TikTok channel JSON. After TikTok submissions,
use a forward-compatible repair image rather than reverting the channel enum.
Never drop the shared database or schema as rollback. Locks/timeouts bound DDL;
large directory alterations are rehearsed on restored data before rollout.

## Store destinations and remaining work

Apple app ID: `6825667307`, bundle ID `app.tesserix.civiclens`.
Google Play CivicLens app ID: `4975894389147404320`, same package name.
The user-supplied Play URL with ID `4974323704246612086` belongs to Roamie;
no changes are authorized to Roamie for this CivicLens release.

Current Apple store version is Prepare for Submission with build 14 selected and
incomplete review contact/access information and store assets/declarations.
Latest internal TestFlight build is 1.0.0 (14). Google Play has an internal release;
category/contact details are saved, while its public store listing is incomplete.
Complete accurate store declarations, screenshots, reviewer access and exact
artifact inspection before submission. Store review/approval is external and
cannot be represented as an immediate public release. Physical installed-provider
social delivery remains user-confirmed manual sharing, not automated publishing.

## Approved merge and build corrections

The owner explicitly approved migrations 0007–0012, the production API rollout,
and admin merge. PR #15 merged as `1f8ffc6`; repository visibility is PUBLIC.
The first API image run failed before deployment: its Docker context lacked the
compile-time shared app-links JSON and logo, and a clean web export could not
hash NativeWind's generated CSS file. Both failures were reproduced. The corrected
container built locally and passed the full TLS database/migrations/runtime-grants/
protected-routes smoke. Precreating the generated CSS entry before Metro scans
also passed a fresh-cache web export, all-platform export, 188 mobile tests,
typecheck/lint and all CI-script checks. Signing credentials are now explicitly
ignored and local download copies remain under a private temporary directory.

The first iOS archive was rejected by Xcode because the older provisioning
profile lacked Associated Domains. The CivicLens App ID capability was enabled
using the existing Apple Developer browser session, and its profile regenerated
with the existing distribution certificate. No certificate rotation or other app
identifier change was part of the fix.

## Verified production rollout

PR #16 merged as `df1d299`. GitHub Actions run `40162292713` completed successfully,
including the published-image TLS Postgres/authentication smoke test. Kargo and
Argo promoted the approved release through the existing GitOps path. Argo reports
Synced/Healthy and its `civiclens-api-migrate` hook succeeded. Both API replicas
are ready on the verified image:

`sha256:ecaddef9e5d44628aff306c25b2e024b124b2672fa310e0e4f9a0c0752fc046e`

A read-only query against the primary confirmed migration ledger entries 0001–0012
all succeeded. The public capabilities endpoint advertises private profile editing,
community discovery, civic participation, complaint preparation, and manual sharing
to Facebook, Instagram, WhatsApp and TikTok. Unauthenticated requests to
`/v1/me/profile` and `/v1/community` return 401. Managed social publishing remains
disabled; these checks do not establish actual external-provider delivery.

## Store artifact progress

The signed Android bundle is version 1.0.0, code 5, package
`app.tesserix.civiclens`, minSdk 24 and targetSdk 36. `jarsigner -verify` passed;
bundletool inspected its manifest. Artifact SHA-256:

`7f850dcc5654539abb76ea70332097b911a14bfd3fef2699c98500c529245e84`

The owner manually uploaded that bundle after automated browser upload was denied.
Google Play accepted it and the internal release was saved and published. The track
still requires tester-list selection before installation is available. Play also
warned about the missing R8 deobfuscation file. No public release is complete.

The owner manually downloaded the regenerated Apple profile. Its team, bundle
identifier, Associated Domains and Sign in with Apple entitlements were verified,
and its certificate matches the existing distribution certificate. The corrected
profile was assigned to CivicLens in EAS without rotating that certificate.
The new local production archive uses merged source `df1d299` and the public API.
The signed IPA passed `codesign --verify --deep --strict`. Inspection confirmed
version 1.0.0 (14), the production API in the JS bundle, the CivicLens icon assets,
the expected universal-link entitlement, a non-development signature and the
non-exempt-encryption declaration. IPA SHA-256:

`f21d3fd98362a7a050648990fca127e0e59d6c1d934bac8c78b932ad7daa80d3`

EAS submission `19984efa-8373-426f-8077-4537f67b88d7` completed its Apple upload.
App Store Connect reports 1.0.0 (14) as `VALID` and `IN_BETA_TESTING`; the build is
assigned to the existing CivicLens Internal and Internal Testing groups. Apple
build ID: `9ab1cd24-0826-470f-87d0-12639d7085a3`. This is internal TestFlight
availability, not a public App Store release or external beta approval.

The EAS changelog option was rejected because the account's plan does not support
it. The same IPA was successfully resubmitted without that option; testing notes
were entered directly in App Store Connect. No paid-plan change was made.

Live release checks also found that the gateway's API-only allowlist blocked the
new association documents, community pages and share image. The owning GitOps fix
merged in `tesserix/tesserix-k8s` PR #1531 as `beb23aa0`, after 22 scoped local
tests and the repository CI passed (1,018 passed, four existing baseline
deselections, 64 subtests passed). Argo reconciled `beb23aa0` and reports
Synced/Healthy. Public checks confirmed the Apple association names the correct
team/bundle and `/community/*`, the share image returns 200, and `/healthz`
remains private (404). The Android association route returns an empty array.
Android verified app links still
require the Google Play app-signing fingerprint; the association list intentionally
remains empty until that certificate is verified.

Apple's draft now has Social Networking as its primary category and the verified
policy URL `https://civiclns-api.tesserix.app/v1/privacy` (HTTP 200). Ten privacy
data categories have been drafted from current behavior and policy, including
account identifiers, names/email through the identity broker, precise/coarse
location, photos/content, optional political opinion, support and interaction
records. Each category is configured for App Functionality, linked to the account,
and not used for tracking. Publication awaits the owner's action-time approval of
Apple's accuracy, legal-compliance and ongoing-update attestation; no agreement
was accepted on the owner's behalf. Apple additionally requires 13-inch iPad and medium Dynamic Island
iPhone screenshots, reviewer sign-in details and review contact information.
No synthetic QA fixture screenshots or invented reviewer credentials were used.
