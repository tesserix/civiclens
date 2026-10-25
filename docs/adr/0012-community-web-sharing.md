# ADR 0012: Public community links and installation fallback

Share approved community cards with stable HTTPS URLs on the existing public API
host. The host is taken from the existing EAS release configuration, not invented.
Use one public manifest for domain, Apple team/bundle/store identifiers and Android
package/signing fingerprints. These are public metadata, not application secrets.

Planning assumptions: 10,000 share opens/day at 10× daily average is about 1.2
peak reads/sec, with roughly 10 KB HTML plus the existing 1.1 MB icon per cold
preview. Reads dominate writes; links add no stored rows at 12 or 36 months.
The existing API's unmeasured 99.9% availability and p99 <500 ms metadata targets
apply. This adds no service or datastore. Egress depends on social preview caches;
without caching, the stated traffic could transfer roughly 330 GB/month of icons.
Reuse the existing host before buying a link-redirect provider. Database failure
makes previews unavailable; it must never expose cached withdrawn content.

An authenticated share-link endpoint repeats current approval and content-safety
checks and returns a stable URL with reviewed question/context only. The native
share sheet lets the user choose an installed social/messaging app. Opening that
sheet does not establish delivery. Unapproved/hidden cards cannot be newly shared.
Legacy servers retain their existing custom-scheme handoff.

An unauthenticated landing page selects only approved-card public text, not user
identity, saved interests, individual votes or interim aggregates. Escape every
HTML/attribute value, use strict CSP and no-store headers, and include Open Graph
metadata and the existing CivicLens icon. Hidden/pending/unknown cards return 404.
Third-party social preview caches cannot be recalled after withdrawal.

Host AASA and Android Digital Asset Links at the standard .well-known paths. Add
the matching associated-domain/intent-filter settings to the native app. Installed
apps use OS-verified links; browsers show the public preview and app/store choices.
Avoid fingerprinting, custom-scheme timeout guesses and fabricated deferred links.
After installing, users may need to tap the original link again to restore the
specific question. Preserve the existing sign-in destination restoration.

Store links are built from the real configured App Store ID and Android package.
Show download actions only after listing availability has been verified. Public
listings were not verified at implementation time; beta-only installs and absent
Google Play distribution must not be presented as public downloads. An empty
Android signing-fingerprint list produces no association claim. Do not substitute
a debug key for Google Play App Signing's public certificate.

Use a loopback-only origin override for local development. Production must match
the canonical manifest origin; never construct share URLs from an untrusted Host
header or caller-supplied redirect. No live domain, store release or cloud change
is authorized here. Hosted verification files, valid Play signing fingerprints,
new signed native builds and approved public listings are separate launch gates.

Verify approval withdrawal, anonymous preview privacy, escaping, unknown paths,
store-disabled behavior, canonical URLs, link manifests, native share cancellation,
late-account responses and restored deep links. Use Apple for device QA; do not
start an Android emulator or publish real posts during validation.
