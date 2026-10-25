# Google Play Data safety audit — 25 October 2026

Reviewed the owner's `data_safety_export.csv` from Downloads without changing
the original. The export contains 782 response rows. A source hash, exact
response changes and a corrected import file are retained under the ignored
`artifacts/releases/1.0.0-android9/` release directory.

## Required additions

- Approximate location: report locality labels and optional community town/country
  information are retained separately from precise report coordinates.
- Other actions: account-linked poll responses, support choices, saved items and
  moderation/audit actions persist for app functionality and abuse prevention.

The prepared CSV adds these two collected data types as optional, not ephemeral,
and used for app functionality. Other actions also declares fraud prevention,
security and compliance. Eleven existing response values change; the schema,
782 rows and all other responses remain unchanged and round-trip validation
passed. The corrected CSV has not been imported or saved to Play Console.

Google's definitions distinguish city-level approximate location, open-ended
user content such as bios, and other actions such as likes and dialog choices.
See [the official Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).
The existing collected-only answers were preserved: clearly user-initiated
transfers and service-provider processing have stated sharing exemptions.
Social handoff is not automatic delivery, and precise report coordinates remain
outside public exports.

## Existing answers checked

The export already declares OAuth account creation, encryption in transit, names
(which Google's definition includes nicknames), email addresses, account IDs,
precise location, photos and other user-generated content. Optional photo/bio
and report/community content remain distinct from mandatory account identity.
No independent security certification or automatic 90-day deletion is claimed.

Android candidate 9's actual manifest disables Expo Updates and contains no
advertising-ID or broad photo-library read permission. Its embedded bundle uses
the production HTTPS API. These checks do not establish that every possible
third-party data flow or every legal obligation has been independently audited.

## Outstanding Console gates

Google's deletion-URL validator still returned HTTP 403 for the correct public
deletion URL. The separately approved API header fix is deployed and verified:
all three legal pages now return `no-store, no-transform`, retain CSP, and expose
usable mailto contacts without Cloudflare email rewriting.

The owner approved a GET/HEAD-only Browser Integrity Check exception for the
three CivicLens legal paths. It is not applied: the available Cloudflare token
receives unauthorized responses for custom WAF, configuration rules and Page
Rules. The owner dashboard is logged out. No zone-wide setting or unrelated
product was changed, and the validator was not bypassed.

The child-safety policy URL and confirmed business contact are prepared in
Console. The two legal declarations remain unchecked and unsaved until the
published URL/reporting prerequisites and owner attestation are complete.

Manual Play uploads remain necessary because automatic approval review rejected
automated uploads. Brand assets were previously uploaded by the owner and saved;
the four Android screenshots and production AAB still require manual selection.
