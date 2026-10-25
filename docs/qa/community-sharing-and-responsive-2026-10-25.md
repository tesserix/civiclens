# Community sharing and responsive controls — 25 October 2026

Changes are local in the `civiclens-civic-participation` worktree. Existing
participation/directory/complaint work was preserved. Nothing was committed,
deployed, uploaded to TestFlight or released to either public store.

## Behaviour

Community cards use shared iOS shadows, Android elevation and web shadows. Browse
and Topic use native iOS action sheets and Android pickers instead of chip rows.
The dropdowns stack below 380 logical pixels or above 1.2 text scale; wider windows
show aligned fields. Content remains centred with a maximum reading width.
Changing window size preserves the chosen filters. Feed text remounts when Dynamic
Type changes because the simulator retained old line measurements during a live
text-size change. Landscape is enabled in app configuration; tablet support stays
enabled. The native orientation setting requires a new binary.

Approved cards have Share actions in the feed and detail screen. New-server shares
request a fresh, safety-checked HTTPS link and validate the exact origin, path,
card identity, URL credentials/query/fragment and bounded text before handoff.
Account changes, unmounting or withdrawal cancel an in-flight share. Cancellation
does not claim delivery. Older servers retain their existing installed-app links
and are labelled accordingly. No social post was sent during QA.

Anonymous HTTPS previews contain reviewed question text and coarse place only.
Pending/hidden cards return 404; account identity, individual choices and saved
interests are excluded. HTML is escaped, CSP is restrictive, and Open Graph
metadata uses the existing CivicLens icon. App identities come from the shared
public manifest. No application credentials were added.

## Verification actually run

- `npm run check`: 157 tests across 36 suites, TypeScript and ESLint.
- `npx expo-doctor`: 21/21 checks.
- `EXPO_PUBLIC_API_URL=https://civiclns-api.tesserix.app npm run export`:
  iOS, Android and web exports.
- `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo build`,
  `cargo test`, and the additional `community_links::tests` store-gating checks.
- All 16 database integration tests ran with `cargo test -- --ignored --nocapture`
  against loopback PostgreSQL at port 55439 using isolated scratch schemas.
- `node --test scripts/ci/*.test.mjs`: 10 checks passed.
- Dimension-change tests exercised 280, 360, 720 and 1200 logical-pixel windows,
  including text scale 2, without losing filter selections.
- The iPhone 17 Pro Max simulator exercised the real local API, native Topic
  choices, normal and maximum accessibility text sizes, live text-size changes,
  HTTPS sharing and cancellation. External content safety used the existing
  explicitly synthetic local QA boundary, not a live AI-provider evaluation.
- The real local HTTP preview and both association endpoints returned 200.
  Chrome checks at 320×740 and 1280×800 found no horizontal overflow. The wide
  preview card measured 720 px. Chrome's temporary viewport was reset.

Local API: `127.0.0.1:8098`; Metro: port 8100. The existing disposable local QA
database received the pending development migration/imports. No cluster, deployed
database, production account or cloud setting was changed. The simulator's text
size was restored to `large`.

Screenshots are ignored local evidence under `artifacts/qa/civic-participation/`:
`community-modern-dropdowns.png`, `community-native-dropdown.png` and
`community-native-share.png`. Existing Jest virtual-list/query timing warnings and
an export warning from the country-name package's dynamic JSON loading remain;
the commands above pass. These are not evidence of physical-device compatibility.

## Remaining acceptance gates

Public Apple/Google listings are not available in the verified store checks.
Download buttons remain disabled by the manifest until each listing is verified.
The real Apple app ID is 6825667307; the Android package is
`app.tesserix.civiclens`. Android Digital Asset Links intentionally returns an
empty list until the production Play App Signing SHA-256 certificate is supplied.

OS-verified HTTPS opening requires hosting the association endpoints and new
signed native binaries. Neither is deployed here. TestFlight is not a public App
Store download. After installing, users may need to tap their original question
link again; there is no fabricated deferred deep-link service.

Physical Samsung Fold folded/unfolded and split-window QA, Surface Duo spanning
and hinge occlusion, and tablet native acceptance remain required. No Android
emulator was started, and no hinge-aware native layout module is implemented.
Responsive window tests do not establish those hardware-specific behaviours.
