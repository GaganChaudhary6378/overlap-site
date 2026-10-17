/* The scripted session that the live room replays.
 * Times are seconds from the start of the run. */

export type MemberId = "gagan" | "priya" | "rahul";

export type Member = {
  id: MemberId;
  name: string;
  tool: "Claude Code" | "Codex" | "Cursor";
  branch: string;
  task: string;
  color: string;
};

export const MEMBERS: Member[] = [
  { id: "gagan", name: "Gagan", tool: "Claude Code", branch: "token-rotation", task: "Rotate refresh tokens on every login", color: "var(--accent)" },
  { id: "priya", name: "Priya", tool: "Codex", branch: "session-timeout", task: "Make session timeout configurable", color: "var(--brass)" },
  { id: "rahul", name: "Rahul", tool: "Cursor", branch: "billing-copy", task: "Rewrite billing page copy", color: "var(--green)" },
];

export type Touch = { file: string; from: number; to: number };

export type RoomEvent = {
  t: number;
  who: MemberId | "overlap";
  kind: "read" | "plan" | "edit" | "lease" | "warn" | "reroute" | "run" | "push" | "release" | "done" | "clear";
  text: string;
  touch?: Touch;
};

export const EVENTS: RoomEvent[] = [
  { t: 0.6, who: "gagan", kind: "read", text: "Read auth/session.ts" },
  { t: 1.6, who: "rahul", kind: "read", text: "Read app/billing/page.tsx" },
  { t: 2.6, who: "priya", kind: "plan", text: "Plan: add a timeout setting to the session config" },
  { t: 3.6, who: "gagan", kind: "lease", text: "Lease granted · auth/session.ts L40–88 · 10 min", touch: { file: "auth/session.ts", from: 40, to: 88 } },
  { t: 4.4, who: "gagan", kind: "edit", text: "Edit auth/session.ts · +31 −12", touch: { file: "auth/session.ts", from: 40, to: 88 } },
  { t: 5.2, who: "rahul", kind: "edit", text: "Edit app/billing/page.tsx · +18 −22", touch: { file: "app/billing/page.tsx", from: 12, to: 30 } },
  { t: 6.8, who: "priya", kind: "read", text: "Read auth/session.ts" },
  { t: 9.0, who: "priya", kind: "lease", text: "Pre-edit check · auth/session.ts L52–70", touch: { file: "auth/session.ts", from: 52, to: 70 } },
  { t: 9.4, who: "overlap", kind: "warn", text: "Overlap: L52–70 inside Gagan's lease L40–88 (symbol createSession)" },
  { t: 11.2, who: "priya", kind: "warn", text: "Warning delivered to Codex (structured, no free text)" },
  { t: 13.6, who: "priya", kind: "reroute", text: "Reroute: put timeout in config/session.ts, wait for rotateToken()" },
  { t: 16.0, who: "priya", kind: "edit", text: "Edit config/session.ts · +24 −0", touch: { file: "config/session.ts", from: 1, to: 24 } },
  { t: 19.0, who: "gagan", kind: "run", text: "Run npm test auth · 42 passed" },
  { t: 21.6, who: "gagan", kind: "push", text: "Snapshot → refs/overlap/gagan/token-rotation" },
  { t: 22.4, who: "gagan", kind: "release", text: "Lease released · auth/session.ts" },
  { t: 24.2, who: "priya", kind: "edit", text: "Edit auth/session.ts L52–60 on top of Gagan's change · +6 −2", touch: { file: "auth/session.ts", from: 52, to: 60 } },
  { t: 27.0, who: "rahul", kind: "done", text: "Done · 1 file, opened PR #418" },
  { t: 29.5, who: "overlap", kind: "clear", text: "Room clear · 0 conflicts reached a pull request" },
];

export const RUN_LENGTH = 33;

export type RoomStatus = "clear" | "caution" | "danger";

export function roomStatusAt(t: number): RoomStatus {
  if (t >= 9.4 && t < 13.6) return "danger";
  if (t >= 13.6 && t < 22.4) return "caution";
  return "clear";
}

export function involvement(t: number, id: MemberId): RoomStatus {
  const s = roomStatusAt(t);
  if (s === "clear") return "clear";
  return id === "gagan" || id === "priya" ? s : "clear";
}

export function currentStep(t: number, id: MemberId): RoomEvent | undefined {
  let last: RoomEvent | undefined;
  for (const e of EVENTS) if (e.who === id && e.t <= t) last = e;
  return last;
}

/** Live touch-set per member: the latest range each member has on each file. */
export function touchesAt(t: number, id: MemberId): Touch[] {
  const map = new Map<string, Touch>();
  for (const e of EVENTS) {
    if (e.t > t || e.who !== id || !e.touch) continue;
    map.set(e.touch.file, e.touch);
  }
  return [...map.values()];
}

export function leaseHeld(t: number): boolean {
  return t >= 3.6 && t < 22.4;
}
