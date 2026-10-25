# Native selection consistency — 2026-10-25

Worktree `civiclens-civic-participation`, branch `feat/civic-participation`.
Local UI work only; existing unrelated changes preserved. No commit, push,
deployment, migration, social publishing or TestFlight upload.

## Changes

Capture and reviewed-post sharing now use one Social apps dropdown. Its native
page sheet contains supported destinations, icons, accessible checkboxes, selected
count, Select all, Clear, Done and Cancel. Selection is staged until Done. Cancel,
Android Back, changed capabilities, changed parent values or disabled controls
cannot apply stale choices. An unchanged Done preserves prepared content. Empty
selection remains possible for government-only reports. Existing draft and
backend capability gates remain.

Caption tone, community request type, concern reason and directory country now
use the existing native single-choice selector: iOS ActionSheet and Android
Picker dialog. Country flags remain. Shared field geometry matches report issue
selection. Native callbacks are invalidated when the value, choices, label or
lock state changes; the previous implementation could map an old index to a new
option. Android picker height adapts to text size. Social-sheet content scrolls
independently of its safe-area footer, which keeps Done and Cancel reachable.

Added narrow durable guidance under Selection controls in AGENTS.md.

## Regression evidence

Before implementation, the new capture/sharing tests failed because the dropdown
was absent (3 failures). Tests for the additional single-choice dropdowns also
failed (6 failures). A stale native-option test reproduced an unintended `other`
selection after options changed. A no-op Done test reproduced unnecessary parent
updates. All pass after implementation. Existing behavioral tests now use the
new user-facing controls rather than the removed chip rows.

`npm run check` passed: 39 suites, 188 tests, TypeScript and ESLint.
`npx expo-doctor` passed 21/21.
`EXPO_PUBLIC_API_URL=https://civiclns-api.tesserix.app npm run export` passed for
iOS, Android and static web.
`node --test scripts/ci/*.test.mjs` passed all 10 checks.
`git diff --check` passed.
No Rust/API code changed, so backend tests were not repeated for this UI change.

## Native verification

Used the existing iPhone 17 Pro Max / iOS 26.5 simulator, build 14, Metro 8100 and
local API 8098. No new native modules or binary rebuild needed.

- Capture: selected Facebook, Instagram and TikTok in the sheet; Done showed
  “3 apps selected”. The four scattered chips and inline bulk actions are gone.
  Restored the draft’s original Facebook-only choice after verification.
- Maximum accessibility text size: reached and toggled TikTok by scrolling while
  Done and Cancel remained available. Cancel preserved the prior three choices.
- Landscape: all destinations remained reachable; footer stayed visible.
- Restored the original portrait orientation and normal `large` text-size setting.
- Reviewed synthetic report: same dropdown, with only its selected/approved TikTok
  destination available; independent review and preparation controls unchanged.

Validation commands loading Metro config cleared NativeWind's shared generated
style cache while the development server was running. The native-only cache
files were empty. Restarted Metro with `--clear` after validation and reloaded
the app; styles regenerated and subsequent native checks passed. This was a
local development-cache interaction, not a shipped UI change. Keep config/export
validation separate from final running-server visual QA.

Evidence is in ignored `artifacts/qa/civic-participation/social-dropdown-*`.
Android behavior is covered by selector tests and a production export; no Android
emulator was started, per project instructions. Physical Android/foldable/tablet
visual QA was not performed; do not claim every device has been verified.
