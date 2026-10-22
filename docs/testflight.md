# CivicLens TestFlight

EAS project: https://expo.dev/accounts/tesserix-org/projects/civiclens

Project ID: `d439b0ec-4482-4f17-a134-fa0b0af57588`.
Bundle ID: `app.tesserix.civiclens`. Intended Apple team: Tesserix Pty Ltd
(`2CRHRRYBPL`), following Roamie's release process.

The user approved creating CivicLens's own provisioning profile with the existing
Tesserix distribution certificate/submission key and uploading to TestFlight.
On 22 October 2026 the saved Apple Developer login returned error `-20755`,
“This Apple Account is not active.” No profile or TestFlight build was created
by that attempt. Do not rotate or revoke credentials to work around this error.
An approved recovery path is needed before continuing signing setup.

Once signing is resolved:

1. Register CivicLens's own App Store Connect app record; do not use Roamie's
   numeric Apple ID. Put its actual ID in repository variable `CIVICLENS_ASC_APP_ID`.
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
