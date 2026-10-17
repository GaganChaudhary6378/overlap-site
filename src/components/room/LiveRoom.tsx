"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Signal } from "@/components/Signal";
import {
  EVENTS,
  MEMBERS,
  RUN_LENGTH,
  currentStep,
  involvement,
  leaseHeld,
  roomStatusAt,
  touchesAt,
  type Member,
  type RoomStatus,
} from "./script";

const STATUS_RING: Record<RoomStatus, string> = {
  clear: "shadow-card",
  caution: "shadow-[0_0_0_1.5px_var(--orange),0_8px_22px_-10px_var(--orange)]",
  danger: "shadow-[0_0_0_2px_var(--red),0_10px_26px_-8px_var(--red)]",
};

const TOOL_GLYPH: Record<Member["tool"], string> = {
  "Claude Code": "✳",
  Codex: "◎",
  Cursor: "▲",
};

/** Session clock: one demo second stands for six real seconds, starting at 14:02. */
function fmt(t: number) {
  const sec = Math.floor(t * 6);
  return `14:${String(2 + Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

function useClock() {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      last.current = null;
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      if (last.current != null) {
        const dt = ((now - last.current) / 1000) * speed;
        setT((v) => (v + dt > RUN_LENGTH ? 0 : v + dt));
      }
      last.current = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  return { t, setT, playing, setPlaying, speed, setSpeed };
}

export default function LiveRoom({ onStatusChange }: { onStatusChange?: (s: RoomStatus) => void }) {
  const { t, setT, playing, setPlaying, speed, setSpeed } = useClock();
  /** null = follow the room (open while agents overlap); true/false = reader's choice */
  const [markerChoice, setMarkerChoice] = useState<boolean | null>(null);
  const status = roomStatusAt(t);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);
  const log = useMemo(() => EVENTS.filter((e) => e.t <= t).slice(-7).reverse(), [t]);
  const warned = t >= 11.2;
  const markersAvailable = t >= 9.4 && t < 24.2;

  const showMarkers = markerChoice ?? markersAvailable;

  return (
    <div className="overflow-hidden rounded-window bg-page font-sans text-ink shadow-raised">
      {/* window chrome */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-canvas px-4 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-3 rounded-full bg-red/70" />
          <span className="size-3 rounded-full bg-orange/70" />
          <span className="size-3 rounded-full bg-green/70" />
        </div>
        <p className="text-[13px] font-medium">
          Room <span className="font-mono text-ink-2">#acme-web</span>
          <span className="text-ink-3"> · auth sprint · 3 members, 3 agents</span>
        </p>
        <div className="ml-auto flex items-center gap-2">
          <StatusPill status={status} />
          <span className="font-mono text-[12px] tabular-nums text-ink-3">{fmt(t)}</span>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="rounded-control px-2.5 py-1 text-[12px] font-medium shadow-btn hover:bg-hover-2"
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={() => {
              setT(0);
              setPlaying(true);
              setMarkerChoice(null);
            }}
            className="rounded-control px-2.5 py-1 text-[12px] font-medium shadow-btn hover:bg-hover-2"
          >
            Replay
          </button>
          <button
            type="button"
            onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
            className="rounded-control px-2 py-1 font-mono text-[12px] shadow-btn hover:bg-hover-2"
            aria-label="Playback speed"
          >
            {speed}×
          </button>
        </div>
      </div>

      {/* scrubber */}
      <input
        id="room-scrubber"
        aria-label="Scrub the session"
        type="range"
        min={0}
        max={RUN_LENGTH}
        step={0.1}
        value={t}
        onChange={(e) => {
          setT(Number(e.target.value));
          setPlaying(false);
        }}
        className="block h-1.5 w-full cursor-pointer accent-[var(--accent)]"
      />

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* agents */}
        <div className="flex min-w-0 flex-col gap-3">
          {MEMBERS.map((m) => (
            <AgentCard key={m.id} member={m} t={t} />
          ))}
        </div>

        {/* file map + markers + payload */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="rounded-card bg-surface p-3.5 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[12.5px]">auth/session.ts</p>
              <span className="text-[11.5px] text-ink-3">base: origin/main · lines 1–140</span>
            </div>
            <LineRuler t={t} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!markersAvailable}
                onClick={() => setMarkerChoice(!showMarkers)}
                className="rounded-control px-2.5 py-1 text-[12px] font-medium shadow-btn enabled:hover:bg-hover-2 disabled:opacity-40"
                aria-expanded={showMarkers && markersAvailable}
              >
                {showMarkers && markersAvailable ? "Hide conflict markers" : "Show conflict markers"}
              </button>
              <span className="text-[11.5px] text-ink-3">
                {markersAvailable ? "Fetched on demand from refs/overlap/*, merged locally with git merge-tree" : "No overlap on this file"}
              </span>
            </div>
            {showMarkers && markersAvailable && <ConflictMarkers resolved={t >= 13.6} />}
          </div>

          <div
            className="rounded-card bg-surface p-3.5 shadow-card transition-opacity duration-500"
            style={{ opacity: warned ? 1 : 0.45 }}
          >
            <p className="mb-1.5 text-[12px] font-medium text-ink-2">
              What Priya&apos;s Codex received{" "}
              <span className="font-normal text-ink-3">· MCP who_is_touching()</span>
            </p>
            <pre className="overflow-x-auto rounded-chip bg-inset p-2.5 font-mono text-[11.5px] leading-relaxed text-ink-2">
{warned
  ? `{
  "path": "auth/session.ts",
  "range": [52, 70],
  "status": "held",
  "holder": { "member": "gagan", "tool": "claude-code" },
  "held_range": [40, 88],
  "symbol": "createSession",
  "expires_in_s": ${Math.max(0, Math.round((22.4 - t) * 20))},
  "advice": "advisory"
}`
  : "// waiting for a pre-edit check…"}
            </pre>
          </div>
        </div>
      </div>

      {/* telegraph log */}
      <div className="border-t border-line bg-canvas px-4 py-3">
        <p className="mb-1.5 text-[11.5px] font-medium tracking-wide text-ink-3 uppercase">Dispatches</p>
        <ol className="flex flex-col gap-1 font-mono text-[12px]" aria-live="polite">
          {log.length === 0 && <li className="text-ink-3">Room open. Waiting for agents…</li>}
          {log.map((e) => (
            <li
              key={`${e.t}-${e.text}`}
              className="flex min-w-0 gap-2"
              style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}
            >
              <span className="shrink-0 tabular-nums text-ink-3">{fmt(e.t)}</span>
              <span
                className="shrink-0 font-semibold"
                style={{
                  color:
                    e.who === "overlap"
                      ? e.kind === "clear"
                        ? "var(--green)"
                        : "var(--red)"
                      : MEMBERS.find((m) => m.id === e.who)?.color,
                }}
              >
                {e.who === "overlap" ? "OVERLAP" : e.who.toUpperCase()}
              </span>
              <span className="min-w-0 truncate text-ink-2">{e.text}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex justify-center border-t border-line bg-page py-3 lg:hidden">
        <Signal state={status} size={120} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: RoomStatus }) {
  const map = {
    clear: { cls: "bg-green-tint text-green", text: "All lines clear" },
    caution: { cls: "bg-orange-tint text-orange", text: "Lease held · 1 agent waiting" },
    danger: { cls: "bg-red-tint text-red", text: "Overlap · same lines" },
  }[status];
  return (
    <span
      key={status}
      className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-medium ${map.cls}`}
      style={{ animation: "pop-in 250ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      <span
        className="size-1.5 rounded-full bg-current"
        style={status === "danger" ? { animation: "lamp-pulse 1.2s ease-in-out infinite" } : undefined}
      />
      {map.text}
    </span>
  );
}

function AgentCard({ member, t }: { member: Member; t: number }) {
  const step = currentStep(t, member.id);
  const state = involvement(t, member.id);
  const touches = touchesAt(t, member.id);
  const done = step?.kind === "done";
  const waiting = member.id === "priya" && t >= 13.6 && t < 24.2;

  return (
    <article className={`rounded-card bg-surface p-3.5 transition-shadow duration-500 ${STATUS_RING[state]}`}>
      <header className="flex items-center gap-2.5">
        <span
          className="flex size-7 items-center justify-center rounded-full text-[12px] font-semibold text-white"
          style={{ background: member.color }}
          aria-hidden
        >
          {member.name[0]}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-tight">
            {member.name}
            <span className="ml-1.5 font-normal text-ink-3">
              {TOOL_GLYPH[member.tool]} {member.tool}
            </span>
          </p>
          <p className="truncate font-mono text-[11.5px] text-ink-3">{member.branch}</p>
        </div>
        <span className="ml-auto hidden text-right text-[11.5px] text-ink-3 sm:inline">{member.task}</span>
      </header>

      <div className="mt-2.5 flex min-h-6 items-center gap-2 text-[12.5px]">
        {done ? (
          <span className="text-green">✓</span>
        ) : (
          <span
            aria-hidden
            className="size-3 shrink-0 rounded-full border-[1.5px] border-ink-3 border-t-transparent"
            style={{ animation: step ? "spin 1s linear infinite" : undefined }}
          />
        )}
        <span key={step?.text} className="min-w-0 truncate text-ink-2" style={{ animation: "fade-in 250ms ease-out both" }}>
          {step?.text ?? "Starting session…"}
        </span>
        {waiting && (
          <span className="ml-auto shrink-0 rounded-full bg-orange-tint px-2 py-0.5 text-[11px] font-medium text-orange">
            waiting for lease
          </span>
        )}
        {member.id === "gagan" && leaseHeld(t) && (
          <span className="ml-auto shrink-0 rounded-full bg-accent-tint px-2 py-0.5 text-[11px] font-medium text-accent-ink">
            holds lease
          </span>
        )}
      </div>

      {touches.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {touches.map((tc) => (
            <li
              key={tc.file}
              className="rounded-chip bg-inset px-1.5 py-0.5 font-mono text-[11px] text-ink-2 shadow-hairline"
              style={{ animation: "pop-in 250ms cubic-bezier(0.23,1,0.32,1) both" }}
            >
              {tc.file} <span className="text-ink-3">L{tc.from}–{tc.to}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function LineRuler({ t }: { t: number }) {
  const total = 140;
  const g = touchesAt(t, "gagan").find((x) => x.file === "auth/session.ts");
  const p = touchesAt(t, "priya").find((x) => x.file === "auth/session.ts");
  const gActive = g && leaseHeld(t);
  const overlap = g && p && gActive && Math.max(g.from, p.from) < Math.min(g.to, p.to);

  const bar = (from: number, to: number) => ({
    left: `${(from / total) * 100}%`,
    width: `${((to - from) / total) * 100}%`,
  });

  return (
    <div className="relative">
      <div className="relative h-14 overflow-hidden rounded-chip bg-inset shadow-hairline">
        {/* line ticks */}
        {Array.from({ length: 15 }, (_, i) => (
          <span key={i} className="absolute top-0 h-full w-px bg-line" style={{ left: `${(i * 10 * 100) / total}%` }} />
        ))}
        {g && (
          <div
            className="absolute top-2.5 h-4 rounded-sm transition-all duration-700"
            style={{ ...bar(g.from, g.to), background: "var(--accent-tint)", boxShadow: "inset 0 0 0 1px var(--accent)", opacity: gActive ? 1 : 0.35 }}
          >
          </div>
        )}
        {p && (
          <div
            className="absolute bottom-2.5 h-4 rounded-sm transition-all duration-700"
            style={{ ...bar(p.from, p.to), background: "var(--orange-tint)", boxShadow: "inset 0 0 0 1px var(--brass)" }}
          >
          </div>
        )}
        {overlap && g && p && (
          <div
            className="absolute inset-y-0 transition-all duration-500"
            style={{
              ...bar(Math.max(g.from, p.from), Math.min(g.to, p.to)),
              background:
                "repeating-linear-gradient(135deg, var(--red-tint) 0 4px, transparent 4px 8px)",
              boxShadow: "inset 0 0 0 1.5px var(--red)",
            }}
            aria-label="Overlapping lines"
          />
        )}
      </div>
      <div className="relative mt-1 h-3 font-mono text-[10px] tabular-nums text-ink-3">
        {[1, 40, 70, 100, 140].map((n) => (
          <span key={n} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: `${(n / total) * 100}%` }}>
            L{n}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm" style={{ background: "var(--accent-tint)", boxShadow: "inset 0 0 0 1px var(--accent)" }} />
          Gagan · Claude Code {g ? `L${g.from}–${g.to}` : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm" style={{ background: "var(--orange-tint)", boxShadow: "inset 0 0 0 1px var(--brass)" }} />
          Priya · Codex {p ? `L${p.from}–${p.to}` : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm" style={{ background: "repeating-linear-gradient(135deg, var(--red-tint) 0 3px, transparent 3px 6px)", boxShadow: "inset 0 0 0 1px var(--red)" }} />
          Same lines
        </span>
      </div>
    </div>
  );
}

function ConflictMarkers({ resolved }: { resolved: boolean }) {
  const lines: { text: string; tone: "ctx" | "ours" | "theirs" | "mark" }[] = [
    { text: "export function createSession(user: User, opts: SessionOpts) {", tone: "ctx" },
    { text: "<<<<<<< refs/overlap/gagan/token-rotation  (Claude Code)", tone: "mark" },
    { text: "  const ttl = opts.rotate ? SHORT_TTL : DEFAULT_TTL;", tone: "ours" },
    { text: "  const token = rotateToken(user.id, ttl);", tone: "ours" },
    { text: "=======", tone: "mark" },
    { text: "  const ttl = config.session.timeoutMinutes * 60;", tone: "theirs" },
    { text: "  const token = signToken(user.id, ttl);", tone: "theirs" },
    { text: ">>>>>>> refs/overlap/priya/session-timeout  (Codex)", tone: "mark" },
    { text: "  return persist(token);", tone: "ctx" },
  ];
  const tone = {
    ctx: "text-ink-3",
    mark: "font-semibold text-red",
    ours: "bg-accent-tint text-accent-ink",
    theirs: "bg-orange-tint text-ink",
  };
  return (
    <div className="mt-3" style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}>
      <div className="overflow-x-auto rounded-chip bg-inset py-1.5 font-mono text-[11.5px] leading-relaxed shadow-hairline">
        {lines.map((l, i) => (
          <div key={i} className={`whitespace-pre px-2.5 ${tone[l.tone]}`}>
            {l.text}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[11.5px] text-ink-3">
        {resolved
          ? "Prevented: Priya's agent moved the timeout into config/session.ts and will build on rotateToken() after Gagan pushes."
          : "This conflict would appear in a pull request hours from now. Overlap shows it while both agents are still working."}
      </p>
    </div>
  );
}
