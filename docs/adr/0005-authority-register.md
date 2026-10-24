# ADR-0005: Audited authority register in PostgreSQL

Status: accepted for implementation, 24 October 2026.

## Context and scope

Australia-wide discovery requires a maintained record of council identities,
waste/litter services, environmental departments/ministers and police. A web
listing, statistical area or politician's name does not prove responsibility or
permission to publish. ABS explicitly limits its LGA geometries to statistical
use. Government Directory exports include historical people and appointments.

## Decision

Store immutable source snapshots and their records in the existing PostgreSQL
schema. Every import retains source URL, licence, attribution, retrieval time,
upstream SHA-256 and imported-file SHA-256. The current register is the latest
complete snapshot per source; omitted entries leave current coverage but remain
in history. Import and all records commit atomically under a per-source lock.
Identical imports are idempotent; older snapshots cannot replace newer ones.
The runtime role can read the register and cannot modify it. Import commands use
the existing administrator credentials and GitOps migration job.

Reference sources cannot produce a verified routing record. Existing reviewed
GeoJSON authorities use a separate trusted import path and the same immutable
ledger. The API loads only that reviewed source into its routing snapshot at
startup, preserving source/category/boundary/expiry/ambiguity checks. A source
refresh takes a reviewed data commit and rollout. No AI/network lookup occurs in
a user's report request, and no source-provided contact email, mobile, postal
address or unrelated person's details is retained.

Free official sources first: ABS 2026 area identities (reference only), the daily
Commonwealth Directory export (organisations and relevant ministerial roles),
and official state/council police and environmental service directories. Keep
missing mayor, legal boundary, responsibility and social-account verification
explicit. Reference completeness and verified routing completeness are different
measures. Emergency guidance and police referral must not depend on social tags.

## Sizing and failure behaviour

Planning assumptions: 2 peak previews/sec, under 1 KB requests/10 KB responses,
100:1 reads to revisions; 5,000 records at 12 months and 15,000 at 36 months, 2 KB
average reference record; quarterly full snapshots retain roughly 40 MB and
120 MB/year respectively, excluding reviewed geometries. Budget p99 preview
under 500 ms and 99.9% availability, unmeasured pilot targets. Reuse the existing
five-connection API pool; no new service, datastore, recurring AI cost or source
requests in the read path. Imports capped at 20,000 records/32 MB and batched
inside one transaction. Benchmark before much larger country imports.

A failed fetch/import leaves the previous committed snapshot. A database outage
prevents API startup rather than silently serving invented data. Expired reviewed
authorities remain in the audit ledger and stop matching. Duplicate deliveries
have no duplicate rows/audit versions. A crash before commit exposes no partial
snapshot; a crash after commit is safe to retry.

## Migration, rollback and operations

Additive tables/views only, with lock and statement deadlines. Test on isolated
PostgreSQL before delivery. The existing migration job creates the schema and
imports bundled snapshots before the API starts. No user/report rows are changed.
Operational status reports counts and source versions, never provider secrets or
private contacts. Export those counts to a checked-in coverage record after QA.

The audit history is intentionally irreversible in production. A rollback is a new reviewed revert image that retains migration 0005 and the
register importer/schema while reverting the faulty application behaviour. Direct
use of an older image can fail SQLx migration-history validation because that
image lacks migration 0005. Retain the additive register tables. A later
withdrawal is a new source snapshot, never deletion of history. Scratch tests may drop their isolated schema to reverse the migration.
No new infrastructure cost; source review/maintenance labour remains necessary.
