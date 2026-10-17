import type { BrowserContext, Route } from "@playwright/test";
import type { Room, RoomClaim, RoomMember } from "../../src/lib/rooms";

export const MOCK_SUPABASE_URL = "https://overlap-e2e.supabase.co";

// UI contract coverage only. This deliberately cannot verify Postgres/RLS or real Auth/Realtime.
export class MockSupabase {
  rooms: Room[] = [];
  members: RoomMember[] = [];
  claims: RoomClaim[] = [];
  invite = "e2e-private-invite";
  calls: string[] = [];
  private users = new Map<string, { id: string; email: string }>();

  async connect(context: BrowserContext) {
    await context.route(`${MOCK_SUPABASE_URL}/**`, (route) => this.handle(route));
    // Force the app's snapshot polling fallback, without contacting a real WebSocket server.
    await context.routeWebSocket("wss://overlap-e2e.supabase.co/**", (socket) => socket.close());
  }

  private async handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const payload = request.postDataJSON() ?? {};
    const respond = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" }, body: JSON.stringify(data) });
    this.calls.push(url.pathname);
    if (request.method() === "OPTIONS") return respond({});
    if (url.pathname === "/auth/v1/otp") return respond({});
    if (url.pathname === "/auth/v1/verify") {
      if (payload.token !== "123456") return respond({ msg: "Invalid email code", code: "otp_expired" }, 403);
      const email = String(payload.email);
      let user = this.users.get(email);
      if (!user) { user = { id: crypto.randomUUID(), email }; this.users.set(email, user); }
      const now = Math.floor(Date.now() / 1000);
      const accessToken = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: user.id, role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now })).toString("base64url")}.e2e-test-signature`;
      return respond({ access_token: accessToken, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "e2e-test-refresh", user: { ...user, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
    }
    if (url.pathname === "/auth/v1/logout") return respond({});
    const bearer = request.headers().authorization?.replace("Bearer ", "") ?? "";
    let userId = "";
    try { userId = JSON.parse(Buffer.from(bearer.split(".")[1], "base64url").toString()).sub; } catch { /* Public requests have no test session. */ }
    if (!userId) return respond({ message: "Sign in required" }, 401);
    if (url.pathname === "/rest/v1/rooms") return respond(this.rooms.filter((room) => this.members.some((member) => member.room_id === room.id && member.user_id === userId)));
    const rpc = url.pathname.split("/").at(-1);
    if (rpc === "create_room") {
      const room: Room = { id: crypto.randomUUID(), name: payload.p_name, owner_id: userId };
      this.rooms.push(room);
      this.members.push({ room_id: room.id, user_id: userId, display_name: payload.p_display_name, last_seen: new Date().toISOString() });
      return respond({ room_id: room.id, invite_token: this.invite });
    }
    if (rpc === "join_room") {
      if (payload.p_invite_token !== this.invite) return respond({ message: "Invalid invite" }, 400);
      const roomId = this.rooms[0].id;
      this.members.push({ room_id: roomId, user_id: userId, display_name: payload.p_display_name, last_seen: new Date().toISOString() });
      return respond(roomId);
    }
    const member = this.members.find((member) => member.user_id === userId && member.room_id === payload.p_room_id);
    if (rpc === "room_snapshot") {
      if (!member) return respond({ message: "Room access denied" }, 403);
      return respond({ room: this.rooms.find((room) => room.id === payload.p_room_id), members: this.members.filter((member) => member.room_id === payload.p_room_id), claims: this.claims.filter((claim) => claim.room_id === payload.p_room_id), server_time: new Date().toISOString() });
    }
    if (rpc === "heartbeat") {
      if (!member) return respond({ message: "Room access denied" }, 403);
      member.last_seen = new Date().toISOString();
      this.claims.filter((claim) => claim.user_id === userId && claim.room_id === member.room_id && claim.device_id === payload.p_device_id && (!payload.p_worker_id || claim.worker_id === payload.p_worker_id) && Date.parse(claim.expires_at) > Date.now()).forEach((claim) => { claim.expires_at = new Date(Date.now() + 90000).toISOString(); });
      return respond(null);
    }
    if (rpc === "claim_lines") {
      if (!member) return respond({ message: "Room access denied" }, 403);
      const claim: RoomClaim = { id: crypto.randomUUID(), room_id: payload.p_room_id, user_id: userId, device_id: payload.p_device_id, worker_id: payload.p_worker_id, target_key: payload.p_target_key || "", display_name: member.display_name, file_path: payload.p_file_path, start_line: payload.p_start_line, end_line: payload.p_end_line, branch: payload.p_branch, agent: payload.p_agent, expires_at: new Date(Date.now() + 90000).toISOString() };
      const conflicts = this.claims.filter((other) => (other.user_id !== userId || other.device_id !== claim.device_id || other.worker_id !== claim.worker_id) && other.file_path === claim.file_path && (other.start_line <= claim.end_line && claim.start_line <= other.end_line || Boolean(claim.target_key) && other.target_key === claim.target_key));
      const existing = this.claims.find((other) => other.room_id === claim.room_id && other.user_id === claim.user_id && other.device_id === claim.device_id && other.worker_id === claim.worker_id && other.file_path === claim.file_path);
      if (existing) Object.assign(existing, claim, { id: existing.id }); else this.claims.push(claim);
      return respond({ claim_id: existing?.id ?? claim.id, conflicts });
    }
    if (rpc === "release_claim") {
      this.claims = this.claims.filter((claim) => claim.id !== payload.p_claim_id || claim.user_id !== userId);
      return respond(null);
    }
    if (rpc === "revoke_member") {
      if (!this.rooms.some((room) => room.id === payload.p_room_id && room.owner_id === userId)) return respond({ message: "Owner only" }, 403);
      this.members = this.members.filter((member) => member.room_id !== payload.p_room_id || member.user_id !== payload.p_user_id);
      this.claims = this.claims.filter((claim) => claim.room_id !== payload.p_room_id || claim.user_id !== payload.p_user_id);
      this.invite = "e2e-revoked-old-invite";
      return respond(null);
    }
    if (rpc === "rotate_invite") { this.invite = "e2e-rotated-invite"; return respond(this.invite); }
    return respond({ message: `Unhandled test endpoint: ${url.pathname}` }, 500);
  }
}
