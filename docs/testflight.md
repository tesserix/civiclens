# CivicLens TestFlight

EAS project: https://expo.dev/accounts/tesserix-org/projects/civiclens

Project ID: `d439b0ec-4482-4f17-a134-fa0b0af57588`.
Bundle ID: `app.tesserix.civiclens`. Intended Apple team: Tesserix Pty Ltd
(`2CRHRRYBPL`), following Roamie's release process.

Signing is configured and the initial build is available for internal testing.
The approved setup reuses the existing Tesserix distribution certificate and
submission key with a dedicated CivicLens provisioning profile. The earlier
Apple login error was resolved through this setup; no shared credential was
rotated or revoked.

For subsequent releases:

1. Use CivicLens's existing App Store Connect app `6825667307`, recorded in
   repository variable `CIVICLENS_ASC_APP_ID`; do not use Roamie's numeric ID.
2. Configure `EXPO_TOKEN` access to this EAS project and the GitHub `testflight`
   environment using existing platform practices. Application secrets stay in
   OpenBao; signing credentials stay in EAS/approved platform storage.
3. Set the actual HTTPS API URL in the production EAS environment. API, native
   identity clients and provider setup must be ready for end-to-end reporting.
   A build without backend activation can only show the sign-in/setup state.
4. Run `.github/workflows/testflight.yml` on main. As in Roamie, verification
   precedes a store-signed production build, then the exact build ID from that run
   is submitted. The workflow never chooses `latest` and does not release publicly.
5. Wait for Apple's processing to reach VALID and add the build to the intended
   internal testing group. Do not send new tester invitations without instructions.
   External testing may require Apple's beta review. Confirm installation rather
   than describing an upload alone as a successful phone test.

Validation performed during development includes an actual iOS simulator build,
native launch, local Rust API connectivity, nickname entry and the software
keyboard layout. Real provider login and physical-device testing remain pending.

Release and preview builds now target `https://civiclns-api.tesserix.app`.
The iOS welcome screen offers Sign in with Apple alongside Google and Meta, and
keeps every provider disabled until its backend configuration is ready. The
redesigned welcome screen and nickname entry have been checked in the iOS
simulator. Hosted login and real provider account checks require completed live
operator onboarding; an Expo bundle export does not prove that integration.

## Release setup receipt — 22 October 2026

CivicLens has App Store Connect ID `6825667307`, bundle
`app.tesserix.civiclens`, primary language English (Australia), SKU
`civiclens-ios`, and limited app access with existing administrator access.
The repository variable and EAS production submission configuration reference
this exact app ID: https://appstoreconnect.apple.com/apps/6825667307/testflight.

The owner requested permanent public visibility for `tesserix/civiclens`.
Committed history and the task diff passed secret scanning before that change.
Reusable API release `39737509431` passed Rust database coverage, mobile quality,
exports, dependency policy and image scanning. Native identity and hosted
social-only login are deployed. Google and dedicated Apple provider redirects
reach their sign-in pages. Meta's broker callback was added after explicit
approval; its validator and returning-account screen now work. Full account-to-API
sign-in remains a device/backend acceptance check.

EAS references the existing Tesserix App Store Connect submission key
`WD75MB7L4B`, team `2CRHRRYBPL`, following the approved reuse of Roamie's
release credentials. Existing distribution certificate `6R3R6WXML3` is valid
until 16 June 2027. No shared key or certificate was rotated or revoked.
Provisioning profile `H43HJGFQ3B` is assigned to CivicLens. A local EAS production
build from `4922e1afefa46d9514284187764ecc292bbe03d2` produced version `0.1.0 (3)`.
Apple processed build `8c73d8bc-5584-41d7-826b-c75bd0e198ec` as `VALID`, with
internal state `IN_BETA_TESTING`. Submission ID:
`5299175a-2cb4-4e91-bdb8-88f0e5402d97`.

The TestFlight groups mirror the verified Roamie configuration:
- `Internal Testing`: internal, automatic access to all builds.
- `CivicLens Internal`: internal, explicitly assigned builds.
- `CivicLens External`: external, public link disabled; no external release yet.

The confirmed tester `samyak.rout@gmail.com` belongs to both internal groups.
App Store Connect availability does not prove installation on a device.

EAS cloud build credits were exhausted. The signed build used local Xcode 26.6
and the official EAS CLI 25.3.0 local helper. The supported
`EAS_LOCAL_BUILD_PLUGIN_PATH` setting was needed because the nested `npx` launcher
could not find the helper. Expo Doctor was run directly and passed 21/21 checks.
EAS Submit uploaded the exact local IPA; optional CLI release notes require an
Enterprise plan, so provide notes directly through App Store Connect.

Version `0.1.1` adds `assets/civiclens-icon.png`: an opaque cobalt icon with a white
lens/location mark and mint center, used for native app icons and the web favicon.
The production API/database rollout and full device authentication/reporting
acceptance remain pending. Social publishing is disabled until its provider
configuration and authority data are verified.

The branded `0.1.1 (4)` build from `b22a22f` was processed as `VALID` and
`IN_BETA_TESTING` on 22 October 2026. Apple build ID:
`8fc87c63-55d0-40f8-80b9-926a6b3755cc`. Submission:
`76f58740-e4d3-46bb-aee7-0c7aa639f763`. Both internal groups contain this exact
build and `samyak.rout@gmail.com`. Device installation is not confirmed.
IPA SHA-256: `de0d4f514bd26e138d54532d4b28e62b594481f6935032ca577d6daa7aff35ce`.

This build is an internal preview, not production compliance clearance. See
[the store readiness audit](store-readiness.md) before any public release.


## User-owned sharing build — prepared 25 October 2026

The requested target is a real API-connected internal TestFlight build. The user
cancelled the temporary demo approach and removed the country-Page option.
Users select one, several or all of Facebook/Instagram/WhatsApp and explicitly
confirm each native handoff after independent review. Social apps control sender
identity and may omit captions or restrict attachments. Completion is unverified.
No additional provider login, email-based account linking or demo fallback exists.

A signed production-profile **0.1.5 (12)** IPA is prepared locally using the existing
approved signing process. Store profile/team/bundle, debugging disabled and strict
signature verification passed. Its bundle contains the production HTTPS API and
multi-selection controls, and no demo identifiers or country-Page selector.
SHA-256: `3bd1e33695faccec0d286fa995f45ad4df4c42517052d55adcf1b4a5646c7c80`.
Local artifact/receipt: ignored `artifacts/qa/testflight-real-0.1.5/` in the isolated
feature worktree. No new upload has occurred. The cancelled demo build reserved 11;
that build was never uploaded. Current available TestFlight remains 0.1.4 (10).

Before upload, obtain explicit approval for the named backend rollout, create the
private media bucket/Workload Identity grants through the prepared Terraform plan,
back up and apply additive migration 0006 through GitOps, and verify the real API
capabilities, privacy and owner-only reviewed exports. Native AMD64 image CI is
required; local Linux ARM64 container/TLS/migration smoke passed. The prepared
rollout is in the owning infra repo's `docs/civiclens-user-owned-sharing-rollout.md`.

Upload only this verified IPA after the backend is ready, wait for Apple VALID,
and confirm existing internal-group availability. Do not publish to App Store,
Google Play or an external/public beta. The user will explicitly confirm any
later public store release after testing on their device. End-to-end public
provider delivery and broad reviewed authority coverage are not claims of this
local verification.
