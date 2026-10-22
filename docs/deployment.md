# Deployment

This repo owns the API code and its image. Everything that runs it lives
elsewhere, following the Roamie layout:

| Repo | Owns |
|---|---|
| `tesserix/civiclens` | API code, migrations, `images.yml` publishing `deploy-<sha>` to GAR `global/civiclens-api` |
| `tesserix/kargo-manifests` | `projects/civiclens/`: Warehouse and `prod` Stage promoting `deploy-<sha>` |
| `tesserix/tesserix-k8s` | `charts/apps/civiclens-api`, Argo apps, OpenBao readers, CNPG roles, Istio, Zitadel claims (`k8s/operators/zitadel/claims/civiclens.yaml`) |

The production runbook, credential paths and approval gate are in
`tesserix-k8s/docs/civiclens-api-rollout.md`.

## Contract with the platform

- Database `civiclens_db`, schema `civiclens`, on the shared `global/global-postgres`.
  `civiclens_migrator` owns it and runs `civiclens-api migrate`; migration
  `0004_runtime_grants.sql` grants `civiclens_runtime` its DML. Migrations are
  forward-only; roll back by image, never by dropping the schema.
- Production reads `CIVICLENS_SECRETS_FILE` (JSON with `civiclens-database-url`
  using `sslmode=verify-full`, and `civiclens-identity-key`). The identity key
  needs a mapping migration, never a blind rotation.
- Pool: five connections per pod, statement cache off, 15s statement and 3s lock
  timeouts. Photos sit in the database for the pilot; move them to private object
  storage before public volume.
- The API exchanges a signed OIDC ID token for an opaque session sent as
  `Authorization: Session <token>`. The shared gateway rejects non-JWT `Bearer`
  values, so never move it back to `Bearer`. Only `/v1/` is public.

## Identity

`consumer-civiclens` holds the project and both native clients (code + PKCE, no
secret, callback `civiclens:/auth/callback`, Login V2). Provider IDs and client
IDs are set in the tesserix-k8s chart values. Provider secrets live in OpenBao at
`civiclens/prod/app/civiclens-{google,apple,facebook}-idp-prod`. Do not mark
login verified until first and returning sign-in work on a real device.

## Launch gates

Public launch still needs account export, retention, moderation tooling, image
redaction, alerts on errors/latency/shared-CNPG storage, an isolated restore
drill and verified authority records. Social publishing stays disabled until a
real Page and scoped credentials exist; Instagram and WhatsApp are not built.
