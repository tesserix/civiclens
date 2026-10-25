# Account profile and text reflow QA — 25 October 2026

Local worktree: `civiclens-civic-participation`. No commits, pushes, store uploads,
live migrations or cloud changes were performed.

## Layout regression

The supplied report screenshot reproduced stale native text measurements after
changing Dynamic Type back to normal. Huge title/subtitle/button frames remained
even though their text was small. Display text now consumes a shared font-scale
context and remounts only its native text node on scale changes. Inputs, navigation,
saved drafts, profile edits and component state remain mounted. This replaces the
community-only list remount workaround.

Native verification covered Report, My reports, report details, Community and
Account. Maximum accessibility text followed by `large`, including changing text
size while Report was in another tab, no longer leaves the reported blank space.
The simulator text setting was restored to `large`. Profile journey badges expand
for larger text without stretching to the height of the neighbouring paragraph.

## Account feature

Owner-only GET/PUT `/v1/me/profile` stores a bio of at most 280 Unicode characters
and an optional metadata-stripped JPEG, bounded to 256 px / 96 KiB. Explicit photo
removal is supported. An unchanged photo is retained when only the bio changes.
Other accounts cannot read or update these fields. No profile fields are added to
reports, social captions or public community payloads.

The system picker, native crop, preview and Save were exercised with the existing
CivicLens icon as a clearly synthetic sample avatar. A 47-character local QA bio
and an 8,933-byte JPEG were retained by the real API/database after reopening the
editor. The software keyboard was shown; Save was reachable by scrolling. Native
photo selection accesses only the selected item. The original gallery asset is
not changed, and resized temporary files are cleaned when possible.

OIDC now requests `profile`. A supported `picture` claim from the verified broker
token can be imported explicitly through `/v1/me/profile/sign-in-photo`. It is
never copied automatically on login. Candidate URL hosts/paths, scheme, port,
credentials, query and fragment are constrained; redirects and caller-supplied
download URLs are rejected. Download size, network deadline, decode dimensions and
image-processing concurrency are bounded. Imports are previewed before Save.

The existing native session did not supply a candidate, so its import control is
disabled with an explanation. Real-provider photo import was not exercised.
Verified-token candidate handling and client import/preview are covered by tests;
missing or unsupported provider pictures keep device upload available. Apple and
some broker mappings may not supply pictures at all.

## Database and privacy

The existing local QA database used SQL_ASCII, which counted a 280-character Odia
bio as 840 bytes. The test failed against the database constraint. A UTF-8 QA clone
was created from `template0` and populated from a private local backup, preserving
the original database unchanged. Tests and the local API now use that UTF-8 clone,
`civiclens_profile_qa_utf8_20261025`, on loopback port 55439. The dev client URL was
also aligned to the updated local API at port 8098; Metro remains on 8100.

Migration 0012 is additive and grants runtime UPDATE only on the relevant columns
and timestamp. It ran only locally. Its destructive scratch down path (dropping
the three columns) was exercised within a transaction and rolled back; all fields
and the saved QA profile remained present. Production rollback preserves unused
columns until a separately approved purge. Privacy text and export/erasure
instructions include the bio, avatar bytes and private provider candidate URL.

## Checks actually run

- `npm run check`: 164 tests in 38 suites; TypeScript and ESLint pass.
- `npx expo-doctor`: 21/21.
- `EXPO_PUBLIC_API_URL=https://civiclns-api.tesserix.app npm run export`: iOS,
  Android and web exports.
- `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo build`,
  `cargo test`: 37 unit/HTTP tests pass.
- All 17 database tests passed with `cargo test -- --ignored --nocapture` against
  isolated schemas in the local UTF-8 database. The profile and verified-login
  tests were run again after extending their security assertions.
- Regression coverage includes retained form edits during font changes, save
  failure/retry, photo removal, account changes during image selection, Unicode
  bounds, metadata stripping, missing candidates, forged import URLs, unsafe
  stored candidates, and signed broker-photo claims without token/name leakage.

Existing React virtual-list/query `act` timing warnings are still emitted by some
tests; they are not suppressed. No Android emulator was started. Android physical
sharing and foldable/hinge acceptance remain unverified.

Ignored local evidence: `artifacts/qa/civic-participation/account-photo-bio.png`
and `report-layout-fixed.png`. The icon and bio are local QA examples, not provider
delivery or real social posting evidence.

## Social-sharing confirmation

The report flow offers Facebook, Instagram and WhatsApp through the system share
menu, with a separate user-confirmed handoff for each. It supplies the reviewed
caption and photos; the receiving app may omit text or limit attachments. It does
not auto-publish or prove delivery, and it uses the account chosen in that app.
TikTok is not integrated. The current local server advertises one report photo
because private object storage is not configured here; the five-photo path has
separate storage-backed tests. No social post was sent during this work.
