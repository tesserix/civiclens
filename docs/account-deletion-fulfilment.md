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
