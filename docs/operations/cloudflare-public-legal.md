# Public legal-page crawler access

## Desired configuration

`cloudflare-public-legal.json` records the narrowly scoped, owner-approved
Browser Integrity Check (BIC) exception. It applies only to GET/HEAD requests
for the three named public legal pages on `civiclns-api.tesserix.app`.
Other methods, paths and hosts do not match. Other security components remain
unchanged; matching-request logging stays enabled.

The trust boundary is Cloudflare's public edge. Anonymous clients can read
these public documents without BIC; the exception does not grant access to
private API data or bypass application authorization, custom rules, rate
limiting or other WAF components. Attackers can also read these public pages.

## Ownership and application

Dashboard account: `Unidevidp@gmail.com's Account`.
Zone: `tesserix.app` (`5db381ab8d920d8f48f40b1b950beb79`).
Custom ruleset: `e81bfc587c1544c698828d99648480d8`.

No Terraform or GitOps owner for this ruleset was found in the inspected
infrastructure checkout. This is a dashboard-managed exception, with the
desired configuration retained here for review and recovery. The available
automation token cannot edit the ruleset; do not widen its permissions to
apply this rule. Use the authenticated owner dashboard and the required
action-time browser confirmation.

Before deployment, the dashboard showed four existing custom rules. Place
this rule after the Agent Registry rule and before Allow Country, preserving
the relative order and configuration of every existing entry. Allow Country
skips all remaining custom rules, so appending the exception prevents it from
running for matching countries. Select only **Browser Integrity
Check** in the Skip components, keep logging enabled and the rule active.
Confirm the expression matches the JSON exactly. The owner approved deployment
on 25 October 2026. The dashboard confirmed active rule
`10193714f04a41caa1c1d5e051d769e5`; initial checks exposed the ordering issue
above. Reachability verification must follow the corrected placement.

## Verification and recovery

After deployment, record the new rule ID and time. Fetch privacy, terms and
account-deletion with both Python's default HTTP client and curl; verify
HTTP 200, the expected document text, usable mailto links and
`Cache-Control: no-store, no-transform`. Retry Google's deletion-URL validator.
These observations establish reachability only for the clients tested.

Keep the deployed rule and verification receipt in the release artifacts.
If a rollback is explicitly approved, disable this exact rule by its ID;
leave every pre-existing rule unchanged. Disabling it restores the previous
BIC evaluation for these paths. No application image or database migration
is part of this change. This uses the remaining free custom-rule slot and
does not purchase a plan or add a paid service. Existing edge request logs
are the appropriate observation surface; no application SLO alert changes
are needed for this exception.
