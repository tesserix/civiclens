# CivicLens 1.0.0 release preparation — 2026-10-25

Source: `feat/civic-participation`, based on current main `5e2c2aa`.
Release configuration uses version 1.0.0 and a new native runtime. EAS owns remote
build counters. The existing opaque CivicLens logo is configured for iOS, Android
and web. Apple’s public version currently has no selected build; store placeholder
artwork is not evidence that the native bundle lacks its icon.

## Verification

188 mobile tests, TypeScript, ESLint, 37 Rust unit tests and 17 isolated database
integration tests passed. Rust fmt/clippy passed. Authority imports: six tests,
Ruff and strict mypy passed. Expo Doctor, production exports and CI checks pass.
The staged 5.35 MB source/data diff passed Gitleaks with no leaks. Private QA
fixtures, tokens and backup contents are ignored, not release assets.

## Intended rollout and named approval boundary

The connected cloud identity is `unidevidp@gmail.com`, project
`tesseracthub-480811`, context
`gke_tesseracthub-480811_asia-south1_tesseract-prod-in-gke`.
Application target: `civiclens/civiclens-api`, public API
`https://civiclns-api.tesserix.app`. Existing database: `civiclens_db`, schema
`civiclens`, on `global/global-postgres`.

Merging API changes publishes a deployable image and automatically promotes it
through `kargo-civiclens/prod`. Argo’s migration hook runs before the new Deployment.
This merge therefore includes a production schema change, not only source control.
Approval must explicitly cover migrations 0007–0012 and that API rollout before
merge. No new database, roles, identity-key rotation or credential is requested.

Pending migrations:

- 0007: moderated community requests, responses, opinions and flags.
- 0008: administrative directory/generated columns and indexes.
- 0009: reviewed official-form complaint preparation and intent records.
- 0010: blocked official complaint gateway request snapshots.
- 0011: community discovery indexes and account watch records.
- 0012: private user avatar, bio and trusted sign-in photo URL.

The CNPG cluster is healthy, 2/2 ready, with a successful backup at
2026-10-25T02:10:59Z. A fresh CivicLens-only custom-format backup and isolated
local restore/migration rehearsal are recorded privately under
`artifacts/releases/1.0.0/`; do not commit its contents. Recheck cluster/backup
state immediately before approved merge.

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

Current Apple store version is Prepare for Submission with no build selected and
incomplete metadata. Latest existing TestFlight build is 0.1.5 (12). Google Play
CivicLens is Draft; category/contact details and store listing are incomplete.
Complete accurate store declarations, screenshots, reviewer access and exact
artifact inspection before submission. Store review/approval is external and
cannot be represented as an immediate public release. Physical installed-provider
social delivery remains user-confirmed manual sharing, not automated publishing.
