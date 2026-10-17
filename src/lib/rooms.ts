import type { SupabaseClient } from "@supabase/supabase-js";

export type Room = { id: string; name: string; owner_id: string };
export type RoomMember = {
  room_id: string;
  user_id: string;
  display_name: string;
  last_seen: string;
};
export type RoomClaim = {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  file_path: string;
  device_id: string;
  worker_id: string;
  start_line: number;
  end_line: number;
  branch: string;
  agent: string;
  expires_at: string;
};
export type RoomSnapshot = {
  room: Room;
  members: RoomMember[];
  claims: RoomClaim[];
  server_time: string;
};
export type ClaimInput = {
  roomId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  branch: string;
  agent: string;
  deviceId?: string;
  workerId?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let transientDeviceId: string | undefined;

// Device IDs scope leases; authenticated user identity still authorizes every request.
export function getBrowserDeviceId(): string {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("overlap-device-id");
      if (stored && uuidPattern.test(stored)) return stored;
      const generated = crypto.randomUUID();
      window.localStorage.setItem("overlap-device-id", generated);
      return generated;
    } catch { /* Private browsing may disable storage; retain a process-local identity. */ }
  }
  transientDeviceId ??= crypto.randomUUID();
  return transientDeviceId;
}

export function validateClaim(input: ClaimInput): void {
  if (input.deviceId !== undefined && !uuidPattern.test(input.deviceId)) throw new Error("Use a valid device UUID.");
  if (input.workerId !== undefined && !uuidPattern.test(input.workerId)) throw new Error("Use a valid worker UUID.");
  if (!input.filePath || input.filePath.length > 500 || /(^\/|\/\/|\/$|\\|(^|\/)\.\.?($|\/)|[\x00-\x1f\x7f])/.test(input.filePath)) {
    throw new Error("Use a relative file path without dot segments.");
  }
  if (!Number.isInteger(input.startLine) || !Number.isInteger(input.endLine) || input.startLine < 1 || input.endLine < input.startLine || input.endLine > 10_000_000) {
    throw new Error("Choose a valid line range, starting at line 1.");
  }
  if (!input.branch.trim() || input.branch.trim().length > 120 || !input.agent.trim() || input.agent.trim().length > 40) {
    throw new Error("Enter a branch (up to 120 characters) and agent (up to 40 characters).");
  }
}

// Inclusive ranges conflict across branches: those edits may later merge together.
export function claimsOverlap(a: Pick<RoomClaim, "file_path" | "start_line" | "end_line">, b: Pick<RoomClaim, "file_path" | "start_line" | "end_line">): boolean {
  return a.file_path === b.file_path && a.start_line <= b.end_line && b.start_line <= a.end_line;
}

export function activeConflicts(claim: RoomClaim, claims: RoomClaim[], now = Date.now()): RoomClaim[] {
  if (Date.parse(claim.expires_at) <= now) return [];
  return claims.filter((other) => other.room_id === claim.room_id && other.user_id !== claim.user_id && Date.parse(other.expires_at) > now && claimsOverlap(claim, other));
}

async function rpc<T>(client: SupabaseClient, name: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, params);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function listRooms(client: SupabaseClient): Promise<Room[]> {
  const { data, error } = await client.from("rooms").select("id,name,owner_id").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function createRoom(client: SupabaseClient, name: string, displayName: string) {
  return rpc<{ room_id: string; invite_token: string }>(client, "create_room", { p_name: name, p_display_name: displayName });
}
export function joinRoom(client: SupabaseClient, invite: string, displayName: string) {
  return rpc<string>(client, "join_room", { p_invite_token: invite.trim(), p_display_name: displayName });
}
export function getRoomSnapshot(client: SupabaseClient, roomId: string) {
  return rpc<RoomSnapshot>(client, "room_snapshot", { p_room_id: roomId });
}
export function rotateInvite(client: SupabaseClient, roomId: string) {
  return rpc<string>(client, "rotate_invite", { p_room_id: roomId });
}
export function revokeMember(client: SupabaseClient, roomId: string, userId: string) {
  return rpc<void>(client, "revoke_member", { p_room_id: roomId, p_user_id: userId });
}
export function claimLines(client: SupabaseClient, input: ClaimInput) {
  validateClaim(input);
  return rpc<{ claim_id: string; conflicts: RoomClaim[] }>(client, "claim_lines", {
    p_room_id: input.roomId, p_file_path: input.filePath,
    p_start_line: input.startLine, p_end_line: input.endLine,
    p_branch: input.branch, p_agent: input.agent,
    p_device_id: input.deviceId ?? getBrowserDeviceId(),
    p_worker_id: input.workerId ?? input.deviceId ?? getBrowserDeviceId(),
  });
}
export function releaseClaim(client: SupabaseClient, claimId: string) {
  return rpc<void>(client, "release_claim", { p_claim_id: claimId });
}
export function heartbeat(client: SupabaseClient, roomId: string, deviceId?: string, workerId?: string) {
  return rpc<void>(client, "heartbeat", { p_room_id: roomId, p_device_id: deviceId ?? (typeof window !== "undefined" ? getBrowserDeviceId() : null), p_worker_id: workerId ?? null });
}

// Realtime is an invalidation signal; fetch an authorized snapshot after every change.
export function subscribeToRoom(client: SupabaseClient, roomId: string, onChange: () => void, onStatus?: (status: string) => void): () => void {
  const channel = client.channel(`room:${roomId}:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "room_claims", filter: `room_id=eq.${roomId}` }, onChange)
    .subscribe((status) => { onStatus?.(status); if (status === "SUBSCRIBED") onChange(); });
  return () => { void client.removeChannel(channel); };
}
