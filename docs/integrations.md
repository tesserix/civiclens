# Platform integrations and authority verification

## Sign-in

Google/Facebook are offered through existing Tesserix Zitadel connectors. Create
dedicated CivicLens native clients using the supplied identity claims; callback
is exactly `civiclens:/auth/callback`. Meta's callback returns to Zitadel, not to
this native scheme. Do not add secrets to Expo public environment variables.

The existing Roamie onboarding notes identify unresolved Facebook connector
mapping/verification prerequisites. Revalidate those prerequisites before setting
`CIVICLENS_FACEBOOK_IDP_ID`; a configured ID is not evidence of a working login.
Test real Google and Facebook accounts on both Android and iOS. App Store review
may require an equivalent Apple sign-in option when third-party sign-in is offered;
resolve that requirement before store submission.

## Public social publishing

| Destination | Implementation | Required activation |
| --- | --- | --- |
| Facebook Page | Official Graph API photo upload; result requires a provider ID | Approved Meta app, Page permissions/token, Page ID, tested Graph version, runtime OpenBao secret, explicit enablement |
| Instagram | Jobs are held; no adapter yet | Supported professional account and official content-publishing access; implement durable container creation, poll/publish and approved public image URL delivery |
| WhatsApp group | Jobs are held; no adapter yet | Verify current official Groups API account eligibility and group support; implement only that supported API, or provide explicit user-initiated sharing |

An ordinary WhatsApp group invite is not a publishing credential. Do not use
unofficial WhatsApp Web automation. Account login permissions do not grant Page
or Instagram publishing rights. Facebook textual `@handle` references are not a
guarantee of a tag, notification or delivery to an official; platform-specific
mention rules must be verified. Neither the app nor this repo sends actual posts
without account configuration and live publishing enabled.

The reviewed caption contains the pseudonym, reviewed description/locality,
approximate coordinates and verified institutional accounts. It never copies
profile names, emails, raw provider claims or the unreviewed description. Requests
that time out or return ambiguous provider errors become uncertain; an operator
checks the Page before any retry. The receipt reports each destination separately.

Official references to recheck during activation:

- https://developers.facebook.com/docs/pages-api/posts/
- https://developers.facebook.com/docs/instagram-platform/content-publishing/
- https://developers.facebook.com/docs/whatsapp/
- https://zitadel.com/docs/guides/integrate/identity-providers/

These references document provider contracts; they are not a claim that the
corresponding accounts or permissions have been granted to CivicLens.

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
