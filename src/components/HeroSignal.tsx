"use client";

import { useEffect, useState } from "react";
import { Signal, type SignalState } from "@/components/Signal";

const CYCLE: { state: SignalState; ms: number }[] = [
  { state: "clear", ms: 2600 },
  { state: "caution", ms: 1800 },
  { state: "danger", ms: 2400 },
  { state: "caution", ms: 1600 },
];

export default function HeroSignal() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setI((v) => (v + 1) % CYCLE.length), CYCLE[i].ms);
    return () => clearTimeout(t);
  }, [i]);
  return <Signal state={CYCLE[i].state} size={260} />;
}
