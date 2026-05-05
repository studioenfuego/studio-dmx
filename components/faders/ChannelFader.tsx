"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface Props {
  channel: number;
  value: number;
  label?: string;
  color?: string;
  onChange: (channel: number, value: number) => void;
}

export function ChannelFader({ channel, value, label, color, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const getValueFromEvent = useCallback((clientY: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const relative = 1 - (clientY - rect.top) / rect.height;
    return Math.round(Math.max(0, Math.min(1, relative)) * 255);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      onChange(channel, getValueFromEvent(e.clientY));

      const handleMove = (ev: MouseEvent) => {
        if (dragging.current) onChange(channel, getValueFromEvent(ev.clientY));
      };
      const handleUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [channel, getValueFromEvent, onChange]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -5 : 5;
      onChange(channel, Math.max(0, Math.min(255, value + delta)));
    },
    [channel, value, onChange]
  );

  const fillPct = (value / 255) * 100;
  const displayVal = Math.round((value / 255) * 100);

  return (
    <div className="flex flex-col items-center gap-1 select-none" style={{ width: 44 }}>
      <span className="text-[9px] font-mono text-muted-foreground tabular-nums">
        {displayVal}%
      </span>
      <div
        ref={trackRef}
        className="relative rounded-full cursor-pointer"
        style={{
          width: 14,
          height: 120,
          background: "oklch(0.18 0 0)",
        }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full transition-none"
          style={{
            height: `${fillPct}%`,
            background: color
              ? color
              : value > 0
              ? "oklch(0.65 0.15 260)"
              : "oklch(0.3 0 0)",
          }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-sm shadow-md"
          style={{
            width: 28,
            height: 12,
            bottom: `calc(${fillPct}% - 6px)`,
            background: "oklch(0.72 0 0)",
            cursor: "grab",
          }}
        />
      </div>
      <span
        className={cn(
          "text-[8px] font-mono tabular-nums truncate w-full text-center",
          value > 0 ? "text-foreground" : "text-muted-foreground"
        )}
        title={label ?? `Ch ${channel}`}
      >
        {label ? label.slice(0, 5) : channel}
      </span>
    </div>
  );
}
