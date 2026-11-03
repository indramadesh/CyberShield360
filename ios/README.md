# CyberShield360 for iOS — status: code written, NOT built or tested

These sources need a Mac with Xcode; they were written on Windows and have never
been compiled or run. Treat them as a starting point, not a finished app.

## What iOS allows (and what it doesn't)

| Feature | Possible? | How |
|---|---|---|
| Check text the user shares | Yes | Share extension (`ShareExtension/`) → `/api/v1/msgintel/device/events` with the paired device token |
| Filter SMS/MMS from **unknown senders** into Junk / Promotions | Yes | Message Filter extension (`MessageFilterExtension/`) deferring to `/api/v1/msgintel/ios/message-filter` |
| Gmail / Outlook | Yes | Server-side connectors; connect from the website on any device |
| Read iMessage, SMS from contacts, WhatsApp or any other app's data | **No** | No public API. Private APIs would be rejected and aren't used |

## Setting it up in Xcode

1. Create an iOS app project (bundle id e.g. `com.cybershield360.protect`), iOS 16+.
2. Add a **Share Extension** target; replace its view controller with `ShareExtension/ShareViewController.swift`.
   Activation rule: text only (`NSExtensionActivationSupportsText = YES`).
3. Add a **Message Filter Extension** target; replace its principal class with
   `MessageFilterExtension/MessageFilterExtension.swift`. In its Info.plist, under
   `NSExtension > NSExtensionAttributes`, set
   `ILMessageFilterExtensionNetworkURL` = `https://<your-domain>/api/v1/msgintel/ios/message-filter`.
4. Associated Domains capability on the filter extension: `messagefilter:<your-domain>`, and host
   `https://<your-domain>/.well-known/apple-app-site-association` listing the extension under
   `messagefilter` (same steps as `webcredentials`, per Apple's guide).
5. Keychain Sharing + App Group on the app and both extensions (`group.com.cybershield360.protect`
   or your own; update `SharedKeychain.group`).
6. In the main app, build a pairing screen: POST the code from the website to
   `/api/v1/msgintel/devices/pair` (platform `"other"`), store `device_token` in the shared Keychain item
   (`service "cs360"`, `account "device-token"`) and the server URL in the shared UserDefaults suite.
7. The user enables the filter in **Settings → Apps → Messages → Unknown & Spam**.

## Privacy notes

- The SMS filter endpoint is stateless: Apple sends no user identity, the server analyses the text
  in memory and stores nothing. Only the verdict comes back.
- The extension itself never sees the network (Apple's rule); the system makes the request.
- Shared text goes to the user's own history and follows their retention settings.
