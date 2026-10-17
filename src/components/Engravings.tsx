/* Line illustrations in the manner of a 19th-century railway manual. */

function Loco({ x, y, flip = false, label }: { x: number; y: number; flip?: boolean; label: string }) {
  return (
    <g transform={`translate(${x} ${y}) ${flip ? "scale(-1 1)" : ""}`}>
      <rect x="0" y="-22" width="54" height="18" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.3" />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M${4 + i * 6} -20 v14`} stroke="var(--ink-3)" strokeWidth="0.6" />
      ))}
      <rect x="40" y="-34" width="14" height="12" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.3" />
      <rect x="8" y="-32" width="6" height="10" fill="var(--ink)" />
      <path d="M54 -6 l8 4 h-8 z" fill="var(--ink)" />
      {[10, 26, 44].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="0" r="6" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.3" />
          <circle cx={cx} cy="0" r="1.4" fill="var(--ink)" />
        </g>
      ))}
      <text
        x="27"
        y="-42"
        transform={flip ? "scale(-1 1) translate(-54 0)" : undefined}
        textAnchor="middle"
        fontSize="9"
        fill="var(--ink-2)"
        fontFamily="var(--font-mono)"
      >
        {label}
      </text>
    </g>
  );
}

export function SingleLineEngraving() {
  return (
    <svg viewBox="0 0 520 190" className="w-full max-w-full" role="img" aria-label="Two trains approach a single-line section; only the holder of the token may enter.">
      {/* double track to single line to double track */}
      <g stroke="var(--ink)" strokeWidth="1.4" fill="none">
        <path d="M0 70 H120 C150 70 160 100 190 100 H330 C360 100 370 70 400 70 H520" />
        <path d="M0 130 H120 C150 130 160 100 190 100" />
        <path d="M330 100 C360 100 370 130 400 130 H520" />
      </g>
      {/* sleepers along the single line */}
      {Array.from({ length: 15 }, (_, i) => (
        <path key={i} d={`M${196 + i * 9} 94 v12`} stroke="var(--ink-3)" strokeWidth="1" />
      ))}
      <rect x="190" y="84" width="140" height="32" fill="none" stroke="var(--red)" strokeDasharray="3 3" />
      <text x="260" y="78" textAnchor="middle" fontSize="12" fontStyle="italic" fill="var(--red)" fontFamily="var(--font-serif)">
        single line · auth/session.ts L40–88
      </text>

      <Loco x={40} y={70} label="Claude Code" />
      <Loco x={480} y={130} flip label="Codex" />

      {/* the token */}
      <g transform="translate(118 30)">
        <circle r="18" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.4" />
        <circle r="13" fill="none" stroke="var(--brass)" strokeWidth="1.2" />
        <text y="3" textAnchor="middle" fontSize="7.5" fill="var(--ink)" fontFamily="var(--font-display)">LEASE</text>
        <path d="M14 14 L36 46" stroke="var(--ink-3)" strokeDasharray="2 3" />
      </g>
      <text x="152" y="22" fontSize="11" fill="var(--ink-2)" fontStyle="italic" fontFamily="var(--font-serif)">
        held by the train inside the section
      </text>

      {/* waiting signal for the second train */}
      <g transform="translate(384 158)">
        <path d="M0 0 V-58" stroke="var(--ink)" strokeWidth="2" />
        <rect x="0" y="-58" width="26" height="6" fill="var(--red)" stroke="var(--ink)" />
        <circle cx="0" cy="-44" r="3.2" fill="var(--red)" />
      </g>
      <text x="356" y="182" fontSize="11" fill="var(--ink-2)" fontStyle="italic" fontFamily="var(--font-serif)">
        waits at danger, or takes the loop
      </text>
    </svg>
  );
}
