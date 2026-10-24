# ADR-0008: user-owned communities and reviewed native sharing

Status: local implementation; no live rollout.

## Context

Users want to own their Facebook groups/Pages, WhatsApp groups/Channels and
Instagram accounts, including membership and moderation. Ownership does not
grant CivicLens unsupported APIs. Meta deprecated Facebook Groups publishing;
WhatsApp Groups requires an Official Business Account and allows eight members.
Instagram automated content publishing requires an authorized professional
account. Those provider authorizations still require a functioning Meta app.

Reuse ADR-0007 sizing: 1,000 reports/day, 0.12 peak submissions/s, up to five
sanitized photos (30 MB decoded). One export per approved report adds at most
0.6 object reads/s and about 10 GB/day typical egress before retries. Target
package preparation within 75 seconds, metadata p99 <500 ms and 99.9% eventual
production availability; these are assumptions requiring measurement. At an
assumed $0.12/GB, 300 GB/month adds about $36 egress; get regional pricing before
rollout. Export is an optional feature; storage/safety outages hold it and leave
the saved report unchanged. No new service, queue or identity store is needed.

## Decision

Offer user-owned sharing only in the new client UI. Keep existing managed report
records readable. New drafts use manual sharing; restoring an old managed draft
resets consent and the submission key before switching to manual sharing.
A moderator still reviews every image, public text, locality and verified routing.
Manual approval never creates a publisher job or requires a CivicLens Page token.

An authenticated owner requests a package for one selected channel and explicitly
acknowledges that their external social identity may be visible. The server checks
ownership in the query, approval, all-photo review, current rules, current verified
authorities and content safety again, then returns only the reviewed caption and
sanitized ordered photos. Responses are private/no-store and request concurrency
is bounded. Audit package preparation without content, names, exact GPS or tokens.
Requests are read-like exports: retries may prepare a package again, never post.

The client supports one, several or all selected destinations, previews each
reviewed caption, explains identity disclosure and obtains
an unchecked acknowledgement before opening the native share sheet with up to
five images. Users choose their app/destination and confirm there. Cancellation
or share-sheet completion never marks a social publication sent. An installed app
may ignore caption text, restrict attachments or offer no group/Channel picker;
check the destination and final content in that app. Do not promise delivery.

CivicLens retains the nickname in its caption and never copies real names from
Google/Meta into reports. The destination platform controls the author identity;
it may show profile name, username, Page name or phone number. Do not claim
anonymous/pseudonymous authorship outside CivicLens. Community creation, invite
links, membership and group administration remain in the destination app.

Keep Google/Facebook/Apple sign-in independent of publishing. Native sharing
needs no additional provider login, access token or matching email. If automated
Page/professional-account publishing is added later, connect explicitly from the
signed-in CivicLens account, use state/PKCE and server-bound identity, store
owner-scoped tokens in OpenBao, and support revocation/deletion. Never merge users
by email or silently link sign-in accounts. No invented WhatsApp consumer login.

## Rollout and alternatives

Add optional JSON fields and generated contracts; no schema migration for manual
mode. Existing managed outbox behavior is retained. A native multi-image sharing
module requires a fresh development/store binary; old binaries cannot receive it
through JS-only updates. Enable the manual capability only with the matching tested backend and native
binary. Rollback disables manual submission/export and keeps approved
reports; do not drop data. Migration 0006 for private photos remains a separate approval gate.

Reject user-owned OAuth as a universal groups solution: the APIs remain
unsupported/restricted. Reject sharing drafts or unreviewed images: violates the
privacy/authority boundary. Reject treating share-sheet completion as delivery:
there is no provider receipt. Reject an in-app member directory: destination apps
already own that data and consent. Native handoff simplifies the current request;
automated posting to supported assets is a separate future integration.
