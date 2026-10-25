# ADR-0016: explicit handoffs to user-owned social apps

## Context and decision

The reviewed sharing screen labels a generic OS chooser as a specific social
app action. Only TikTok has save/copy/open controls. Extend those explicit
controls to Facebook, Instagram and WhatsApp, retaining a clearly labelled
system share menu for all one-to-five reviewed JPEGs. Opening an app does not
attach photos or paste a caption; the screen explains the required steps.

Keep independent photo, caption and authority review. Every native action
requests a fresh owner-scoped package and compares it with the preview. The
client cannot approve its own report. No new API, migration, service, provider
credential or personal-sharing bypass is introduced.

Use the existing library's Facebook, Instagram and WhatsApp launch schemes,
with iOS scheme queries and an explicit unavailable-app state. TikTok retains
its official HTTPS destination: the OS may open the installed app or website.
Do not invent a TikTok scheme or claim Share Kit integration. Add-only Photos
access and separate clipboard consent apply equally to every destination.
Confirmed saved photos are shared across destination actions on the same
screen, avoiding duplicate saves. No unreviewed text or original metadata is
exported. Changing account/report/approval invalidates pending actions.

Show one selected destination at a time with Previous/Next navigation. Returning
from another app never automatically advances, starts another export, or records
delivery: returning may mean cancellation. An explicit combined action saves the
photos, copies the reviewed caption and opens the destination. Check availability
before saving; repeat server review after saving and before copying/opening.
Denied permission, partial save or withdrawn final review stops the sequence.
Already saved copies cannot be recalled. Users can retry individual steps.

## Alternatives and release boundary

The installed library's Facebook iOS targeted path uses legacy Social.framework;
its Instagram path requests library read access and its WhatsApp path supports
one image. Using those paths would regress privacy or lose attachments. Keep
the multi-photo system chooser and explicit upload fallback instead. Consumer
social accounts do not offer a universal API for simultaneous automatic posting.

Reuse the existing pilot sizing, export deadlines and API availability target.
There is no additional hosted cost or stored data. API failure, withdrawn review,
unavailable app and denied Photos access stop the affected action visibly.
Temporary images are deleted after save attempts; external copies remain under
the user's control. Neither chooser completion nor app launch is delivery.

The scheme queries require a fresh native binary and runtime version. Verify
app launch and attachment acceptance on physical devices with the destination
apps installed before public release; simulators cannot establish those results.
Roll back the client with a new compatible binary; no database rollback applies.

References: installed react-native-share 12.3.1 iOS implementations
(`RNShare.mm`, `InstagramShare.m`, `WhatsAppShare.m`) and
https://developers.tiktok.com/doc/share-kit-ios-quickstart-v2.
