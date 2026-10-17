# Overlap for macOS

A cream-paper SwiftUI room panel with a menu bar shortcut and an optional always-on-top window. It shows real room members, active file claims, and advisory overlap warnings. The WidgetKit extension shows the last summary received by this Mac.

Example: Alice claims `login.ts`, lines 40–80. Bob claims lines 60–90. Both claims display warnings in the Mac panel after its next poll.

## Run the panel locally

Requirements: macOS 14+, a matching Swift 6 toolchain and macOS SDK. Full Xcode is required to package and sign the app with its widget. Apply the Supabase migration from the repository first.

```sh
cd macos
swift build
swift run OverlapMac
```

1. Create or join a room in the web dashboard.
2. Enter the same Supabase HTTPS URL and **publishable/anon key** in the Mac panel. Never enter a `service_role` key.
3. Enter your email and choose **Send sign-in code**. Configure Supabase's email template to include `{{ .Token }}` so the email contains a code, rather than only a magic link.
4. Paste the code and choose **Verify code**.
5. Paste the room UUID from the web dashboard. Choose **Connect / refresh**.

The standalone Swift package opens a desktop window and menu bar item. The app can keep that window above other windows. It does not install a desktop WidgetKit extension; use the Xcode steps below for that.

Connection settings persist in UserDefaults. User access and refresh tokens persist in macOS Keychain, scoped to the Supabase origin. HTTPS is required except for localhost development. The client rejects redirects, avoids logging response bodies, refreshes expired sessions, and denies sending an existing session to a different origin.

## Shared room behavior

The panel calls authenticated `heartbeat(p_room_id)` and `room_snapshot(p_room_id)` RPCs every five seconds while its window is open. Room membership is enforced by the database. The panel's heartbeat updates presence only; editing devices renew their own leases. Expired claims disappear from snapshots. Overlap detection compares inclusive ranges in the same file across different users, including different branches.

The panel marks failed requests offline and retains the last successful update time. Reopening or reconnecting fetches a fresh snapshot. It is a polling companion, not a source-code editor. Use Git for code changes. The local agent bridge handles ChatGPT subscription access separately; this panel signs in to room sync only and does not store OpenAI tokens.

## Build and install the desktop widget with Xcode

This repository includes the extension source and entitlements. It does not include a signed Xcode project or claim a verified widget build.

1. Install full Xcode and select its toolchain in **Xcode > Settings > Locations**.
2. Create a **macOS App**, named `Overlap`, with SwiftUI, minimum deployment macOS 14. Use your own bundle identifier and signing team.
3. Remove the generated app entry point. Add all files from `Sources/OverlapMac/` to the app target.
4. Add a **Widget Extension**, named `OverlapWidget`. Disable configuration intents for the static widget. Remove generated widget source and its generated `@main` bundle. Add `WidgetExtension/OverlapWidget.swift` to the widget target. Add `Sources/OverlapMac/RoomSummary.swift` to **both** targets; no other app source belongs to the widget target.
5. Add **App Groups** capability to both targets. Register the same group for both. Replace `group.dev.overlap.shared` in `RoomSummary.swift` and both entitlement files if your team uses a different group identifier.
6. Use `Overlap.entitlements` for the app and `WidgetExtension/OverlapWidget.entitlements` for the widget. Set **Code Signing Entitlements** to the corresponding file in each target. Enable outgoing network connections for the app. Keep tokens in the app's Keychain; the widget has no network or credential access.
7. Add URL Types to the app target: identifier `dev.overlap.room`, URL scheme `overlap`. This makes the widget's `overlap://room` link open the app. The app activates its window on this link.
8. Ensure the widget target is embedded in the app's **Embed App Extensions** build phase. Build and run the app, connect a real room, then add **Overlap room** from macOS **Edit Widgets**.
9. For distribution, archive, sign, and notarize with your Apple Developer account. Install the exported app in Applications. Signing credentials and generated build outputs must stay outside Git.

The shared App Group cache contains only room name, member/claim/warning counts, and timestamp. It excludes emails, file paths, room access tokens, OpenAI tokens, and source code. Signing out deletes the cache and requests a widget refresh. The widget may show its previous snapshot until macOS schedules that refresh.

## Refresh limits and verification

The panel polls every five seconds. WidgetKit uses a system-controlled timeline budget; a requested reload is not an immediate update guarantee. The widget asks for a timeline after 15 minutes and the app requests a reload when summary counts change. Keep the panel open for current activity. Widgets are summaries, not real-time conflict alerts. [Apple: Keeping a widget up to date](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date).

Standalone checks cover credential destination validation, inclusive overlap behavior, and the sanitized widget cache schema:

```sh
swiftc Sources/OverlapMac/RoomSummary.swift Checks/main.swift -o /tmp/overlap-native-checks
/tmp/overlap-native-checks
```

With full Xcode's XCTest SDK available, `swift test` also runs the package test target. Apple's command-line tools alone may not include XCTest. Real Supabase email delivery, two-person native sync, Keychain prompts, widget installation, signing, and notarization require a configured backend and owner-operated desktop checks. No live credentials are embedded in the source.

Verified on 2026-10-17: `swift build` compiled and linked the panel; standalone native checks passed; `swiftc -typecheck -parse-as-library Sources/OverlapMac/RoomSummary.swift WidgetExtension/OverlapWidget.swift` passed. `swift test` reached its test target but stopped with `no such module 'XCTest'` under this machine's command-line SDK. The WidgetKit extension has not been packaged, installed, or tested on the desktop.
