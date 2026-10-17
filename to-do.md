# Overlap completion plan

Status: implementation approved and in progress. Web/backend/local provider/agent bridge/native sources implemented; external live verification and delivery remain. See docs/verification.md.

## Phase 0 — Discovery

- [x] Inspect app, repository, instructions, test tooling, and native toolchain.
- [x] Verify official OpenAI subscription integration documentation.
- [x] Assess app and publishing risks with two parallel review agents.
- [x] Record implementation phases and acceptance checks.

Current state: Next.js landing page with a scripted collaboration replay. No real login, database, room backend, agent bridge, or macOS app exists. Preserve existing uncommitted work.

Design requirement: preserve the current Overlap UI, including its cream paper background, editorial typography, brass/red accents, signals, and room layout. Extend that same visual language to login, real rooms, and the macOS companion; do not redesign the product. Capture baseline screenshots before implementation for comparison.

## Phase 1 — Foundation and publishing safeguards

- [x] Extend `.gitignore` for credentials, local state, native output, and test artifacts; allow a placeholder-only `.env.example`.
- [x] Inspect tracked files and Git history for secrets without exposing values; review local tool metadata before staging.
- [x] Add a repeatable secret check before commits/pushes and in CI. Document installation and remaining limitations.
- [x] Replace scaffold README with purpose, features, prerequisites, local setup, configuration, architecture, and current limitations.
- [x] Read bundled Next.js 16 documentation before code changes.

Acceptance: local setup is reproducible; real secrets and generated files are excluded; secret checks catch a harmless test fixture; existing work remains intact.

## Phase 2 — Local ChatGPT subscription connection

- [x] Implement the documented local-app OAuth registration/sign-in path with PKCE, state, nonce, validated identity tokens, stable host ID, scoped permissions, refresh, and disconnect.
- [x] Store provider credentials securely outside the repository; use macOS Keychain in the native client. Keep tokens out of browser storage, logs, room payloads, and other users' devices.
- [ ] Show connection and entitlement errors honestly; stream one supported inference request to verify access.
- [x] Keep OpenAI provider connection separate from room membership and device authorization.
- [x] Document the approval requirement for offering subscription usage in a remotely hosted or paid app; do not substitute a paid API-key flow silently.

Acceptance: a user authorizes their own account and completes an eligible request using their plan; declined consent, expiry, refresh failure, and logout work. Real account consent must be completed by its owner; mocked tests do not prove entitlement.

Official references checked 2026-10-16:
- https://developers.openai.com/siwc/token-sharing-open-source
- https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
- https://developers.openai.com/siwc/request-client-id

## Phase 3 — Real collaborative rooms

- [x] Add a functional app alongside the existing marketing replay, clearly distinguishing demo and live data.
- [x] Add durable room/membership/device storage, create/join/invite/revoke flows, authenticated requests, and room authorization.
- [x] Use server-authoritative events and leases, with live updates, heartbeat, expiry, reconnect, and stale/offline indicators.
- [ ] Support two users on different devices through a shared room service; keep provider tokens local and share only authorized coordination metadata.

Acceptance: two separate users join the same room, see each other's updates, reconnect successfully, and cannot access a room without membership. Database-backed state survives service restart.

## Phase 4 — Agent coordination bridge

- [x] Add a local bridge and documented agent integration, starting with Codex and explicitly documenting other tools' support status.
- [ ] Send repository/branch/file/range/activity metadata with per-device authorization and event deduplication.
- [x] Implement overlap detection, short-lived leases, expiry, release, and conflict warnings.
- [x] Begin with advisory warnings; claim write prevention only for integrations that can actually block before edits.

Acceptance example: Alice holds lines 40–88 of a file; Bob requests lines 52–70. Both see the same warning. Disconnected devices release stale claims after expiry.

## Phase 5 — Full web verification and README screenshots

- [x] Add focused unit/integration tests for OAuth handling, membership, invites, overlaps, and lease expiry.
- [x] Install Playwright and run desktop/mobile browser tests, including two isolated browser contexts for collaboration.
- [ ] Test loading/error/empty/offline/reconnect states, logout, keyboard access, and production build.
- [x] Capture actual app screenshots for README and document exact checks and unresolved limits.
- [ ] Compare repeatable Playwright automation with browser-act on the same bounded scenario if both are available. Record setup/run duration, calls, failure/retry counts, and billable usage only when exposed; report unknown costs as unknown.

## Phase 6 — macOS companion and desktop widget

- [ ] Build a SwiftUI desktop panel/menu bar client using the same room service and secure local provider connection.
- [ ] Add a WidgetKit summary and links into the live panel; establish supported refresh expectations from Apple documentation before implementation.
- [ ] Validate two-client room sync and offline recovery across web and macOS.
- [ ] Document full Xcode setup, app/widget signing, packaging, and installation.

Current blocker: only Apple command-line tools and Swift are present; full Xcode is needed to build and verify WidgetKit. Do not report native verification before it succeeds.

## Phase 7 — Personal GitHub delivery

- [ ] Verify the connected account is `GaganChaudhary6378` and select/create its `overlap-site` repository; default private unless the user requests public release.
- [ ] Resolve CLI authentication through an authorized path or use supported connector operations; do not reuse another account's credentials.
- [ ] Run final secret checks on staged content/history, review the exact files, and push only the intended project.
- [x] Add CI for tests/build/secret detection and return the repository URL and verified results.

Private repository created and remote configured: https://github.com/GaganChaudhary6378/overlap-site. Personal CLI authentication verified with network access. Source push/CI verification pending.

Update this checklist after every completed phase. Parallel implementation assignments should own separate files and coordinate shared interfaces before edits.

## Implementation notes

- Design polish: preserve the specified cream-paper signal-office style in every system colour preference; tighten the room entry flow with direct copy and a three-step orientation.
- Device-specific claims implemented: browser and CLI/MCP renew only their installation’s claims. Mac watcher heartbeats update presence only. SQL regression tests passed.
- Agent metadata contains paths/ranges/branch/status only; stable claims upsert per device/file. No automatic editor interception or device-specific revocable bearer token flow yet; user sessions enforce room access.
- Native panel compiles and standalone safety assertions pass. Widget source typechecks. Full Xcode packaging and real two-person native sync remain unchecked.
- Supabase MCP authenticated. Free Mumbai project overlap created in the user-selected personal organization; schema applied, hosted authorization/device tests passed, public settings saved only in ignored .env.local. Real email/realtime browser and native client verification remains pending.
- Commit author is the personal GitHub identity. No AI co-author or generated-by trailers.
