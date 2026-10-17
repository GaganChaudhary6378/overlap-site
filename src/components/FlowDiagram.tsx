type Node = { x: number; y: number; w: number; h: number; title: string; sub: string; tone?: string };

const NODES: Record<string, Node> = {
  claude: { x: 10, y: 30, w: 150, h: 52, title: "Claude Code", sub: "hooks + MCP" },
  codex: { x: 10, y: 134, w: 150, h: 52, title: "Codex", sub: "hooks + OTel" },
  cursor: { x: 10, y: 232, w: 150, h: 64, title: "Cursor · any tool", sub: "hooks, or the git file watcher" },
  daemon: { x: 250, y: 118, w: 190, h: 84, title: "overlap daemon", sub: "on each laptop · hunks vs origin/main · symbols", tone: "var(--accent)" },
  room: { x: 530, y: 40, w: 190, h: 70, title: "Room service", sub: "members · presence · leases · metadata only", tone: "var(--brass)" },
  git: { x: 530, y: 210, w: 190, h: 70, title: "Your git remote", sub: "refs/overlap/* · your code stays here" },
  team: { x: 790, y: 118, w: 150, h: 84, title: "Teammates", sub: "room view · agent warnings · markers", tone: "var(--green)" },
};

const EDGES: { from: string; to: string; label?: string; color?: string; dur: number }[] = [
  { from: "claude", to: "daemon", dur: 1.6 },
  { from: "codex", to: "daemon", dur: 1.9 },
  { from: "cursor", to: "daemon", dur: 2.2 },
  { from: "daemon", to: "room", label: "who · file · lines", color: "var(--brass)", dur: 1.4 },
  { from: "daemon", to: "git", label: "WIP snapshot / 60 s", dur: 2.6 },
  { from: "room", to: "team", label: "live", color: "var(--green)", dur: 1.2 },
  { from: "git", to: "team", label: "on demand", dur: 2.4 },
];

function anchor(n: Node, side: "l" | "r") {
  return { x: side === "l" ? n.x : n.x + n.w, y: n.y + n.h / 2 };
}

export default function FlowDiagram() {
  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 960 320" className="min-w-[720px] w-full" role="img" aria-label="How Overlap moves agent activity between teammates">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--ink-2)" />
          </marker>
        </defs>

        {EDGES.map((e) => {
          const a = anchor(NODES[e.from], "r");
          const b = anchor(NODES[e.to], "l");
          const mx = (a.x + b.x) / 2;
          const d = `M${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x - 2} ${b.y}`;
          return (
            <g key={`${e.from}-${e.to}`}>
              <path d={d} fill="none" stroke="var(--rule)" strokeWidth="1.2" markerEnd="url(#arrow)" />
              <path
                d={d}
                fill="none"
                stroke={e.color ?? "var(--accent)"}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeDasharray="4 36"
                style={{ animation: `dash-flow ${e.dur}s linear infinite` }}
              />
              {e.label && (
                <text
                  x={mx}
                  y={(a.y + b.y) / 2 + 4}
                  textAnchor="middle"
                  fontSize="12.5"
                  fill="var(--ink-2)"
                  fontStyle="italic"
                  fontFamily="var(--font-serif)"
                  stroke="var(--paper)"
                  strokeWidth="5"
                  paintOrder="stroke"
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}

        {Object.entries(NODES).map(([k, n]) => (
          <g key={k}>
            <rect x={n.x + 3} y={n.y + 3} width={n.w} height={n.h} fill="var(--rule)" opacity="0.35" />
            <rect x={n.x} y={n.y} width={n.w} height={n.h} fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.2" />
            {n.tone && <rect x={n.x} y={n.y} width="5" height={n.h} fill={n.tone} />}
            <text x={n.x + 14} y={n.y + 22} fontSize="17" fill="var(--ink)" fontFamily="var(--font-display)">
              {n.title}
            </text>
            <foreignObject x={n.x + 14} y={n.y + 28} width={n.w - 20} height={n.h - 30}>
              <p style={{ fontSize: 11.5, lineHeight: 1.3, color: "var(--ink-2)", fontFamily: "var(--font-mono)", margin: 0 }}>{n.sub}</p>
            </foreignObject>
          </g>
        ))}
      </svg>
    </div>
  );
}
