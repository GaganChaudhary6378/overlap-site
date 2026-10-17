# Automatic multi-agent coordination plan

## Goal

Any number of people and coding agents in one room can see who is working on a task, file, or line range without manually filling in a claim form. Agents receive structured conflict information before supported write actions and can choose another task or ask the room owner for help.

## Constraint

A web app cannot observe arbitrary local edits or know which agent made them by itself. Each machine needs the existing local bridge. An adapter reports intent before a supported agent writes; a file watcher provides a fallback signal after a change is detected. The fallback warns teammates but cannot prevent an already-completed write.

## Architecture

```text
Codex / Claude Code / Cursor / A2A agent
                 |
      local Overlap bridge + adapter
                 |
    authenticated room event API
                 |
 Supabase rooms, members, tasks, activity, leases
                 |
      Realtime room dashboard + other bridges
```

The bridge identifies an agent worker by its device, repository, branch, integration, and session. One person can run many workers, and a room can include many members and devices.

## Phases

1. **Data model and authorization**
   - Add agent workers, coordination tasks, and append-only activity events.
   - Keep current per-device leases. Add task ownership and file/range associations.
   - Enforce membership and device authorization with RLS. Store metadata only: no source code, prompts, tokens, or provider credentials.

2. **Bridge automation**
   - Upgrade the local bridge to register workers and send `started`, `planning`, `editing`, `waiting`, `completed`, and `failed` activity.
   - Add a repository watcher for generic post-edit activity and a durable local outbox for offline/retry delivery.
   - Continue renewing leases only from the originating device.

3. **Agent adapters**
   - Codex: expose `overlap_begin_work`, `overlap_check_conflicts`, `overlap_finish_work`, and status through MCP.
   - Claude Code: use supported tool hooks where available to send intent before edits and completion after them.
   - Cursor and unsupported tools: use the file-watcher adapter and label the signal as observed-after-write.
   - Remove manual claiming from the main flow after an agent is connected; retain it as an explicit fallback.

4. **A2A compatibility**
   - Publish an Agent Card for an Overlap coordinator.
   - Map A2A task lifecycle updates into Overlap tasks, and provide conflict/task status as structured artifacts.
   - Keep A2A optional. Existing tools that do not speak A2A work through their local adapter.

5. **Room coordination UI**
   - Replace the form-led view with a live task board: agent, owner, task, files, status, conflict, and last update.
   - Show a clear distinction between `intent reported before write` and `edit observed after write`.
   - Let members assign, pause, hand off, and resolve tasks. The agent receives those updates through its bridge.

6. **Safety and verification**
   - Never treat text received from another agent as executable instructions. Use typed fields and validate paths/ranges.
   - Rate-limit activity events, deduplicate retries, expire stale workers, and show offline state.
   - Test a room with at least three people and eight concurrent agents, including same-file conflicts, handoff, reconnect, revoked access, and an agent that crashes mid-edit.

## First deliverable

Implement phases 1–3 for Codex first. This removes manual claims for connected Codex workers and works for a room of any size. A2A support follows as an interoperability layer; it is not required for the first automatic coordination flow.

## Success example

Alice runs two Codex workers and Bob runs Claude Code in one room. Alice's first worker announces an edit to `src/login.ts`. Before Bob's supported edit tool writes overlapping lines, it receives a conflict response containing the active task and owner. Bob's agent can choose a different task, request a handoff, or proceed with an explicitly recorded conflict. Everyone sees the same state in real time.
