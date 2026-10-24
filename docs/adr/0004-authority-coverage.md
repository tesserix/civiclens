# ADR-0004: Verified authority coverage grows by municipality

Status: accepted for pilot, 24 October 2026. Storage is superseded by
[ADR-0005](0005-authority-register.md); verification and preview rules remain.

The directory was empty, so every valid preview returned the same unverified
message. Global coordinate support does not establish service responsibility.

Keep the existing in-process, versioned GeoJSON directory and authenticated
read-only preview endpoint. Add an optional reason to unverified previews:
country_not_covered, area_not_covered, category_not_covered or review_required.
Older clients ignore it; newer clients retain a generic fallback for older APIs.
Do not expose expired or ambiguous offices or change publication authorization.
No external source requests, AI calls, location persistence or retries are added
to lookup. If sources are unavailable, existing reviewed data works until expiry;
then publication remains held. A client timeout leaves the draft safe for retry.

Sizing assumptions: pilot peak 2 previews/sec, requests below 1 KB, responses below
10 KB, 100:1 reads to data revisions, 100 offices at 12 months and 1,000 at 36 months.
At 25 KB average geometry these are roughly 2.5 MB and 25 MB of source data, with
additional runtime geometry overhead. Target 99.9% availability and p99 under
500 ms with no external dependency. These are planning targets, not measurements;
benchmark before expanding beyond pilot coverage. No new infrastructure cost.
If measured lookup cost exceeds budget, use the existing Postgres with a spatial
index after a separate reviewed migration; global sharding is premature.

Start with an evidence-backed Melbourne waste pilot. Stage India research outside
runtime until current boundaries, licence and responsibilities are verified.
See [source review and expansion workflow](../authority-sources/README.md).
Countrywide rectangles and automatic web/AI-derived handles were rejected because
they misroute reports and can falsely imply government responsibility.

Data ships with the API image through existing CI and GitOps; no schema migration.
Roll out backend before relying on reason-specific mobile copy. Revert the data
commit and redeploy a reviewed image to withdraw a seed; old mobile clients stay
compatible. Publishing remains disabled for emulator QA. No new alert is needed
for this pilot; existing readiness/rollout checks apply and expiry is tested.
