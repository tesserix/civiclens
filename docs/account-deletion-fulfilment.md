# CivicLens account-deletion fulfilment

Owner: sales@tesserix.app, following the existing Tesserix/Roamie 30-day process.
An authenticated in-app request is sufficient; do not require another email,
phone call or reason. The new API records pending work, not an automatic erasure.
The product owner confirmed the existing Tesserix contact and adults-only launch.
Before activation, verify the owner's daily queue access and a disposable-account
drill; a document alone does not establish an operational process.

## Queue and identity

Use the authorized read-only database access workflow. Never export query results,
subjects, photos, email or tokens into logs, Git, public issues or screenshots.

```sql
SELECT d.id, d.user_id, u.identity_subject, d.requested_at, d.due_at
FROM civiclens.account_deletion_requests d
JOIN civiclens.users u ON u.id = d.user_id
WHERE d.status = 'pending'
ORDER BY d.due_at, d.id;
```

Review daily and escalate before the original 30-day deadline. Repeated requests
do not extend it. The runtime role can insert request ID/user ID and read receipts;
it cannot mark completion, set a different deadline, erase requests or grant roles.
Use only the verified subject in the configured consumer-civiclens organization.
Legacy rows without a subject need verified identity recovery; do not guess based
on a nickname or delete another product's identity. The next verified login fills
this field. Retrieve the verified email from the identity service for confirmation.

## Fulfil a verified request

1. Under separately approved production deletion, capture minimal recoverable state
   in restricted storage with an expiry. Record the request ID and exact scope.
2. Quiesce this account's writes, sessions and publishing before erasure. Revoke
   CivicLens access and sessions through the identity service's supported process.
   Handle Apple token revocation with the broker's held provider tokens; if those
   are unavailable follow Apple's documented alternative, still fulfil local
   deletion, and inform the user how to revoke Apple authorization. Do not delete
   the underlying Apple/Google/Meta account or other Tesserix product identities.
3. Resolve any sending/uncertain publication before removing its evidence. Remove
   CivicLens-controlled external posts through the provider and retain minimal
   receipts; distinguish third-party reposts outside our control. No automatic
   deletion of a queue row is proof that a provider post disappeared.
4. Inventory this user's reports/photos/coordinates/text, approvals, publication
   captions/provider IDs, roles, sessions, support correspondence and identity.
   Include audit rows where actor_id is this user OR report_id belongs to this user;
   free-text reconciliation notes can contain personal data. Preserve other users.
5. Perform a reviewed privileged transactional purge/anonymization in dependency
   order. The runtime cannot bypass the append-only audit trigger: use a separately
   reviewed owner procedure, not a runtime permission expansion or indefinite
   retention excuse. No destructive purge script is implemented by this change.
6. Check processors and backup expiry, restrict any genuine legal retention, and
   explain the actual category/reason/expiry in the confirmation. The inspected
   GitOps base declares a three-day CNPG retention policy; this is not proof of
   effective object deletion. Verify live backup, bucket soft-delete/lifecycle and
   archive retention before stating a date. Restores must reapply outstanding
   deletions before serving traffic. Expire temporary recovery captures too.
7. Confirm absence in active stores and provider acknowledgements. Email the verified
   address with completion, exceptions and the local-device/shared-copy instructions.
8. Only then mark the request completed with a minimal restricted completion reference.
   Mark completion before setting user_id NULL/removing the user; schema checks reject
   an orphan pending request. Remove unnecessary identity/contact details in evidence
   according to the verified retention policy. Never use status alone as proof.

## Release gate

The initiation endpoint, UI and public pages are tested locally. They must not be
marketed as completed erasure. Production activation requires specific schema/API
rollout approval, staffed fulfilment, a successful end-to-end deletion drill,
public HTTPS policy links, backup/restore handling and store disclosures. Build
0.1.1 (4) predates these changes. No real account or production data was deleted.

## Participation and complaint data (migrations 0007–0010)

Before exporting a verified account, inventory `community_cards.owner_id`,
`community_responses.user_id`, `community_opinions.owner_id`,
`community_flags.reporter_id`, `complaint_intents.owner_id` and
`official_complaint_requests.owner_id`. Include review
references to that user, their private choices/consent timestamps, drafts, prepared
text/destination snapshots and relevant audit identifiers. Political opinions and
support choices are sensitive; deliver exports through verified restricted access,
never a public issue or a shared link with broad access. Do not expose other users'
choices, flag reporters or private identities in someone else's export.

For approved erasure, resolve dependent flags, opinions and responses for owned
cards, retaining other contributors only under a reviewed anonymization/retention
policy. Remove this account's responses to other cards; final aggregates may change
unless a separately reviewed anonymous aggregate policy is introduced. The schema
uses RESTRICT deliberately; no cascading deletion is presented as compliance.
Review `reviewed_by` references and append-only audit evidence before removing a
user. Complaint preparation snapshots must be included before report deletion.
Blocked official-request snapshots include the selected administrative district,
provider/readiness metadata, consent audit references and creation time. Include
these private records in verified exports and resolve their RESTRICT references
before deleting an owned report/account under approved erasure. Internal IDs are
not police references; there is no government submission to revoke in this version.
Official-form submissions are controlled by the government service; CivicLens has
no government receipt or deletion authority merely because a form was opened.
Native saved evidence and third-party copies need the user's separate removal.
No erasure automation or live purge is introduced by this expansion. Staffed
fulfilment and an account export/erasure drill remain launch requirements.

## Private account profile

Include `users.profile_bio`, `users.avatar_jpeg` and `users.sign_in_photo_url` in
the owner-scoped export and erasure inventory. Export the sanitized JPEG as a
private file, not a public URL. Erase all three fields when anonymizing an account;
ordinary row deletion also removes them. Do not leave an imported-photo candidate
in an anonymized user row. Backup expiration and restore reapplication cover
these fields too. No user access token is retained by this feature.

## Private community safety records (migration 0013)

Include the account's outgoing `community_user_blocks.blocker_id` records and
`community_opinion_flags.reporter_id` concerns in its restricted export. Resolve
blocked accounts to public nicknames; do not export internal account identifiers,
incoming blocks or other users' confidential abuse reports. Opinion concerns
must retain the relevant opinion/card reference without exposing other reporters.

During separately approved erasure, inventory both directions of block
relationships and concerns on owned opinions. Foreign keys remove block rows
when either account is deleted and remove opinion concerns when the reporter or
opinion is deleted. Review the same audit, retention and backup-restore rules as
the existing participation data. Cascading row cleanup does not by itself prove
provider cleanup or completion of account erasure. No live purge is authorized
by this runbook update.
