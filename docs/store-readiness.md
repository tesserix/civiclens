# CivicLens store readiness — 22 October 2026

Status: internal preview only. Version 0.1.1 (4) is VALID and IN_BETA_TESTING,
with the new logo, both Roamie-equivalent internal groups, and the existing
samyak.rout@gmail.com tester. Upload success is not store approval or device QA.

## Verified requirements and gaps

| Area | Evidence and remaining gate |
| --- | --- |
| Account deletion | Build 4 has sign-out only. Add authenticated in-app initiation, persistent receipt, external web resource, scoped fulfilment, provider revocation and completion confirmation. Deactivation alone is insufficient. |
| Privacy | Build 4 contains SDK required-reason manifests but its app collected-data list is empty. Current source adds linked name/email (broker), user identifier, precise location, photo and report text for functionality; no tracking. Store questionnaires must reflect the broker and infrastructure too. |
| Permissions | Build 4 includes unused always-location, motion and Face ID descriptions. Current source removes these and blocks Android microphone, broad media/storage, background location and activity access. Confirm the next IPA and merged Android release manifest, not only Expo config. |
| Legal/support | Use Tesserix Pty Ltd, existing sales@tesserix.app support and 18+ launch, as confirmed by the owner. Publish CivicLens-specific collection/sharing/retention terms and accessible in-app links; the generic corporate page alone does not describe report photos and coordinates. |
| User content | Private owner report list and moderator approval exist. Public launch still needs enforceable terms acceptance before upload, abuse reporting, relevant user blocking/takedown controls and staffed moderation. Do not imply an unsupported authority allegation is proven. |
| Sign-in | Apple, Google and Meta broker configuration exists. Real-account authentication and Apple token revocation/identity deletion must be exercised after API deployment. Preserve other products and the customer's provider account. |
| Completeness | Production API/database are not deployed. Instagram/WhatsApp integrations and verified authority coverage are absent. Facebook needs a configured Page/token. Do not advertise unavailable functionality or submit an inaccessible backend to review. |
| Apple store | Complete app privacy answers, age/content rating, export compliance, support/privacy URLs, accurate screenshots, review contact/access and beta notes. Check App Store Connect rather than infer these from a successful internal upload. |
| Google Play | Current official target requirement for new phone apps is Android 16/API 36+. Verify target, 64-bit/16 KB compatibility, merged permissions, signed AAB, Data safety/deletion URL, content rating, ads declaration, app access and any account-specific testing requirements in Play Console. No Android release is verified yet. |
| Licenses | Preserve dependency notices for shipped JS/native/Rust components; public repository visibility does not grant a software licence. Verify EULA choice and intellectual-property rights. The Account Holder must handle Apple's pending Developer Program agreement. |
| Operations | Verify shared CNPG backup expiry, deletion from primary stores and broker, treatment of external posts/copies, isolated restore suppression of erased data, support queue ownership and an actual disposable-account deletion drill. |

## Release order

1. Finish and test compliance code and product policies. Keep disclosures tied to
   actual behavior and distinguish a pending request from completed deletion.
2. Prepare the exact GitOps API image/schema/policies and fulfilment runbook. Obtain
   specific database creation/migration and API production rollout approval under
   the workspace agreements before applying it.
3. Deploy, verify public legal/deletion URLs and anonymous rejection, and test
   independent real accounts and deletion including identity/provider cleanup.
4. Build a new native release containing these changes, inspect its artifacts,
   complete store declarations, and verify it in internal testing on both platforms.
5. Submit external beta/public review only with accurate reviewer access and all
   applicable gates satisfied. Apple/Google decide approval; no agent can guarantee it.

## Primary sources checked

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Apple Sign in with Apple deletion and revocation](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- [Apple privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Google account deletion](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google user-generated content](https://support.google.com/googleplay/android-developer/answer/9876937)
- [Google target SDK](https://developer.android.com/google/play/requirements/target-sdk)
- [Tesserix privacy](https://tesserix.app/privacy) and [terms](https://tesserix.app/terms)

Policies and store requirements can change. This is an engineering readiness audit,
not a claim of legal review, universal country compliance or store acceptance.
