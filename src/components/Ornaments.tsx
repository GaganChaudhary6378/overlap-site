/* Print ornaments: fleuron rules, plate corners, telegraph tape, rubber stamp. */

export function FleuronRule({ glyph = "❦" }: { glyph?: string }) {
  return (
    <div className="flex items-center gap-4 text-brass" aria-hidden>
      <span className="h-px flex-1 bg-rule" />
      <span className="h-px w-8 bg-rule" />
      <span className="font-display text-2xl leading-none">{glyph}</span>
      <span className="h-px w-8 bg-rule" />
      <span className="h-px flex-1 bg-rule" />
    </div>
  );
}

function Corner({ className }: { className: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className={`absolute text-brass ${className}`} aria-hidden>
      <path d="M2 26 V2 H26" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 26 V6 H26" fill="none" stroke="currentColor" strokeWidth="0.6" />
      <circle cx="6" cy="6" r="2" fill="currentColor" />
    </svg>
  );
}

/** An engraved plate: double rule border with ornamental corners. */
export function Plate({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative border border-rule p-2 ${className}`}>
      <div className="relative border border-rule/60 bg-paper-2/60 px-6 py-8">
        <Corner className="top-1 left-1" />
        <Corner className="top-1 right-1 rotate-90" />
        <Corner className="right-1 bottom-1 rotate-180" />
        <Corner className="bottom-1 left-1 -rotate-90" />
        {children}
      </div>
    </div>
  );
}

const TAPE = [
  "GAGAN·CLAUDE LEASED auth/session.ts L40–88",
  "PRIYA·CODEX PRE-EDIT CHECK L52–70",
  "OVERLAP · SAME LINES · AGENT TOLD BEFORE WRITE",
  "PRIYA·CODEX REROUTED TO config/session.ts",
  "RAHUL·CURSOR OPENED PR #418 · NO OVERLAP",
  "LEASE RELEASED · LINE CLEAR",
];

/** Telegraph tape that scrolls the room's dispatches. */
export function TickerTape() {
  const items = [...TAPE, ...TAPE];
  return (
    <div className="relative overflow-hidden border-y border-rule bg-paper-2/70 py-1.5" aria-label="Latest room dispatches">
      <div className="flex w-max gap-10 font-mono text-[11.5px] tracking-wider text-ink-2" style={{ animation: "ticker 38s linear infinite" }}>
        {items.map((t, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap">
            <span className={t.startsWith("OVERLAP") ? "text-red" : undefined}>{t}</span>
            <span className="text-brass">✦</span>
          </span>
        ))}
      </div>
      <span className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-paper to-transparent" />
      <span className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-paper to-transparent" />
    </div>
  );
}

/** A rotated rubber stamp. */
export function Stamp({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block -rotate-6 rounded-sm border-[3px] border-double border-red px-3 py-1 font-display text-2xl tracking-[0.18em] text-red uppercase opacity-85"
      aria-hidden
    >
      {children}
    </span>
  );
}
