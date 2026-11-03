# Platform capability matrix

What each platform genuinely allows. The product shows a source as active only
when it is actually connected; everything below that is "not possible" is shown
as unsupported in the interface.

| Platform | Mechanism | Data available | Permission / consent | Limitations | Store policy |
|---|---|---|---|---|---|
| **Android** | `NotificationListenerService` | Title + text of notifications from apps the user selects; package name; post time | User grants Notification access in system settings after our explanation screen; per-app selection in our app | Not the app's message database. Text may be partial, grouped or hidden (lock-screen / preview settings). **Android 15+ hides one-time-code notifications** from non-system listeners. Background work is restricted (Doze, OEM battery savers). | Google Play reviews notification-listener use; core-functionality disclosure needed. SMS / call-log permissions are only for default SMS / dialer apps — **not requested** |
| Android | Share sheet ("Check with CyberShield") | Text the user shares | User action | Manual only | None |
| Android | Gmail / Outlook | Same as web connectors (server side) | OAuth | See email rows | — |
| **iOS** | Share extension | Text / URL the user shares | User action | Manual only | Standard review |
| iOS | Message Filter extension (IdentityLookup) | Sender + body of **SMS/MMS from unknown senders** | User enables the filter in Settings > Messages | No iMessage, no messages from contacts, no WhatsApp; filtering into Junk/Promotions only | Standard review; network deferral needs an associated domain |
| iOS | Email | Gmail / Outlook via server connectors | OAuth | No access to the Mail app's data | — |
| iOS | Reading SMS, iMessage, WhatsApp, other apps' data | **Not possible** | — | No public API | Private APIs would be rejected |
| **Windows / macOS / Linux** | Chrome/Chromium extension (MV3) | Selected text (context menu, `activeTab`); current page URL check (existing) | Install + right-click action; device pairing for history | No inbox access; no reading of arbitrary pages | Chrome Web Store review |
| Desktop | Gmail / Outlook | Server connectors | OAuth | — | — |
| Desktop | Desktop mail clients (Outlook desktop, Apple Mail) | Possible via an Outlook add-in or a macOS MailKit extension | — | **Not built** (future). Not justified while the server connectors cover these accounts | — |
| **Gmail** | Gmail API, `gmail.readonly` | Inbox messages, full headers (incl. Google's `Authentication-Results`), body, attachment metadata | OAuth consent | `gmail.readonly` is a **restricted scope**: testing mode is limited to 100 listed test users; public release needs Google verification + an annual security assessment | Google API Services User Data Policy |
| **Outlook / Microsoft 365** | Microsoft Graph, delegated `Mail.Read` + `offline_access` + `User.Read` | Inbox messages, body, `internetMessageHeaders`, attachment metadata | Microsoft sign-in + consent (user-consentable for personal accounts; work tenants may require admin consent) | Delta sync per folder; Graph has no endpoint to revoke a single delegated refresh token — disconnecting deletes our copy and links to the account's app-permissions page | Azure app registration (free) |
| WhatsApp / Telegram / Signal | Only through Android notifications (partial text) or user sharing | — | — | **No API for reading conversations** | — |

## Capability-aware behaviour

- The API reports which connectors are configured on the server (`GET /msgintel/capabilities`). Gmail / Outlook buttons are disabled with a reason when OAuth isn't configured.
- A source is shown as active only while its status is `connected` and it has synced or reported within its expected interval; otherwise it shows the real state (`paused`, `permission_revoked`, `error`, `disconnected`, `never_synced`).
- Android reports notification-access state on every check-in; revoked access is shown as such.
- iOS rows are marked **"Code written — not built or tested (needs a Mac with Xcode)"** until they have been.
