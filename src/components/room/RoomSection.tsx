"use client";

import { useState } from "react";
import { Signal } from "@/components/Signal";
import LiveRoom from "./LiveRoom";
import type { RoomStatus } from "./script";

export default function RoomSection() {
  const [status, setStatus] = useState<RoomStatus>("clear");
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_200px]">
      <LiveRoom onStatusChange={setStatus} />
      <aside className="sticky top-8 hidden flex-col items-center gap-4 lg:flex">
        <Signal state={status} size={240} />
        <p className="text-center text-[0.95rem] italic leading-snug text-ink-2">
          The signal follows the room. It drops to <em>clear</em> only when no two agents hold the same lines.
        </p>
      </aside>
    </div>
  );
}
