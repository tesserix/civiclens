# Dependency review, 22 October 2026

The reusable CI gate rejects new high-severity npm advisories. Three explicitly
reviewed, currently unfixed tooling advisories expire on **21 November 2026** in
`.audit-ci.jsonc`. These are exceptions, not fixes or a claim of a clean raw audit.

- **GHSA-vfj7-8cjw-p6xm**, braces <=3.0.3: nested-pattern stack exhaustion. Registry
  latest is 3.0.3. It is used by Jest, Metro and Tailwind, with patterns supplied by
  repository configuration. Reporter text, photo contents and location are never
  sent to glob expansion. NativeWind v4 requires Tailwind 3. Build untrusted PRs
  without credentials, as the workflows already do. Reassess any feature that
  introduces user-defined patterns.
- **GHSA-86w9-cpqp-85rv**, node-forge <=1.4.0: malformed RSA signature verification.
  Registry latest is 1.4.0. Expo CLI's code-signing tooling depends on it. This app
  does not configure Expo OTA updates/code-signing; Google/Facebook identity tokens
  are validated by the Rust service using AWS-LC. Apple native signing is a different
  toolchain. Reassess before enabling OTA or exposing a development server publicly.
- **GHSA-mrhx-c7xc-m3w5** (added 24 October 2026), zod <4.6.6: unbounded issue
  accumulation on oversized arrays. Expo CLI 57 pins zod ^3.25.76 and no 3.x fix
  exists; forcing zod 4 breaks the CLI. Only the local dev server uses it, for
  DevTools plugin schemas. The app bundle and the Rust API do not include zod.
  Reassess before exposing a development server publicly.

The raw npm audit also reports moderate issues in URI decoding, PostCSS selectors
and sprintf tooling; the shared high-severity gate retains its standard threshold.
Do not run `npm audit fix --force`: its suggested Expo downgrade or SDK/Tailwind
major change does not constitute a verified fix for this SDK 57 app.

Rust uses jsonwebtoken with the AWS-LC backend, not its RustCrypto/RSA backend.
SQLx still resolves a MySQL-only RSA entry into the lockfile. The scoped
RUSTSEC-2023-0071 exception in `.cargo/audit.toml` matches Roamie's approach:
`scripts/ci/check-rsa-dependency.sh` rejects any reachable RSA package in normal,
build or dev graphs for all targets, and expires on the same review date. A
separate unmaintained `atomic-polyfill` warning remains in the lockfile and is
reported by cargo-audit; it is not a newly introduced application API.

No general package or severity exemption is used. Re-run the raw audits and the
gate on dependency updates, remove exceptions as soon as patched releases exist,
and never extend an expiry without a fresh exposure review.
