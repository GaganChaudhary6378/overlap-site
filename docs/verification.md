# Verification record

Recorded 2026-10-17. This is an implementation record, not a claim of a production deployment.

| Check | Result |
|---|---|
| Unit/security/protocol checks | 15 tests passed |
| PostgreSQL integration | Passed in a disposable local cluster with auth mocks |
| TypeScript | Passed |
| Production Next.js build | Passed |
| ESLint | No errors; four warnings in existing presentation components |
| Production dependency audit | Zero reported vulnerabilities |
| Development dependency audit | Existing braces advisory through Next ESLint; no patched release published |
| Basic Playwright checks | 3 passed, 4.6 seconds before final device lease change |
| Two-browser collaboration UI | Passed after device lease changes, 27.4 seconds; mocked Auth/REST, polling fallback |
| SwiftUI companion | Compiled and linked |
| Native assertion checks | Passed |
| WidgetKit source | Typecheck passed; not packaged/installed |
| Git secrets | Working files and reachable history pattern scan passed; commit/push hooks installed |

SQL verification covers outsider read/write denial, create/join, two-user overlaps across branches, release ownership, invite rotation, owner member removal, expired lease handling, same-user separate devices, presence-only watcher behavior, and cross-user device-ID spoofing. These tests exercise PostgreSQL permissions and functions with minimal auth mocks; Supabase Auth and actual realtime delivery need live verification.

OAuth checks cover fresh PKCE/state/nonce, callback validation, signed JWT identity checks, audience/nonce/signature failures, rotating refresh credentials, fragmented UTF-8 streaming, mandatory completed responses, cross-origin requests, Host validation, malformed paths and callback/disconnect serialization. They use local fixtures. An owner must complete actual OpenAI consent and eligible inference; no account entitlement is inferred from mocks.

## Screenshots

- `screenshots/landing-baseline.png`: original UI before adding the room link.
- `screenshots/landing.png`: preserved marketing UI with the functional room entry.
- `screenshots/workspace.png`: honest missing-configuration state.
- `screenshots/workspace-example.png`: two-person dashboard using Alice/Bob `example.test` fixtures, not real users or a live deployment.

## Automation measurements

Playwright Chromium baseline run: 4.6 seconds. Two-context mocked room flow after device isolation: 27.4 seconds. Setup/download time is separate. Exact model token usage and dollar costs were not exposed for these runs. No paid browser cloud was used by Playwright. BrowserAct 1.4.3 installed. No browser environment or API key is configured, so its runtime/cost comparison remains unmeasured. There is no measured winner or claimed cost saving.

## Remaining external verification

- Supabase free project provisioned in Mumbai and migration applied. Hosted SQL tests passed with synthetic identities inside a rolled-back transaction. Auth health is reachable and anonymous table/RPC requests are denied. Real email sign-in and realtime delivery between separate authenticated clients remain unchecked.
- Complete local OpenAI account consent, refresh/revocation and successful eligible inference.
- Test real CLI/MCP activity and web/Mac sync against that backend.
- Package/sign/install the widget with full Xcode and verify its scheduled refresh behavior.
- Verify GitHub CI after source push, and configure hosting if requested.

The command-line SDK lacks XCTest (`no such module 'XCTest'`). Standalone native assertions ran instead. macOS Keychain permission dialogs and deployed widget behavior require owner-operated checks.

## Hosted Supabase verification

Project `overlap` in the selected personal organization, region `ap-south-1`, quoted $0/month at creation. Migration applied successfully. `tests/rooms.hosted.sql` passed against the hosted database, using transient synthetic user rows and real authorization functions; all changes were rolled back. This verifies database behavior, not a real email/OAuth login.

Security advisors reported one category with nine findings: authenticated users can call SECURITY DEFINER RPCs. This is intentional for the RPC-only write design. Each function has a fixed search path and explicit ownership/membership checks; anonymous execute access is revoked. Those checks were reviewed and tested. The findings remain visible rather than being suppressed. [Supabase advisory explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
