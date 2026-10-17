import type { ReactNode } from "react";
import Link from "next/link";
import AuthRedirect from "@/components/AuthRedirect";
import HeroSignal from "@/components/HeroSignal";
import RoomSection from "@/components/room/RoomSection";
import AgentInternals from "@/components/AgentInternals";
import Timeline from "@/components/Timeline";
import FlowDiagram from "@/components/FlowDiagram";
import { SingleLineEngraving } from "@/components/Engravings";
import { FleuronRule, Plate, Stamp, TickerTape } from "@/components/Ornaments";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8">
      <AuthRedirect />
      <Masthead />
      <Hero />
      <Section numeral="I" kicker="The trouble" title="Agents write at machine speed. Teams still find collisions at merge time.">
        <Problem />
      </Section>
      <Section
        numeral="II"
        kicker="A room, live"
        title="Three teammates, three agents, one shared file"
        lede="This is a replay of one auth sprint. Press Pause, drag the scrubber, or open the conflict markers. At 14:02:54 Priya's Codex asks to edit lines Gagan's Claude Code already holds."
      >
        <RoomSection />
      </Section>
      <Section
        numeral="III"
        kicker="Inside each agent"
        title="The room reads what the agents already report"
        lede="Claude Code, Codex and Cursor emit tool calls, plans and edits through their hooks. Overlap turns those into one shared picture. These panels use Beautiful UI's agent components."
      >
        <AgentInternals />
      </Section>
      <Section
        numeral="IV"
        kicker="Why not just GitHub?"
        title="GitHub tells you after the work is done. Overlap tells you while it happens."
      >
        <WhyNotGitHub />
      </Section>
      <Section numeral="V" kicker="How it works" title="Hooks in, metadata to the room, code stays in your git remote">
        <HowItWorks />
      </Section>
      <Section numeral="VI" kicker="An old answer" title="Railways solved this in 1878 with a brass token">
        <Precedent />
      </Section>
      <Section numeral="VII" kicker="The field" title="Who already does part of this">
        <Market />
      </Section>
      <Section numeral="VIII" kicker="What we must prove" title="The plan, with the conditions under which we stop">
        <Plan />
      </Section>
      <Footer />
    </div>
  );
}

function Masthead() {
  return (
    <header className="pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-ink-2">
        <span className="smallcaps">Vol. I · No. 1</span>
        <span className="smallcaps hidden sm:inline">Bulletin for teams who build with agents</span>
        <span className="smallcaps">October 2026</span>
      </div>
      <div className="rule-double mt-2" />
      <div className="flex items-center justify-center gap-4 py-3 sm:gap-8">
        <span className="hidden font-display text-3xl text-brass sm:inline" aria-hidden>☙</span>
        <p className="text-center font-display text-5xl tracking-wide sm:text-7xl">Overlap</p>
        <span className="hidden font-display text-3xl text-brass sm:inline" aria-hidden>❧</span>
      </div>
      <p className="smallcaps -mt-1 pb-3 text-center text-sm text-ink-2">
        A live room for every teammate&apos;s coding agents · Claude Code · Codex · Cursor
      </p>
      <div className="rule-double" />
      <TickerTape />
    </header>
  );
}

function Hero() {
  return (
    <section className="grid items-center gap-10 py-14 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <p className="smallcaps mb-4 text-brass">Notice to all engineers and their agents</p>
        <h1 className="text-5xl sm:text-6xl lg:text-7xl">
          One line,
          <br />
          <em className="text-red">one agent.</em>
        </h1>
        <p className="mt-6 max-w-[34rem] text-xl leading-relaxed text-ink-2">
          Overlap is a live room for your team&apos;s coding agents. Everyone sees what Claude Code, Codex and Cursor are
          editing right now, on every teammate&apos;s machine. When two agents reach for the same lines, the room turns red
          and the second agent is told before it writes.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 font-sans text-sm">
          <Link href="/app" className="rounded-control bg-ink px-4 py-2.5 font-medium text-paper hover:opacity-90">
            Open your room
          </Link>
          <a href="#room" className="rounded-control bg-ink px-4 py-2.5 font-medium text-paper hover:opacity-90">
            Watch a live room
          </a>
          <a href="#plan" className="rounded-control px-4 py-2.5 font-medium shadow-btn hover:bg-paper-2">
            Read the plan
          </a>
        </div>
      </div>
      <Plate className="mx-auto w-full max-w-sm">
        <div className="flex flex-col items-center">
          <HeroSignal />
          <p className="mt-3 text-center text-sm italic text-ink-2">
            Fig. A. The room&apos;s signal. Arm down: line clear. Arm level: two agents on the same lines.
          </p>
        </div>
      </Plate>
    </section>
  );
}

function Section({
  numeral,
  kicker,
  title,
  lede,
  children,
}: {
  numeral: string;
  kicker: string;
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  const id = { II: "room", VIII: "plan" }[numeral];
  return (
    <section id={id} className="scroll-mt-6 pb-16">
      <FleuronRule />
      <div className="mt-14 mb-10 grid gap-4 md:grid-cols-[8.5rem_minmax(0,1fr)]">
        <p className="font-display text-5xl leading-none text-brass md:border-r md:border-rule md:pr-6 md:text-right" aria-hidden>
          {numeral}
        </p>
        <div className="min-w-0">
          <p className="smallcaps text-ink-2">{kicker}</p>
          <h2 className="mt-1 max-w-4xl text-4xl sm:text-5xl">{title}</h2>
          {lede && <p className="mt-4 max-w-[42rem] text-lg text-ink-2">{lede}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Problem() {
  const quotes = [
    { q: "Merge conflicts everywhere. Two agents touched the same utility file.", who: "Engineer running Claude Code, Codex and Cursor in parallel, LinkedIn" },
    { q: "With a team of agents, suddenly one engineer is creating the merge conflicts that would typically only plague much bigger orgs.", who: "Amplify Partners, “Will agents like Git any more than we do?”" },
    { q: "The coordination problem is harder than the coding problem.", who: "Team running six agents that commit daily, r/ClaudeCode" },
    { q: "Two teammates in the same file = merge hell.", who: "Claude Code Agent Teams practical guide" },
  ];
  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="max-w-[38rem] space-y-5 text-lg">
        <p className="drop-cap">
          A developer with three agents now produces the parallel work of a small team. A team of five such developers
          produces the parallel work of a department, and every one of those agents edits files without knowing what the
          others are doing.
        </p>
        <p>
          Each tool shows its own sessions well. None of them shows <em>your teammate&apos;s</em> agent rewriting the
          function your agent is rewriting. Git notices only when the second pull request arrives, which is often hours
          after both agents committed to incompatible designs.
        </p>
        <p>
          The cost is not the merge itself. It is the agent time spent building on a collision, and the human time
          spent untangling it.
        </p>
        <figure className="mt-8 border-y-[3px] border-double border-rule py-6 text-center">
          <p className="font-display text-6xl tabular-nums sm:text-7xl">
            5 <span className="text-brass">×</span> 3 <span className="text-brass">=</span>{" "}
            <span className="text-red">15</span>
          </p>
          <figcaption className="smallcaps mx-auto mt-2 max-w-md text-sm text-balance text-ink-2">
            developers × agents each = writers in one repository, none of whom can see the others
          </figcaption>
        </figure>
      </div>
      <ul className="flex flex-col gap-5">
        {quotes.map((x, i) => (
          <li
            key={x.q}
            className="bg-paper-2 px-5 py-4 shadow-[0_1px_0_var(--rule),0_8px_18px_-12px_oklch(25%_0.04_258/0.35)] transition-transform duration-300 hover:rotate-0"
            style={{ transform: `rotate(${i % 2 ? 0.6 : -0.6}deg)` }}
          >
            <p className="flex justify-between border-b border-dashed border-rule pb-1.5 font-mono text-[10.5px] tracking-widest text-ink-3 uppercase">
              <span>Telegram · No. {String(i + 1).padStart(3, "0")}</span>
              <span>Received</span>
            </p>
            <p className="mt-2.5 font-display text-xl italic leading-snug">“{x.q}”</p>
            <p className="mt-1.5 text-sm text-ink-3">— {x.who}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WhyNotGitHub() {
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="max-w-[36rem] space-y-4 text-lg">
        <p>
          GitHub reports a conflict when a pull request is compared with <span className="font-mono text-base">main</span>.
          It does not compare two branches that are both still open, it cannot see work that is not pushed, and it
          cannot tell an agent anything before the agent edits.
        </p>
        <p>
          Overlap uses your git remote only as a pipe: each laptop pushes a snapshot of work in progress to hidden refs
          every minute. People look at the room, and agents ask the room. GitHub stays where you review and merge.
        </p>
        <p className="text-ink-2 italic">
          If your team merges small pull requests every hour, GitHub already catches most of this early. Overlap is for
          teams whose agents run for hours on parallel branches.
        </p>
      </div>
      <Timeline />
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { t: "Agents report", d: "A small hook in Claude Code, Codex or Cursor sends each step: task, files read, lines about to change. Tools without hooks are covered by a git file watcher." },
    { t: "The daemon maps lines to a shared base", d: "On each laptop, edits are mapped to line ranges in origin/main and to the enclosing function, so two people's line numbers mean the same code." },
    { t: "The room compares", d: "The room service holds members, presence and short leases. It sees paths, ranges and symbols only. Code never leaves your git remote." },
    { t: "Agents are told, people are shown", d: "Before an edit, an agent calls who_is_touching() and gets typed data back, never free text. Teammates see amber or red, and can open the conflict markers on demand." },
  ];
  return (
    <div className="flex flex-col gap-10">
      <FlowDiagram />
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.t} className="min-w-0">
            <p className="font-display text-3xl text-brass">{i + 1}</p>
            <p className="mt-1 font-display text-xl">{s.t}</p>
            <p className="mt-2 text-base text-ink-2">{s.d}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Precedent() {
  return (
    <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <figure className="min-w-0 rounded-card bg-paper-2 p-4 shadow-hairline">
        <SingleLineEngraving />
        <figcaption className="mt-2 text-center text-sm italic text-ink-2">
          Fig. 1. A single-line section. The train that holds the token may enter; the other waits or takes the loop.
        </figcaption>
      </figure>
      <div className="max-w-[34rem] space-y-4 text-lg">
        <p>
          On single-track railways, two trains could not share a section of line. In 1878 Edward Tyer patented the
          electric train tablet: a section could release only one tablet at a time, and a driver could not enter
          without holding it.
        </p>
        <p>
          Overlap&apos;s lease is the same idea for code. An agent that is about to change{" "}
          <span className="font-mono text-base">auth/session.ts</span> lines 40 to 88 takes a short lease. A second agent
          that asks for the same lines is told to wait, or to take another route. Leases expire on their own, so a
          crashed laptop never blocks the line.
        </p>
      </div>
    </div>
  );
}

function Market() {
  const yes = <span className="text-green">●</span>;
  const part = <span className="text-orange">◐</span>;
  const no = <span className="text-ink-3">○</span>;
  const rows: { name: string; what: string; cells: ReactNode[] }[] = [
    { name: "LoopBar, Iris, Claude HUD", what: "Your own agents, on your Mac", cells: [no, yes, no, no] },
    { name: "GitKraken Team View", what: "Teammates' branches and changed files", cells: [yes, part, part, no] },
    { name: "GitHub Agent HQ", what: "Mission control for agents run on GitHub", cells: [part, part, no, no] },
    { name: "Claude Code Agent Teams", what: "One person's Claude agents, with file locks", cells: [no, no, yes, yes] },
    { name: "Overlap", what: "Every teammate's agents, every tool", cells: [yes, yes, yes, yes] },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="smallcaps border-b-2 border-ink text-sm text-ink-2">
              <th className="py-2 pr-4 font-normal">Product</th>
              <th className="py-2 pr-4 font-normal">Teammates</th>
              <th className="py-2 pr-4 font-normal">Across tools</th>
              <th className="py-2 pr-4 font-normal">Before merge</th>
              <th className="py-2 font-normal">Tells the agent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.name}
                className={`border-b border-rule ${r.name === "Overlap" ? "bg-paper-2 shadow-[inset_4px_0_0_var(--red)]" : ""}`}
              >
                <td className={`py-3 pr-4 ${r.name === "Overlap" ? "pl-4" : ""}`}>
                  <p className={r.name === "Overlap" ? "font-display text-2xl text-red" : "font-semibold"}>{r.name}</p>
                  <p className="text-sm text-ink-3">{r.what}</p>
                </td>
                {r.cells.map((c, i) => (
                  <td key={i} className="py-3 pr-4 text-xl">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="max-w-[44rem] text-ink-2">
        <span className="text-green">●</span> yes · <span className="text-orange">◐</span> partly · <span className="text-ink-3">○</span> no.
        Novelty is in the combination, not in any single part, and platform owners can close the gap. We rate the window
        at six to twelve months, which is why the plan below starts with proof, not polish.
      </p>
    </div>
  );
}

function Plan() {
  const phases = [
    {
      when: "Weeks 1–2",
      title: "Prove the pain",
      items: [
        "Interview 10 teams of three or more who each run agents",
        "Count conflicted merges and reverted PRs in their git history, split by same-person and cross-person",
        "Inject a fake “file held” warning into 30 real Claude Code tasks and measure how often the agent changes plan",
      ],
    },
    {
      when: "Weeks 3–6",
      title: "Build the room",
      items: [
        "Rooms: create, invite, connect your agents",
        "The overlap daemon and git snapshot refs",
        "Claude Code hook with advisory pre-edit warnings, then Codex and Cursor",
        "A web view of the room with on-demand conflict markers",
      ],
    },
    {
      when: "After five paying teams",
      title: "Bring it to the desktop",
      items: [
        "macOS menu bar and floating panel, with a summary widget",
        "Leases that can block on chosen paths",
        "Cloud agents through their branches and pull requests",
      ],
    },
  ];
  return (
    <div className="flex flex-col gap-12">
      <ol className="relative grid gap-8 md:grid-cols-3">
        <span
          className="absolute top-[7px] right-0 left-0 hidden h-3 md:block"
          style={{
            backgroundImage:
              "linear-gradient(var(--ink), var(--ink)), linear-gradient(var(--ink), var(--ink)), repeating-linear-gradient(90deg, var(--rule) 0 2px, transparent 2px 14px)",
            backgroundSize: "100% 1.5px, 100% 1.5px, 100% 100%",
            backgroundPosition: "0 2px, 0 9px, 0 0",
            backgroundRepeat: "no-repeat, no-repeat, repeat",
          }}
          aria-hidden
        />
        {phases.map((p, i) => (
          <li key={p.title} className="relative min-w-0 pt-9">
            <span
              className="absolute top-0 left-0 flex size-[26px] items-center justify-center rounded-full border-2 border-ink bg-paper font-display text-sm"
              aria-hidden
            >
              {i + 1}
            </span>
            <p className="smallcaps text-sm text-brass">{p.when}</p>
            <p className="mt-1 font-display text-2xl">{p.title}</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base text-ink-2">
              {p.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <div className="relative border-[3px] border-double border-ink bg-paper-2 p-6 sm:p-8">
        <div className="absolute -top-4 right-6">
          <Stamp>Kill switch</Stamp>
        </div>
        <p className="text-center font-display text-3xl">Public Notice</p>
        <p className="smallcaps mt-1 mb-5 text-center text-red">We stop if, after 60 days with five design-partner teams</p>
        <ul className="mt-3 grid gap-4 sm:grid-cols-3">
          <Criterion big="< 30%" text="fewer conflicted merges than their own baseline" />
          <Criterion big="> 1 in 5" text="red warnings that were not real conflicts" />
          <Criterion big="< 3 of 5" text="teams still using the room every week" />
        </ul>
        <p className="mt-6 border-t border-dashed border-rule pt-4 text-center text-base text-ink-2">
          Price while we learn: one flat fee per team, $49–99 a month, for teams of 3 to 15.
        </p>
      </div>
    </div>
  );
}

function Criterion({ big, text }: { big: string; text: string }) {
  return (
    <li>
      <p className="font-display text-4xl tabular-nums">{big}</p>
      <p className="text-base text-ink-2">{text}</p>
    </li>
  );
}

function Footer() {
  return (
    <footer className="rule-double mt-8 flex flex-wrap items-center justify-between gap-4 py-8 text-sm text-ink-3">
      <p>Overlap · a working proposal, October 2026</p>
      <p>
        Agent components from{" "}
        <a href="https://beautifului.dev" className="underline decoration-rule underline-offset-2 hover:text-ink">
          Beautiful UI
        </a>{" "}
        (MIT). The room replay is a simulation, not live data.
      </p>
    </footer>
  );
}
