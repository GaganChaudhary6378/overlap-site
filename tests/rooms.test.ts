import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { activeConflicts, claimLines, claimsOverlap, getBrowserDeviceId, heartbeat, validateClaim, type ClaimInput, type RoomClaim } from "../src/lib/rooms";

const input: ClaimInput = { roomId: "room", filePath: "src/login.ts", startLine: 40, endLine: 80, branch: "main", agent: "Codex" };
const claim: RoomClaim = { id: "a", room_id: "room", user_id: "alice", device_id: "00000000-0000-0000-0000-000000000001", display_name: "Alice", file_path: "src/login.ts", start_line: 40, end_line: 80, branch: "main", agent: "Codex", expires_at: "2030-01-01T00:01:00Z" };

test("claim boundaries reject invalid and nonrelative paths", () => {
  assert.doesNotThrow(() => validateClaim(input));
  for (const filePath of ["", "/etc/passwd", "../secret", "src/../secret", "./file", "src/./file", "src//login.ts", "src/login.ts/", "src\\file", "file\nname", "x".repeat(501)]) {
    assert.throws(() => validateClaim({ ...input, filePath }));
  }
  for (const [startLine, endLine] of [[0, 5], [8, 7], [1.5, 5], [1, Infinity], [1, 10_000_001], [NaN, 8]]) {
    assert.throws(() => validateClaim({ ...input, startLine, endLine }));
  }
  assert.throws(() => validateClaim({ ...input, branch: " " }));
  assert.throws(() => validateClaim({ ...input, agent: "x".repeat(41) }));
  assert.throws(() => validateClaim({ ...input, deviceId: "invalid" }));
  assert.doesNotThrow(() => validateClaim({ ...input, deviceId: claim.device_id }));
});
test("inclusive ranges overlap at shared boundary but not adjacent lines", () => {
  assert.equal(claimsOverlap(claim, { ...claim, start_line: 80, end_line: 90 }), true);
  assert.equal(claimsOverlap(claim, { ...claim, start_line: 81, end_line: 90 }), false);
  assert.equal(claimsOverlap(claim, { ...claim, start_line: 50, end_line: 60 }), true);
  assert.equal(claimsOverlap(claim, { ...claim, file_path: "src/logout.ts" }), false);
});
test("conflicts exclude own user, other rooms, and expired leases", () => {
  const bob = { ...claim, id: "b", user_id: "bob", branch: "feature", start_line: 60, end_line: 90 };
  const now = Date.parse("2030-01-01T00:00:30Z");
  const claims = [claim, bob, { ...bob, id: "old", expires_at: "2030-01-01T00:00:30Z" }, { ...bob, id: "other-room", room_id: "other" }];
  assert.deepEqual(activeConflicts(claim, claims, now).map((c) => c.id), ["b"]);
  assert.deepEqual(activeConflicts(claim, claims, Date.parse(claim.expires_at)), []);
});

test("browser device identity persists and Node watchers send presence-only heartbeats", async () => {
  const calls: { name: string; params: Record<string, unknown> }[] = [];
  const client = { rpc: async (name: string, params: Record<string, unknown>) => { calls.push({ name, params }); return { data: {}, error: null }; } } as unknown as SupabaseClient;
  await heartbeat(client, "room");
  assert.equal(calls.at(-1)?.params.p_device_id, null);
  await heartbeat(client, "room", claim.device_id);
  assert.equal(calls.at(-1)?.params.p_device_id, claim.device_id);
  await claimLines(client, { ...input, deviceId: claim.device_id });
  assert.equal(calls.at(-1)?.params.p_device_id, claim.device_id);

  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } } });
  try {
    const id = getBrowserDeviceId();
    assert.equal(getBrowserDeviceId(), id);
    assert.match(id, /^[0-9a-f-]{36}$/);
    await heartbeat(client, "room");
    assert.equal(calls.at(-1)?.params.p_device_id, id);
    await claimLines(client, input);
    assert.equal(calls.at(-1)?.params.p_device_id, id);
    values.set("overlap-device-id", "invalid");
    assert.notEqual(getBrowserDeviceId(), "invalid");
  } finally {
    if (savedWindow) Object.defineProperty(globalThis, "window", savedWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
