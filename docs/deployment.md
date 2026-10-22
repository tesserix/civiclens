# Deployment handoff

No live rollout, migration, role grant, secret write or store submission has been
performed. All files under `deployment/` are reviewable inputs for the owning
`tesserix-k8s` workflows. They are not an instruction to apply directly.

## Verified target

Read-only discovery on 22 October 2026 found account `unidevidp@gmail.com`, project
`tesseracthub-480811`, context
`gke_tesseracthub-480811_asia-south1_tesseract-prod-in-gke` and healthy CNPG cluster
`global/global-postgres`, two instances ready. The read/write Service is
`global-postgres-rw.global.svc.cluster.local:5432`. Recheck identity, context and
RBAC immediately before any approved change; local instructions are not access.

Use **database `civiclens_db`, schema `civiclens`**, with separate
`civiclens_migrator` and `civiclens_runtime` roles on that cluster. Create no new
CNPG cluster, PVC or operator. API pool: five connections per pod, prepared
statement cache off, 15-second statement and 3-second lock timeouts. Two API pods
consume at most ten connections. Photos currently reside in the product database
for a small controlled pilot; move them to private object storage and implement
retention before a public-volume launch to protect the shared cluster's disk.

## Concrete prerequisites and sequence

1. Review and append `deployment/platform/global-postgres-additions.yaml` entries
   into the owning chart's existing lists. Preserve every existing database/role.
   Both reproducible bootstrap SQL and CNPG Database CR reconciliation are needed;
   postInitSQL alone does not affect an existing cluster. Keep reclaim policy retain.
2. Provision namespace-bound OpenBao secrets separately for development, UAT and
   production. Product secrets use `civiclens-` names. CNPG role passwords must be
   synced into the `global` namespace using appropriately scoped platform readers;
   the API reads only its runtime URL and identity key. Never copy a global owner
   credential into the product namespace. Restrict each environment's reader to
   its own paths. `deployment/openbao/` includes the production read policy and
   ExternalSecret proposal; define `civiclens-openbao` using the verified existing
   Kubernetes auth mount, service account, CA and auth role. Do not guess those IDs.
3. Approve and execute the initial migration using the migrator credential,
   then `runtime-grants.sql`. A new dedicated schema/database is additive, but it
   is still a live database change requiring specific approval. The SQLx migration
   is forward-only; rollback is to the prior API image while retaining the schema.
   Deletion of the database or schema is not a rollback procedure.
4. Add the dedicated native identity claims to the existing operator kustomization
   and reconcile through its GitOps owner. Read actual IDs from Ready claim status.
   Set CivicLens API OIDC project/iOS/Android IDs and the verified provider IDs.
   Enable Google/Facebook connectors only after completing broker-side profile,
   verification and linking checks. Never reuse Roamie's client audience.
5. Build and scan via the pinned reusable workflows, then release the API image
   manually. Pin the resulting immutable digest in the owning GitOps chart values;
   the local Helm chart refuses an empty digest. Existing Tesserix shared runtime
   and pinned Rust builder match `roamie/docker/api.Dockerfile`.
6. Mount the global CNPG CA into `civiclens` through an approved public-CA sync.
   Runtime URL must use `sslmode=verify-full` and its certificate host name. Add
   explicit ingress on the global database side for only `civiclens-api` pods in
   namespace `civiclens`, TCP 5432. The supplied product-side egress alone is not
   sufficient. Configure the verified gateway namespace in `ingressNamespaces`,
   mesh egress for Zitadel/Meta, and the existing WAF/distributed rate limiting.
7. Add a dedicated host/route in the gateway owner after DNS/TLS review. This API
   exchanges a signed OIDC ID token for an opaque application session; do not attach
   a gateway JWT rule that rejects its opaque Bearer token. Let the API enforce its
   session on report routes; allow only health/capabilities/OAuth entrypoints without
   it. Preserve all other products' issuer/audience rules. Do not loosen a shared
   default policy. Test wrong audience, missing session and cross-user requests
   through the real public gateway before release.
8. Register EAS project and signing credentials, set `EXPO_PUBLIC_EAS_PROJECT_ID`
   and the actual HTTPS API URL per EAS environment, then use the reusable mobile
   workflow for Android APK/AAB and iOS simulator/device builds. Physical-device
   Google/Facebook, camera, location, denial, offline draft/retry, large text,
   background/relaunch and logout QA are release gates. No store auto-submit is set.

The sample ExternalSecret initially omits the Page token; when publishing is
approved, add its exact OpenBao reader/path and JSON entry. A mounted Secret update
does not reload this process's configuration. Credential rotation must update the
writer, platform reader and application readers and roll the pods through GitOps.
The identity HMAC key needs a mapping migration rather than blind rotation.

## Operations and rollback

`/healthz` is process liveness. `/readyz` checks Postgres connectivity. Set error
and latency SLO alerts, an outbox-stuck/uncertain alert, shared-CNPG storage alerts
and an assigned moderation owner before public operation. Target 99.9% availability
and p99 metadata under 500 ms; these are proposed objectives, not measured results.

Backups use the existing global CNPG/Barman policy. Agree photo/account retention
and verify actual backup expiry. Proposed RPO 15 minutes and RTO 1 hour require a
tested isolated product restore; they are not yet verified. Capture a before-state
record and backup reference before any approved live change. Restore drills must
not overwrite the shared primary. Roll back application image digest through the
owner; keep public publishing disabled until reports and outbox are reconciled.

Public launch also requires account deletion/export, retention, abuse/rate-limit
operations, moderator review tooling, image redaction, country-specific review and
licensed/source-backed authority discovery. Instagram/WhatsApp integration work
remains explicit; no operational destination is fabricated for the starter.

No new CNPG infrastructure cost is proposed. Initial API resources are 2 × 100m CPU
and 128 MiB memory requested, 512 MiB memory limit each. Photo storage and review
labor dominate growth; validate the shared cluster's headroom before provisioning.
