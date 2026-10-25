# ADR-0017: Public static policy pages

## Context

GooglePlayConsole requests to the shared API hostname receive Bot Fight Mode
challenges. The scoped BIC exception repairs ordinary HTTP clients, but cannot
skip Bot Fight Mode. GitHub file-view URLs also do not reliably satisfy the
store's policy validator. Disabling shared-domain protection would affect other
products and is outside this change.

This is three public documents, under 50 KB combined, with a planning peak of
10 reads/second, effectively no online writes and constant storage at 12 and
36 months. These are sizing assumptions, not measured traffic. The operational
goal is 99.9% availability and p99 reads below one second, subject to the hosting
provider; neither has been measured or is promised as an SLA. Policy updates
can tolerate the host's cache propagation delay.

## Decision

Publish only the allowlisted `api/public/*.html` policies to GitHub Pages from
main. These canonical documents remain the source of truth. Rewrite only local
navigation URLs for the static site's subpath. The build test verifies unchanged
policy wording, functioning local links and the child-safety anchor. Existing
Markdown mirrors remain readable reference copies, not the preferred store URLs.

The build needs read-only repository access. Only the deploy job has Pages and
OIDC write permissions, bound to the `github-pages` environment on main.
Pin official actions to commit digests. Publish no private data, app bundle,
credentials, analytics, forms or new application endpoint. No GCP/Kubernetes
rollout, database migration, Cloudflare change or paid plan is required.

## Operation and recovery

If Pages is unavailable, store policy links fail; authenticated app reporting
and the existing API policy routes continue independently. Check all three
public URLs with ordinary HTTP clients and Google's validator after deployment.
Re-run the workflow at a reviewed prior commit to restore policy content, or
point the store back to a verified accessible policy host. Do not assume the
challenged API route is a working rollback destination for Google.

Enabling Pages and the first public deployment require the owner's named rollout
approval. Subsequent policy changes go through review and CI. Expected hosting
cost is zero within GitHub Pages limits. The simpler GitHub file view was tried
and did not reliably pass validation; a new server or paid bot-management plan
would add unnecessary cost and operations.
