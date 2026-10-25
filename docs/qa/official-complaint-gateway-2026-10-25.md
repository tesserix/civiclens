# Official complaint gateway validation — 25 October 2026

Scope: reusable provider discovery, administrative selection, readiness resolution
and private internal request creation/history/status. This is local source on
`feat/civic-participation`; no deployment or TestFlight upload occurred.

## Coverage and limits

- All 36 Indian state/UT references and 784 district references preserve the pinned
  LGD names, codes and parent links. Tamil Nadu has 38 administrative districts.
- Country-neutral reference and provider registries support the shared contract.
  Tamil Nadu is a documented registration/status candidate; MP is lookup-only.
  Other providers and police identifiers remain unverified, not fabricated.
- Unknown media limits remain null; the five-photo value is the product ceiling,
  not proof of provider acceptance or configured original-evidence storage.
- All resolutions disallow submission. Stored requests are blocked, dispatch is
  false and official reference is null. No government HTTP client/worker exists.
- The app UI has not been connected to this new gateway. Existing sharing and
  community behavior retain their existing tests and release status.

## Tests and checks actually run

| Check | Result |
| --- | --- |
| `CARGO_TARGET_DIR=/tmp/civiclens-country-pages-qa/target cargo test --manifest-path api/Cargo.toml -- --include-ignored --test-threads=1`, with isolated local test database configured | Full 47-test suite passed, including 13 real Postgres integrations |
| `cargo test --manifest-path api/Cargo.toml official_gateway_works_over_local_http -- --ignored`, with the same target/database configuration | Additional real TCP/HTTP/session/Postgres smoke test passed; 48 distinct Rust tests verified in total |
| `cargo clippy --manifest-path api/Cargo.toml --all-targets -- -D warnings` with shared target | Passed, including the added TCP test |
| `cargo fmt --manifest-path api/Cargo.toml -- --check` | Passed |
| `cargo build --manifest-path api/Cargo.toml` with shared target | Passed |
| `npm run check` | 133 tests / 31 suites, TypeScript and lint passed |
| `npx expo-doctor` | 21/21 passed |
| `npm run export -- --output-dir artifacts/qa/official-complaint-gateway/export` | iOS, Android and web exports passed; no Android emulator used |
| `node --test scripts/ci/*.test.mjs` | 10 passed |
| `git diff --check` | Passed |
| Repository documentation validation | Local links/headings passed; 784 district checklist rows remain unresolved |
| Gitleaks directory scan of 240 nonignored source files, with redaction | No findings |
| Private configured secret-value scan of 113 exported files, UTF-8/UTF-16 | No private environment values found |

The TCP smoke test starts a temporary loopback Axum server, uses a real stored
test session and checks 401 without authentication, successful authenticated
resolution, `Cache-Control: no-store` and false submission readiness. Other
integration tests exercise the actual router against isolated Postgres schemas.
Test photos are synthetic one-pixel JPEGs. Existing safety dependencies use a
deterministic local stub; no claim of a new live AI/provider evaluation is made.

## Meaningful regression cases

Cross-state, cross-country, unknown district and unconfirmed locations fail;
unknown countries have no fabricated reference source. District pagination is
bounded and rejects a cursor from another parent. Source review windows include
exact expiry boundaries and return unique explicit blockers.

Requests require owned public-safety reports, country consistency, explicit
consent and UUID idempotency keys. Unknown fields, arbitrary provider URL fields
and oversized JSON fail. Another account cannot read or attach a report/request.
Same-key concurrent retries produce one record, changed payload gives 409, and the
last daily quota slot admits one competing new request while rejecting the other.
Existing-key retries work at quota. History is owner-scoped and paginated.

Database constraints reject owner/report mismatches and snapshots claiming
`canSubmit: true`. No publication rows are created by these internal requests.
Consent events are audited without copying text, photos, tokens or private identity.

## Remaining gates

Tamil Nadu still needs approved integrator access, actual provider police codes
and reviewed geographic responsibility, incident scope, photo/identity fields,
official acceptance/reference semantics, duplicate reconciliation and a usable
authorized test environment. No live filing, original-evidence collection or
provider receipt is claimed. State/district integration checkboxes remain open.

Migration 0010 was applied only to disposable local integration-test schemas. A
live migration/rollout needs separate named approval, backup and the existing
GitOps workflow. Export/erasure inventory and privacy source text now describe
blocked internal request records. Full operational erasure and original-evidence
retention controls remain release gates.

Ignored scan receipts and export output are under
`artifacts/qa/official-complaint-gateway/`. No credentials or real complaints are
included in this report.
