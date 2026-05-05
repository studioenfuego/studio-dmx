"use client";

import { useCallback, useRef } from "react";
import { useDMXStore } from "@/lib/store";
import { sendWS } from "@/lib/wsClient";

export function GrandMasterFader() {
  const { grandMaster, setGrandMaster } = useDMXStore();
  const trackRef = useRef<HTMLDivElement>(null);

  const getValueFromEvent = useCallback((clientY: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height)) * 255);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const val = getValueFromEvent(e.clientY);
      setGrandMaster(val);
      sendWS({ type: "grand_master", value: val });

      const handleMove = (ev: MouseEvent) => {
        const v = getValueFromEvent(ev.clientY);
        setGrandMaster(v);
        sendWS({ type: "grand_master", value: v });
      };
      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [getValueFromEvent, setGrandMaster]
  );

  const pct = (grandMaster / 255) * 100;

  return (
    <div className="flex flex-col items-center gap-1.5 px-3 py-2 border-r border-border">
      <span className="text-[10px] font-semibold text-amber-400">GM</span>
      <span className="text-[10px] font-mono text-muted-foreground">
        {Math.round(pct)}%
      </span>
      <div
        ref={trackRef}
        className="relative rounded-full cursor-pointer"
        style={{ width: 18, height: 160, background: "oklch(0.18 0 0)" }}
        onMouseDown={handleMouseDown}
      >
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full"
          style={{
            height: `${pct}%`,
            background: grandMaster > 0 ? "oklch(0.75 0.15 80)" : "oklch(0.3 0 0)",
          }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-sm shadow-md"
          style={{
            width: 32,
            height: 14,
            bottom: `calc(${pct}% - 7px)`,
            background: "oklch(0.85 0 0)",
            cursor: "grab",
          }}
        />
      </div>
      <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">
        Master
      </span>
    </div>
  );
}
