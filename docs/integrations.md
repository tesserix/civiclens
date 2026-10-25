# Platform integrations and authority verification

## Sign-in

Google, Apple, and Meta use brokered authorization code + PKCE. Apple is offered
on iOS. CivicLens uses its own social-only organization, created through the
Zitadel operator, plus separate native iOS/Android clients. The callback is exactly
`civiclens:/auth/callback`; provider callbacks return to Zitadel. Provider secrets
stay in product/environment-scoped OpenBao paths and never enter Expo public
configuration.

All managed clients use Login V2. The operator owns the organization policy,
provider configuration, and cobalt/light theme. Manual signup, passwords,
passkeys, and automatic account linking are disabled. First social login creates
the broker account automatically when its required profile is present. Meta must
grant email access and may require broker email verification. Its V2 Generic
OAuth mapping requires the pinned v4.19.5 broker patch; V1 actions are not used.

Read the project status receipt for the actual organization/provider IDs, and the
native application receipts for client IDs. Configure the API only after real
first/returning account tests succeed. Test Google and Meta on both platforms,
Apple on iOS, cancellation, nonce replay, wrong organization, and expired tokens.
A configured connector ID or Ready claim alone does not prove a social provider's
external app approval, callback allowlist, or Services ID is working.

## User-owned social sharing

Users own their Facebook groups/Pages, WhatsApp groups/Channels and Instagram or TikTok
accounts, and manage invites/members in those services. CivicLens offers only
user-owned sharing in the new report UI; no country-Page mode or demo path is
shipped. Google/Facebook/Apple sign-in remains separate from sharing. Users need
no additional login or publishing token in CivicLens for the native share sheet.
Do not merge Google and Meta identities by matching email addresses.

With the reporterSharing capability, owners can prepare their own confirmed
reports immediately for any one, several or all selected channels. Moderator
approval is not required for this native sharing path (ADR-0018). `POST /v1/reports/{id}/share-package` validates
owner identity in SQL, current rules, selected channel, explicit reporter/identity
confirmation and the exact photo count. It screens the final caption, includes
only freshly verified authority tags and returns 1–5 metadata-stripped photos.
Missing authority coverage omits those tags without blocking an awareness post.
Requests without reporter confirmation retain the legacy independent-review gate. The client repeats this check immediately
before each handoff. Manual approval creates no automated publisher jobs.

Each platform gets its own caption preview and explicit handoff button.
The OS opens one app at a time; users select the matching account/group/Channel
and confirm there. Share-sheet completion or cancellation is never recorded as
provider delivery. External apps may omit caption text, limit attachments or offer
no group/Channel destination. Users must inspect the final content and destination.
CivicLens cannot promise that every installed app supports every destination.

Only the nickname is included in CivicLens captions. The external platform may
show a profile name, username, Page name or phone number; users acknowledge this
before preparing the post. Never claim that CivicLens can replace a platform's
sender identity. Existing managed publication records remain readable for API
compatibility. Managed publishing remains disabled in the rollout configuration;
new clients cannot request it through the UI. No new country Page credentials,
Graph staging workflow or country-publication migration is part of this release.

### Verified platform boundaries

Official Meta documentation checked in Chrome on 25 October 2026:

- [Graph API v19 announcement](https://developers.facebook.com/blog/post/2024/01/23/introducing-facebook-graph-and-marketing-api-v19/):
  Facebook Groups publishing API and its permissions were removed across versions.
  User ownership/admin status does not restore automatic third-party posting.
- [Instagram API with Instagram Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login):
  automated publishing requires an authorized business/creator professional
  account. This login path does not require a linked Facebook Page. Scopes include
  `instagram_business_basic` and `instagram_business_content_publish`.
- [WhatsApp Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/),
  updated 15 October 2026: Official Business Account required, invite-only,
  at most eight participants, per-message pricing. Ordinary group invites are
  not credentials. Automated country Channel publishing remains unverified.

User-owned native sharing does not remove the requirements for a future automated
provider adapter. That would still require a working CivicLens Meta app, supported
assets/scopes, explicit owner-bound OAuth state/PKCE, owner-scoped OpenBao token
storage, refresh/revocation/deletion and reliable provider receipts. The existing
Meta wizard cannot select the restricted Tesserix business portfolio, whose appeal
is in review. No dedicated CivicLens Meta app or new provider credentials have
been issued. Do not bypass the restriction with replacement identities.

All deployed application credentials stay in environment-specific OpenBao paths
with civiclens-prefixed names. The existing broker/database/identity/AI paths are
unchanged. Private GCS uses Workload Identity, not a static key. Native sharing
adds no Facebook/Instagram/WhatsApp credentials to the mobile app or backend.

## Writing assist gateway

The API reaches the model only through the dedicated agentgateway at
`http://civiclens-ai.agentgateway-system.svc.cluster.local:8080`, using the
OpenAI-compatible `/v1/chat/completions` contract and logical model
`civiclens-compose`. Production rejects any other URL. `tesserix-k8s` owns the
gateway (`charts/apps/civiclens-ai-gateway`): Vertex Gemini in
`tesseracthub-480811` through the `agentgateway-llm` Workload Identity binding,
strict API-key authentication with rate and token limits, an Istio policy and
NetworkPolicy admitting only the `civiclens-api` service account, and an egress
policy on the API side. The client key lives in OpenBao as
`civiclens/prod/app/civiclens-ai-gateway-key` and reaches both the gateway and the
API through namespace-bound readers. Rotate it by writing a new version and restarting the
API; no code change. Without the key the feature is simply hidden.

## Authority directory

`api/data/authorities.json` starts empty. It is a reviewed, versioned list of
offices, country codes, categories, GeoJSON Polygon/MultiPolygon jurisdiction
boundaries, official/source URLs, verification/expiry timestamps, official handles
and optional parent IDs. Unit-test fixtures are fictional and never loaded by the
application. Copy no names or handles from an unverified search result.

GPS works in any country. Device reverse geocoding suggests the locality; the
user confirms it. Coordinates inside exactly one verified office boundary produce
a routing candidate. Boundaries, ambiguous overlaps, expired sources and absent
entries hold the report. The review step repeats the match with current data.
Escalation to a state office/CM or police leadership requires reviewed parent
entries and a moderator's explicit selection; never tag unrelated senior officials.

A future discovery worker can use licensed search APIs and official directories
to propose candidates with citations and fetched timestamps. Search engines and
Google Maps do not establish legal responsibility or current office holders;
automated discovery must feed verification, not silently create public tags.

## TikTok — user-confirmed sharing

TikTok is a manual destination for reporter-confirmed reports. The phone's
share chooser can hand off the sanitized JPEGs and caption if a suitable app
accepts them. When TikTok is absent, Save photos, Copy TikTok caption and
Open TikTok provide an explicit upload path. The user selects their own account,
checks attachment order and caption, then confirms in TikTok. Native chooser
completion never confirms publication. See ADR-0014 for permissions, partial-save
behavior and the physical-device verification gate. Registered Share Kit/Content
Posting API integration is not configured; no TikTok credentials are needed by
this manual path.
