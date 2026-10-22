# Authorization policy

The mobile app is an untrusted client. The API derives identity from a validated
session, never a user ID, role or nickname submitted with a report. Browser CORS
is not an authorization control. All public responses use `Cache-Control: no-store`.

| Caller | Allowed |
| --- | --- |
| Unauthenticated | Health, readiness, public capabilities, rate-limited sign-in challenges and token exchange |
| Signed-in reporter | Own profile, create report, list/read own reports, revoke own current session |
| Moderator | Reporter abilities plus review queue, sanitized photos and approval of others' reports |
| Operator | Reporter abilities plus reconcile held, failed or uncertain publishing outcomes |
| Database migration administrator | Explicit schema migrations and offline role grants; never embedded in the mobile app or runtime container |
| Publisher worker | Only approved outbox jobs; separate from a mobile account's social identity |

Roles are checked against `user_roles` on every privileged request. There is no
signup role field or role-grant HTTP endpoint. A moderator cannot approve their
own report. Another reporter's report ID returns 404. Missing/expired/revoked
sessions return 401; an authenticated principal without the required role gets
403 before object lookup. Publishing approval is transactional with the outbox.

`grant-role USER_UUID moderator|operator` is an offline administration command
using a migration/admin database connection. Role writes are denied to the
runtime database role. Grant execution is audited with its target user and role;
the platform database audit must identify the human invoking the admin command.
There is no shared moderator bearer credential in production.

OIDC uses Tesserix Zitadel, as Roamie does: native authorization code + PKCE,
AuthSession state verification, server-issued one-time nonce, then ID token
validation with trusted JWKS, RS256 only, fixed issuer, CivicLens client audiences,
expiry, exact nonce, and the CivicLens resource-owner organization claim. The
Google/Apple/Facebook choice is a broker routing hint;
the broker's policy controls which upstream methods are enabled. It is not a
separate account-linking mechanism. Automatic account linking is disabled by the CivicLens organization policy. The API persists an HMAC of issuer/subject
and a nickname, not the provider token, name or email.

Mobile sessions are random 256-bit bearer values with a 30-day expiry, SHA-256
hashes at rest, and OS SecureStore on-device. Web preview keeps sessions in memory.
Reauthentication after session expiry is required. Logging out revokes the current
session on the server before clearing the local credential; an offline revocation
failure is shown. Recovery, deletion/export and logout-all need implementation
before a public launch. A nickname provides public pseudonymity, not anonymity
against the service, network providers or identifiable content in the photo.

Connection-IP rate limiting is per process; ingress must enforce a distributed
limit in production and must not trust arbitrary forwarded-IP headers. Requests
are limited to 8.1 MB and 20 seconds. At most two image decoders run per process;
their permits remain held even if the HTTP request is cancelled. Images are decoded under limits and re-encoded
as JPEG, stripping metadata; no arbitrary URL fetch is permitted. Moderators must
visually check faces, plates and other identifying details. There is no automated
face detection/redaction claim.

Apply [runtime-grants.sql](../deployment/platform/runtime-grants.sql) after the
reviewed migration. Runtime can read roles but cannot grant them, run DDL, modify
audit rows or access another product's schema. Schema owner and application
credentials are separate OpenBao secrets. Rotate through the platform procedure;
changing the identity HMAC key without a migration would orphan account mappings.

The public deployment hostname is `https://civiclns-api.tesserix.app`. Its gateway
routes `/v1/` only, with no automatic POST retries. Health/readiness remain
cluster probes. Capabilities and rate-limited login bootstrap are available
before authentication; report data and privileged operations always use the API's
session, ownership, and role checks. Mobile release/preview builds use this HTTPS
origin. A public hostname does not grant access to application data.
