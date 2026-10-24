# CivicLens

**See something. Change something.** A camera-first Android and iOS app for
community reporting: litter, pollution, roads, water and public safety.

Sign in through Google or Facebook using Tesserix's Zitadel identity broker.
Choose a nickname, or receive a unique one automatically. Photograph an issue,
confirm its location, and submit. Public posts credit the nickname; real names,
emails and provider tokens never enter report content. Reviewers verify the photo
and responsible authority before publication.

## What is implemented

- Expo SDK 57 / React Native 0.86.3 / Expo Router / NativeWind: sign-in, capture,
  library selection, GPS and reverse geocoding, local draft recovery, receipts,
  delivery history, profile and session revocation.
- Rust / Axum / SQLx / Postgres: OIDC signature/issuer/audience/expiry/nonce checks,
  one-time challenges, hashed sessions, unique nicknames, report ownership,
  moderator/operator roles, append-only review audit, bounded uploads, JPEG
  re-encoding, jurisdiction matching and an atomic publishing outbox.
- Opt-in official Facebook Page photo publisher, bounded retries, explicit
  uncertain outcomes and operator reconciliation. Instagram and WhatsApp jobs
  are held with a truthful reason; those publishers are not implemented yet.
- Pinned Tesserix reusable CI and EAS workflows; Android APK/AAB and iOS device/
  simulator profiles. Rust API image uses the same shared Debian runtime as
  Roamie. Helm workload and shared CNPG/identity/OpenBao handoff files are included.

This is an initial implementation for development and verification. It has not
been deployed, connected to real social accounts, or submitted to app stores.
The authority directory starts empty; there is no claim of worldwide authority
coverage. The UI and coordinates work internationally; verified routing data
must be onboarded by jurisdiction. Read [launch prerequisites](docs/deployment.md)
before collecting real reports.

## Run locally

Prerequisites: Rust 1.97+, Node 24+, Docker, Xcode for iOS, Android SDK for Android.

```sh
npm ci
docker compose up -d
cp .env.example .env
```

Set `CIVICLENS_IDENTITY_KEY` in the ignored `.env` to a locally generated random
secret of at least 32 characters. Do not reuse a production credential.

```sh
cargo run -p civiclens-api -- migrate
npm run api
```

In another terminal:

```sh
npm run ios
# or
npm run android
```

`npm run web -- --port 8806` previews the design in a browser. Browser sign-in is
deliberately unavailable: configure and test the native OIDC clients first. For
an Android emulator set `EXPO_PUBLIC_API_URL=http://10.0.2.2:8080`; physical phones
need the computer's LAN address and an explicit local API bind on that interface.
Development builds are required for native dependencies; Expo Go is not the target.

Obtain CivicLens client/project IDs through the existing identity operator and
verified Google/Facebook connector IDs from Tesserix identity configuration. Set
the `CIVICLENS_OIDC_*` and `CIVICLENS_*_IDP_ID` values in the API environment.
Unconfigured providers remain disabled. Do not borrow another product's client ID.

Writing assist (draft from photo, fix spelling) is off until `CIVICLENS_AI_GATEWAY_URL`
and `CIVICLENS_AI_GATEWAY_KEY` are set. Development accepts only a loopback URL,
such as a port-forward of the `civiclens-ai` gateway; production always uses the
private cluster gateway. See [ADR-0003](docs/adr/0003-writing-assist.md).

## Verify

```sh
npm run check
npx expo-doctor
npm run export
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo build --locked
cargo test --locked
CIVICLENS_TEST_DATABASE_URL=postgres://civiclens:local-development-only@127.0.0.1:25439/civiclens cargo test --locked -- --include-ignored
```

Database tests create isolated schemas on the scratch database and exercise real
SQL. Never point their environment variable at production. Rust generates the
mobile contracts: `cargo test export_mobile_contract`; CI rejects contract drift.

## Deployment and operations

Use the existing `global-postgres` CNPG cluster, database `civiclens_db`, schema
`civiclens`; no additional cluster. See [deployment](docs/deployment.md),
[authorization](docs/authorization.md), [integrations](docs/integrations.md), and
[architecture](docs/architecture.md). Deployment files are proposals for the owning
GitOps repositories; no live database changes are performed by CI.

Native builds use `.github/workflows/mobile-build.yml` and Tesserix's reusable EAS
workflow. Register an EAS project under `tesserix-org`, set the public project ID
in the build environment, configure signing credentials, and add `EXPO_TOKEN` as
a scoped CI credential. Store application credentials in OpenBao. Image releases
are manual and gated on CI. No workflow rolls out production or submits a store
release automatically.
