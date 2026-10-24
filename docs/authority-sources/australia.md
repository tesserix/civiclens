# Australian authority register

The application prioritises municipal waste/litter services, relevant environment
and local-government departments/ministers, and state/territory police for public
safety. Ministerial escalation requires explicit moderation; it is not automatic
mass tagging. Emergencies must use emergency services rather than a social post.

## Source coverage, 24 October 2026

These are **reference records awaiting verification**, except the existing
reviewed City of Melbourne waste entry. A source listing does not establish
current tenure, legal jurisdiction, asset responsibility or an official social
account. The national register is a maintenance/review inventory, not a claim of
Australia-wide verified routing.

| Source | Records | Evidence and reuse |
| --- | ---: | --- |
| ABS LGA 2026 | 567 statistical references | [ABS FeatureServer](https://geo.abs.gov.au/arcgis/rest/services/ASGS2026/LGA/FeatureServer/0), ABS ASGS Edition 4, CC BY 4.0 |
| Commonwealth Directory | 1,552 | [Daily XML](https://www.directory.gov.au/sites/default/files/export.xml), [official dataset and CC BY 4.0 licence](https://data.gov.au/data/dataset/directory-gov-au-export) |
| Victorian councils | 79 organisations | User-downloaded [MAV council directory](https://www.viccouncils.asn.au/find-your-council/council-contacts-list), council names, websites and councillor/administrator links only; [source copyright](https://www.viccouncils.asn.au/copyright) |
| Open council candidates | 548 | [Wikidata](https://www.wikidata.org/), CC0; 528 current-area identity candidates plus 10 leadership claims and 10 associated people |
| State/territory service directories | 16 | Official police and environment/EPA directory links for all eight states/territories; original content retains agency licences; no page prose copied |
| Reviewed routing | 1 | City of Melbourne waste/litter; [separate boundary/responsibility review](README.md) |

Total: 2,763 source records. Some represent the same organisation in different
sources; this is not 2,763 distinct authorities. Commonwealth data includes 1,523
organisations, 18 relevant portfolio-role listings and 11 associated people. Only
those role-linked people are retained; personal contact fields and unrelated
people are omitted. Government exports may retain historical appointments.

The 567 ABS references contain 542 non-special statistical areas and 25
special/unincorporated/outside-Australia records. Non-special does **not** mean
"an elected council": some represent special administrative bodies. ACT and
external territories need their actual governance arrangements checked. ABS
explicitly says these boundaries are statistical approximations and should not
be used as legal boundaries; only identities are imported.

Wikidata candidates must match a unique ABS name and state/territory. An identity
claimed by multiple Wikidata entities is held out rather than choosing one.
Many Queensland predecessor cities and successor regional councils share a name.
Tenure and suggested websites remain unverified even when identity matches.
Names with Aboriginal-shire, conjunction and Victorian qualifier variants are
normalised only within the matching state and must remain unique.

The downloaded Victorian HTML supplies 79 council identity and leadership-page
references. It does not supply a verified current mayor list. The original saved
HTML stays outside Git; its SHA-256 is retained with the imported source version.
Contact emails, telephone numbers and addresses are not copied into snapshots.

The service-directory manifest stores the fetch status and response SHA-256 for
each link. Eight returned HTTP 403 during automated retrieval; those are explicitly
unverified, not successful source checks. Use an ordinary browser for allowed
manual review. No bot challenge or access restriction is bypassed.

## What must be verified before routing

For each council: legal/current identity and administrative status; gazetted or
state/council-provided boundary and licence; category-specific public-service and
asset responsibilities; official reporting/service page; social accounts linked
by the authority's own website; verification and expiry dates. A mayor or
administrator requires a current official council roster, term dates or effective
date, and a review after elections or leadership changes.

For police and environment agencies: verify the responsible state/territory,
non-emergency reporting path and remit. Public safety is not automatically a
police matter: the moderator checks urgency, the nature of the behaviour and
actual responsibility. Environment and litter may be split between a council,
EPA, transport agency, land manager and other departments. Environmental
ministers are an explicit escalation choice and are never inferred from a model.

Current verified routing remains City of Melbourne waste/litter. Nationwide
mayor, legal-boundary, responsibility and social-handle verification remains open.
Every area and its outstanding fields is retained in
[australia-coverage.json](australia-coverage.json).

## Refresh without paid datasets

Use Python 3.12+ and the standard library. Network sources are fixed official
hosts; redirects stay on the allowlist; downloads are capped at 32 MB and 30 s.
The national datasets must have plausible counts; truncated/duplicate responses
and XML entity declarations are rejected. Source preparation validates all inputs
before replacing output files.

```sh
python3 scripts/authorities/refresh_australia.py \
  --fetch --with-wikidata \
  --retrieved-at '<current UTC RFC3339 timestamp>' \
  --victoria-html '/path/to/saved/Council contacts list _ Vic Councils.html' \
  --output-dir api/data/directory
node --test scripts/ci/authority-register.test.mjs
```

The Victorian HTML is optional. Download it using the normal browser Save Page
feature if direct access is restricted. Its saved-file modification time records
retrieval. `--abs-file`, `--government-file` and `--wikidata-file` support already
downloaded, unchanged source files. Retain source timestamps accurately. Inspect
the diff, count changes, licence/attribution and coverage gaps before committing.
Do not label imported candidates as verified to make a coverage number increase.
Update `state-services.json` from each official agency page and retain fetch
status/hash and the source copyright/terms.

## Database and audit

Migration `0005_authority_directory.sql` creates append-only import and record
ledgers plus a current-snapshot view. The API runtime role has read access only.
A complete source snapshot commits atomically; duplicate input is idempotent;
older source retrievals cannot replace newer versions. Removed entries leave the
current view and remain in history. Empty withdrawals remain visible in status.
The import/version hash proves exactly which normalised file was ingested, and
the upstream hash identifies the original response or saved source file.

The migration command imports bundled reference manifests and reviewed routing
records. Reference imports cannot claim reviewed-source identity or routing
eligibility. `directory-status` reports source versions, hashes, counts and
regional gaps and the importing database principal without printing contact details. Local administrator commands:

```sh
cargo run -- migrate
cargo run -- directory-status
cargo run -- import-directory /path/to/reviewed-reference-snapshot.json
```

Use isolated local database configuration for local commands. Deployed
credentials stay in OpenBao; live changes use the existing GitOps migration job
and reviewed image. Refreshing reference data never silently enables publishing.
The API loads the current reviewed-source snapshot from PostgreSQL on startup;
expired entries stop matching. See [ADR-0005](../adr/0005-authority-register.md)
for sizing, failure behaviour, migration and rollback constraints.
