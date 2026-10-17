"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import ThinkingState from "@/components/bui/ThinkingState";
import ToolChips, { type ToolStep, type ToolDiff, type ToolDiffLine } from "@/components/bui/ToolChips";
import TaskRows, { type TaskRow } from "@/components/bui/TaskRows";

/** Remounts its children the first time they scroll into view, so their
 *  built-in animation plays where the reader can see it. */
function ReplayInView({ children, minHeight }: { children: (key: number) => ReactNode; minHeight: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRun((r) => r + 1);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ minHeight }}>
      {children(run)}
    </div>
  );
}

const GAGAN_STEPS: ToolStep[] = [
  {
    icon: "think", label: "Thinking", chip: "Checking the room before editing…", mono: false, detailMono: false,
    detail: [
      { text: "who_is_touching(auth/session.ts) → free. Claiming L40–88 for 10 min." },
      { text: "Lease granted. Teammates now see this range in the room." },
    ],
  },
  {
    icon: "write", label: "Write 31 lines", chip: "auth/session.ts", mono: true, detailMono: true,
    detail: [
      { text: "+ const ttl = opts.rotate ? SHORT_TTL : DEFAULT_TTL", tone: "add" },
      { text: "+ const token = rotateToken(user.id, ttl)", tone: "add" },
    ],
  },
  {
    icon: "run", label: "Run tests", chip: "npm test auth", mono: true, detailMono: true,
    detail: [{ text: "✓ 42 passed" }, { text: "✓ snapshot pushed to refs/overlap/gagan/token-rotation" }],
  },
  {
    icon: "read", label: "Release lease", chip: "auth/session.ts", mono: true, detailMono: false,
    detail: [{ text: "Lease released. Priya's Codex is notified and resumes." }],
  },
];

const GAGAN_DIFFS: ToolDiff[] = [
  { file: "auth/session.ts", add: 31, del: 12 },
  { file: "auth/tokens.ts", add: 18, del: 0 },
];

const GAGAN_DIFF_LINES: Record<string, ToolDiffLine[]> = {
  "auth/session.ts": [
    { text: "export function createSession(user, opts) {", tone: "ctx" },
    { text: "  const token = signToken(user.id, DEFAULT_TTL);", tone: "del" },
    { text: "  const ttl = opts.rotate ? SHORT_TTL : DEFAULT_TTL;", tone: "add" },
    { text: "  const token = rotateToken(user.id, ttl);", tone: "add" },
    { text: "}", tone: "ctx" },
  ],
  "auth/tokens.ts": [
    { text: "export function rotateToken(id: string, ttl: number) {", tone: "add" },
    { text: "  revokePrevious(id);", tone: "add" },
    { text: "  return signToken(id, ttl);", tone: "add" },
    { text: "}", tone: "add" },
  ],
};

const ROOM_TASKS: TaskRow[] = [
  {
    key: "gagan",
    label: "Gagan · Claude",
    amount: "token rotation",
    status: "done",
    details: [
      { label: "auth/session.ts", meta: "+31 −12" },
      { label: "auth/tokens.ts", meta: "+18" },
    ],
  },
  {
    key: "priya",
    label: "Priya · Codex",
    amount: "waits for lease",
    status: "running",
    step: 2,
    details: [
      { label: "config/session.ts", meta: "+24" },
      { label: "auth/session.ts L52–60", meta: "queued" },
    ],
  },
  {
    key: "rahul",
    label: "Rahul · Cursor",
    amount: "billing copy",
    status: "sequence",
    step: 3,
    details: [
      { label: "app/billing/page.tsx", meta: "+18 −22" },
      { label: "PR #418", meta: "opened" },
    ],
  },
];

export default function AgentInternals() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Panel title="Gagan's Claude Code" note="ToolChips · each tool call the agent made, with diffs">
        <ReplayInView minHeight={220}>
          {(k) => (
            <ToolChips
              key={k}
              steps={GAGAN_STEPS}
              diffs={GAGAN_DIFFS}
              diffLines={GAGAN_DIFF_LINES}
              labels={{ header: "4 tool calls · 1 lease", more: "+1 more" }}
            />
          )}
        </ReplayInView>
      </Panel>

      <Panel title="Priya's Codex, after the warning" note="ThinkingState · the agent's reasoning as it reroutes">
        <ReplayInView minHeight={200}>
          {(k) => (
            <ThinkingState
              key={k}
              active="Re-planning around a held lease"
              done="Re-planned in 4 seconds"
              rows={[
                { primary: "auth/session.ts L52–70 is held by Gagan's Claude Code until it pushes." },
                { primary: "The timeout can live in config/session.ts first.", secondary: "no overlap" },
                { primary: "Read timeoutMinutes inside createSession once rotateToken() lands." },
                { primary: "Queue a 6-line edit on L52–60 after the lease is released." },
              ]}
            />
          )}
        </ReplayInView>
      </Panel>

      <Panel title="The room's task board" note="TaskRows · every member's agent work in one list">
        <ReplayInView minHeight={200}>
          {(k) => <TaskRows key={k} rows={ROOM_TASKS} labels={{ completed: "Pushed", failed: "Blocked" }} />}
        </ReplayInView>
      </Panel>
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <div className="overflow-hidden rounded-window bg-page font-sans text-ink shadow-raised">
        <div className="flex items-center gap-2 border-b border-line bg-canvas px-3 py-2">
          <span className="size-2 rounded-full bg-ink-3/50" />
          <span className="text-[12px] font-medium text-ink-2">{title}</span>
        </div>
        <div className="p-4">{children}</div>
      </div>
      <figcaption className="text-[0.95rem] italic text-ink-2">{note}</figcaption>
    </figure>
  );
}
