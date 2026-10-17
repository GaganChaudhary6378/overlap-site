"use client";

import { useEffect, useRef, useState } from "react";

type Mark = { at: number; label: string; tone: "ink" | "red" | "green" | "orange" };

const START = 10 * 60; // 10:00
const END = 14 * 60 + 30; // 14:30

const WITHOUT: Mark[] = [
  { at: 10 * 60, label: "Your Claude edits auth/session.ts", tone: "ink" },
  { at: 10 * 60 + 5, label: "Priya's Codex edits the same function", tone: "ink" },
  { at: 12 * 60 + 30, label: "Priya merges her PR", tone: "ink" },
  { at: 14 * 60, label: "GitHub: “This branch has conflicts”", tone: "red" },
];

const WITH: Mark[] = [
  { at: 10 * 60, label: "Your Claude leases L40–88", tone: "ink" },
  { at: 10 * 60 + 5, label: "Overlap warns Priya's Codex", tone: "orange" },
  { at: 10 * 60 + 7, label: "Codex reroutes to config/session.ts", tone: "green" },
  { at: 11 * 60, label: "Both PRs merge cleanly", tone: "green" },
];

const pct = (m: number) => ((m - START) / (END - START)) * 100;
const clock = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

const DOT: Record<Mark["tone"], string> = {
  ink: "var(--ink)",
  red: "var(--red)",
  green: "var(--green)",
  orange: "var(--orange)",
};

export default function Timeline() {
  const ref = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(END); // complete at rest
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const run = (ts: number) => {
          const p = Math.min(1, (ts - t0) / 6000);
          setNow(START + p * (END - START));
          if (p < 1) raf = requestAnimationFrame(run);
        };
        raf = requestAnimationFrame(run);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const lostHours = Math.max(0, Math.min(4, (now - START) / 60));

  return (
    <div ref={ref} className="flex flex-col gap-8">
      <Track title="With GitHub alone" marks={WITHOUT} now={now} />
      <Track title="With Overlap" marks={WITH} now={now} />
      <div className="grid gap-4 sm:grid-cols-2">
        <p className="border-l-2 border-red pl-4">
          <span className="block font-display text-4xl tabular-nums text-red">{lostHours.toFixed(1)} h</span>
          of agent work built on a collision before anyone sees it.
        </p>
        <p className="border-l-2 border-green pl-4">
          <span className="block font-display text-4xl tabular-nums text-green">2 min</span>
          from the first overlapping edit to a changed plan.
        </p>
      </div>
    </div>
  );
}

function Track({ title, marks, now }: { title: string; marks: Mark[]; now: number }) {
  return (
    <div>
      <p className="smallcaps mb-3 text-ink-2">{title}</p>
      <div className="relative mx-3 h-20">
        <div className="absolute inset-x-0 top-8 border-t-2 border-ink" />
        {/* sleepers */}
        <div
          className="absolute inset-x-0 top-6 h-4"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, var(--rule) 0 2px, transparent 2px 18px)" }}
        />
        {/* playhead (the train) */}
        <div className="absolute top-3.5 -ml-3 transition-[left] duration-100" style={{ left: `${pct(now)}%` }} aria-hidden>
          <svg width="26" height="14" viewBox="0 0 26 14">
            <rect x="1" y="2" width="18" height="8" fill="var(--ink)" />
            <rect x="19" y="5" width="6" height="5" fill="var(--ink)" />
            <rect x="4" y="0" width="3" height="3" fill="var(--ink)" />
            <circle cx="6" cy="12" r="2" fill="var(--paper)" stroke="var(--ink)" />
            <circle cx="15" cy="12" r="2" fill="var(--paper)" stroke="var(--ink)" />
          </svg>
        </div>
        {marks.map((m, i) => (
          <span
            key={m.label}
            className="absolute top-[22px] flex size-5 -translate-x-1/2 items-center justify-center rounded-full border-2 border-paper font-mono text-[10px] font-semibold text-paper"
            style={{
              left: `${pct(m.at)}%`,
              background: DOT[m.tone],
              opacity: now >= m.at ? 1 : 0.2,
              transition: "opacity 400ms ease",
              zIndex: i,
            }}
          >
            {i + 1}
          </span>
        ))}
        {[10, 11, 12, 13, 14].map((h) => (
          <span
            key={h}
            className="absolute top-14 -translate-x-1/2 font-mono text-[0.7rem] text-ink-3"
            style={{ left: `${pct(h * 60)}%` }}
          >
            {h}:00
          </span>
        ))}
      </div>
      <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {marks.map((m, i) => (
          <li
            key={m.label}
            className="flex gap-2 text-[0.95rem] leading-snug transition-opacity duration-500"
            style={{ opacity: now >= m.at ? 1 : 0.35, color: m.tone === "red" ? "var(--red)" : "var(--ink-2)" }}
          >
            <span className="shrink-0 whitespace-nowrap pt-0.5 font-mono text-[0.75rem] tabular-nums text-ink-3">{i + 1} · {clock(m.at)}</span>
            {m.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
