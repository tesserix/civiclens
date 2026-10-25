# Report submission QA — 25 October 2026

## Android production candidate 8

Used the dedicated QA Google account on CivicLens's API-connected API 36
emulator. Imported the existing litter QA image through Android's native photo
picker. The photo had no usable GPS, so the form cleared its unrelated location
and requested a place. An explicit Melbourne search resolved the reviewed City
of Melbourne waste/litter match and eight selectable hashtags.

Live writing assistance returned a balanced caption describing the two bottles
and white debris. Applying it required the photo/caption privacy check. For
submission, replaced that caption with `QATEST_ONLY_DO_NOT_PUBLISH`: the image
and location are QA inputs, not a live complaint.

The Submit report control was disabled while reviewed-sharing consent and
community-rules acceptance were off. With a complete form and both accepted,
native submission succeeded and navigated to My reports. The private QA report
is visible as In review. No approval, complaint filing or social handoff was
attempted. The source image was not published.

Evidence is retained under ignored
`artifacts/releases/1.0.0-android8/screenshots/`, including the selected photo,
authority match, live AI suggestion, ready submit control and private receipt.

## Shared form corrections

Previously the disabled submit control offered no explanation of the missing
requirements. A failed initial capabilities request could also leave it disabled
without a retry. The form now explains the next missing requirement beside the
button and offers Retry reporting availability when that request fails. All
photo, location, destination, consent and rules gates remain in force.

Both regression tests failed before their respective UI changes and passed
afterward. A further integration test verifies that an upload error keeps the
photo and description, and a retry sends the identical payload and idempotency
key. Existing tests cover five-photo submission and current rules acceptance.

## Apple verification in progress

Built an API-connected Release configuration for a dedicated CivicLens Submit QA
iPhone 17 Pro simulator on iOS 26.5. Its signed-in nickname matches the Android
QA account. The missing-photo submission hint is visible in the native
accessibility tree. Five QA images have been imported into this simulator.

Native photo-picker selection is awaiting manual input: pointer automation
returns noWindowsAvailable while the picker is presented. No successful Apple
submission is claimed yet. The original device-specific failure remains
unconfirmed until the complete Apple form has been exercised.

Apple's separately submitted build 15 has not been replaced or withdrawn.
