# ADR 0014 — Reviewed TikTok sharing

Date: 2026-10-25

## Context and decision

Add TikTok to the existing owner-controlled manual sharing flow. Accept one to
four selected social destinations and retain the current one-to-five JPEG photo
limit. Independent photo, public-text, current-authority and content-safety
review remains mandatory. Export is owner-scoped and is revalidated before each
handoff, photo save, caption copy or TikTok opening.

Use the native OS sharing chooser, with an explicit fallback to save reviewed
photos, copy the reviewed caption and open https://www.tiktok.com/. The user
selects Upload, their account and the final destination inside TikTok. The OS may
omit TikTok from the chooser; caption and attachment acceptance varies by app.
There is no delivery receipt and no automatic publishing job. TikTok captions
never borrow another platform's verified handles. CivicLens nicknames do not hide
the sender identity on TikTok.

The simplest alternative, chooser-only sharing, was rejected because TikTok may
not appear. Official Share Kit requires a registered developer app, client key,
product registration and native SDK integration. Those are not configured here.
Content Posting API authorization and approval are likewise not claimed. No
unofficial scheme, consumer-login automation or fabricated provider success.
Official reference: https://developers.tiktok.com/docs/en/share-kit-ios-quickstart-v2
(accessed 2026-10-25).

## Permissions and failure behavior

Request iOS add-only Photos permission only on Save. Use the supported explicit
`expo-media-library/legacy` entry: SDK 57's top-level save function throws, while
new Asset.create fetches the saved asset. Do not request read access. Retain
Android read/storage permission blocks. Direct saving is available on Android
13+; older Android users can use the OS chooser's available save actions instead.
Do not add the MediaLibrary config plugin, whose defaults request broader access.
The existing system photo picker remains available for report/profile imports.

Temporary JPEGs use random private cache paths and are deleted after each save.
Saving stops if the account, report, approval availability or selection changes.
Track confirmed saves in memory to resume partial saves on the same screen.
A native save can complete even if its response is lost. Failure/restart may leave
copies; warn users to check Photos. Never blindly promise exactly-once saves.
Native photo copies cannot be recalled if approval is later withdrawn. Photo
backups and the clipboard are external to CivicLens and are disclosed before use.
Clipboard writes require a separate tap and contain reviewed public text only.

When API/safety/storage is unavailable or review changes, block further export
and preserve the private report. Permission denial, clipboard/open failures or
missing native modules have clear retry/update messages. Cancellation of the OS
chooser never means published. No new service, queue, credential or database
migration. No new backend latency objective: existing share-package limits and
80-second mobile deadline remain; each native action is explicitly user driven.
At pilot volume, this adds only existing export traffic and on-device storage;
no new hosted infrastructure or provider cost is introduced.

## Compatibility and rollout

`manualShareChannels` advertises supported manual destinations. Older servers
omit it; clients offer the existing three destinations and block unsupported
restored drafts without deleting them. New server versions read old reports.
Old server binaries cannot deserialize stored TikTok channel JSON; once TikTok
reports exist, roll back with a forward-compatible reader rather than reverting
the enum. The managed publications table remains unchanged and forbids TikTok;
managed or omitted-mode TikTok submissions are rejected before storage.

New Clipboard/MediaLibrary modules and iOS usage text need a fresh binary. Runtime
`0.1.6-tiktok-sharing-2`, iOS build 14 and Android versionCode 4 separate it from
older clients. Local simulator build/QA does not authorize cloud changes,
TestFlight upload or a store release. Real TikTok attachment acceptance, account
selection and final posting require physical-device QA with TikTok installed.
