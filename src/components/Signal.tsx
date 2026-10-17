export type SignalState = "clear" | "caution" | "danger";

const ARM_ANGLE: Record<SignalState, number> = {
  danger: 0, // horizontal arm = stop
  caution: 22,
  clear: 45, // lower-quadrant: arm dropped = line clear
};

const LAMP: Record<SignalState, string> = {
  clear: "var(--green)",
  caution: "var(--orange)",
  danger: "var(--red)",
};

/**
 * A lower-quadrant railway semaphore, drawn like a period engraving.
 * The arm and lamp follow the room's overlap state.
 */
export function Signal({ state, size = 220, label = true }: { state: SignalState; size?: number; label?: boolean }) {
  const angle = ARM_ANGLE[state];
  return (
    <figure className="flex flex-col items-center gap-2" aria-label={`Signal at ${state}`}>
      <svg width={size * 0.62} height={size} viewBox="0 0 124 200" role="img" className="max-w-full overflow-visible">
        {/* ground and ballast */}
        <path d="M10 194 H114" stroke="var(--ink)" strokeWidth="1.2" />
        {[16, 28, 40, 52, 64, 76, 88, 100].map((x) => (
          <path key={x} d={`M${x} 194 l6 4`} stroke="var(--ink-3)" strokeWidth="0.8" />
        ))}
        {/* post with hatching */}
        <rect x="56" y="30" width="8" height="164" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.2" />
        {Array.from({ length: 26 }, (_, i) => (
          <path key={i} d={`M57 ${36 + i * 6} l6 -4`} stroke="var(--ink-3)" strokeWidth="0.6" />
        ))}
        {/* finial */}
        <path d="M54 30 h12 l-6 -12 z" fill="var(--ink)" />
        <circle cx="60" cy="16" r="3" fill="var(--ink)" />
        {/* ladder */}
        <path d="M70 70 V194 M78 70 V194" stroke="var(--ink-2)" strokeWidth="0.9" />
        {Array.from({ length: 15 }, (_, i) => (
          <path key={i} d={`M70 ${76 + i * 8} H78`} stroke="var(--ink-2)" strokeWidth="0.9" />
        ))}
        {/* lamp */}
        <circle cx="60" cy="86" r="9" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.2" />
        <circle
          cx="60"
          cy="86"
          r="5.5"
          fill={LAMP[state]}
          style={{
            transition: "fill 500ms ease",
            filter: `drop-shadow(0 0 6px ${LAMP[state]})`,
          }}
        />
        {/* arm, pivoting at the post */}
        <g
          style={{
            transformOrigin: "60px 50px",
            transform: `rotate(${angle}deg)`,
            transition: "transform 900ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <rect x="60" y="45" width="56" height="10" fill="var(--red)" stroke="var(--ink)" strokeWidth="1.2" />
          <rect x="98" y="45" width="8" height="10" fill="var(--paper)" stroke="var(--ink)" strokeWidth="0.8" />
          <circle cx="60" cy="50" r="3.2" fill="var(--ink)" />
        </g>
      </svg>
      {label && (
        <figcaption className="smallcaps text-sm text-ink-2">
          {state === "clear" && "Line clear"}
          {state === "caution" && "Caution · lease requested"}
          {state === "danger" && "Danger · same lines"}
        </figcaption>
      )}
    </figure>
  );
}
