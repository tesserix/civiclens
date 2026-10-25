# ADR 0013: Private account photos and short biographies

Add optional account photos and a 280-character biography to the existing API and
Postgres users row. These fields are owner-only account settings and never enter
reports, public community cards, captions, share packages or client logs. The
nickname remains the public identity. Photos can identify their owner; importing
a sign-in photo is an explicit choice.

Pilot assumptions: 10,000 accounts, 1,000 profile reads/day and 100 saves/day, 10×
peak below 0.12 requests/sec. Bound sanitized JPEGs to 256 px and 96 KiB, bios to
280 Unicode characters and incoming encoded photos to 2.8 MB. At 3× annual growth,
the upper storage bounds are about 1 GB at 12 months and 9 GB at 36 months. Reuse
Postgres with no additional service cost; object storage is the next step if real
profile volume warrants it. Target the existing 99.9% availability and <500 ms p99
metadata budget; image imports have an eight-second network deadline. These are
planning targets, not measured production guarantees.

Authenticated GET/PUT `/v1/me/profile` always scope SQL to the verified session.
PUT is idempotent and preserves a photo unless replacement/removal is explicit.
All input is bounded and photos are decoded/re-encoded off the async runtime under
the existing image semaphore, stripping original metadata. Database checks enforce
lengths and runtime UPDATE grants are limited to the new columns. With Postgres
down, writes fail and the editor retains its unsaved fields.

Request the standard OIDC `profile` scope. Only an allowed HTTPS `picture` claim
from an already verified broker token may become an import candidate. Do not
persist names, email or provider access tokens. Accept only the configured broker
asset path or the named Google photo CDN hosts, default TLS ports and no URL
credentials/fragments. The import endpoint takes no caller URL, follows no
redirects, bounds the downloaded body to 2 MB and revalidates the stored candidate.
Missing photos, Apple private profiles, provider outages and disallowed hosts
leave manual photo upload available. Imported bytes are previewed before Save.

The additive migration is local-only until explicit live migration approval.
Old clients ignore the new capability; new clients explain when the server has
not enabled profile editing. Roll back application code first; preserving the
unused columns is the non-destructive rollback. A scratch-only down script may
drop the new columns and necessarily loses those test profile fields.

Account export/erasure must include all three fields; ordinary user deletion
removes the photo bytes and candidate URL. No public profile endpoint, directory
listing, general-purpose URL downloader or automatic provider-photo overwrite is
introduced. Real identity and session credentials remain on their existing
private boundaries; new paths add no deployed credentials or cloud changes.
