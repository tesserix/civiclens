# Photo location and writing QA — 24 October 2026

Branch: `feat/photo-location-assist`. No cloud rollout or store release.

## Fixtures and permitted use

These are historical QA fixtures, not new civic incidents. Never submit or publish
them as current Australian reports. Fixture files stay in ignored `artifacts/`.

- [Four pieces of litter](https://commons.wikimedia.org/wiki/File:Four_pieces_of_litter.jpg),
  author 50tr5, CC BY-SA 4.0. Original and 1280px thumbnail contain no GPS, verified
  with Apple ImageIO. The source page identifies Canada; simulated Melbourne is
  only a deliberate test location. The model inferred blue bottles and white litter; object identification still
  requires human review.
- [Melbourne alley](https://commons.wikimedia.org/wiki/File:45_Urban_back_street_with_restaurant_trash_bins_-_garbage_dumpster_alley_in_Melbourne,_Australia.jpg),
  author Marek Ślusarczyk, CC BY 3.0, historical 2009 image. Contains a visible
  number plate; unsuitable for publication without sanitisation/review. No GPS.
- [DSCN0010 EXIF sample](https://github.com/ianare/exif-samples/blob/master/jpg/gps/DSCN0010.jpg),
  original test file, used solely for metadata QA. Apple ImageIO confirms
  43.46744833333333 N, 11.88512666666667 E. The iOS native picker resolves this
  to Arezzo, Tuscany, Italy. This is not a litter or Australian incident.

Attributions belong in this QA record, never in report captions.

## Executed checks

- iPhone 17 Pro Max, iOS 26.5 Simulator: native Photos selection, compression,
  location-source explanation and council lookup.
- No-GPS litter selection removes the previous device/photo point. Submission
  stays disabled until location, description and consent are supplied.
- GPS-bearing fixture populates Italy and displays the metadata explanation.
  Automatic authority lookup reports no verified Italian coverage and no office tags.
- Replacing photos originally reused one local file path, allowing stale image
  cache content alongside new metadata. Fixed with a new persistent URI per photo;
  retested with visibly different images.
- Native place search for `Melbourne VIC` returned -37.8150, 144.9663. Choosing
  it set the source to manual and automatically matched City of Melbourne without
  a separate lookup tap.
- Existing deployed image model returned a litter caption in English and
  the deployed directory matched City of Melbourne waste/litter at the test point.
  This is a baseline test of the old deployed prompt, not the new tone/verdict schema.

Automated checks cover metadata formats/bounds, manual precedence, current-fix
age/accuracy, camera cancellation/errors/late watcher cleanup, geocoder deadlines,
late responses, source/tone invalidation, coarse-only AI context, model safety
verdicts, reviewed-route tags and privacy/publication holds. Real PostgreSQL
integration verifies ownership, roles, idempotency and transactional publication.

Commands actually run successfully:

- `npm run check` — 82 tests, TypeScript and ESLint.
- `npx expo-doctor` — 21/21 checks.
- `npm run export` — iOS, Android and web bundles. Android runtime QA was excluded
  at the user's request; no Android emulator was used in this work.
- `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo build`,
  `cargo test` — 24 unit tests; one database integration test gated by default.
- With the scratch local database URL set:
  `cargo test -p civiclens-api tests::database_enforces_ownership_roles_idempotency_and_transactional_publication -- --ignored --exact`
  — the database integration test passed separately.

## Remaining gates

- Camera hardware and capture-time GPS accuracy require a physical iPhone. Simulator
  camera permission/watch mocks cover lifecycle failures, not hardware accuracy.
- New Serious / Light satire / Balanced prompts and image privacy verdicts pass
  local gateway-contract tests. They have not been evaluated against the live
  provider: no separate development gateway credentials are configured. The old
  deployed API lacks `assistContext`, so mobile omits new fields and hides tones.
- Only City of Melbourne waste/litter routing is reviewed. Other councils, police,
  ministers and mayors remain unverified and must not be tagged automatically.
- Public sharing was not consented to; no report or social post was submitted.
- Merging API paths triggers the image/GitOps release pipeline. The repository's
  no-live-cloud-change rule requires scoped rollout approval before merge.
