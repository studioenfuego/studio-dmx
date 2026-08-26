"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { PctInput } from "./PctInput";

interface Props {
  address: number;
  value: number;
  channelName: string;
  fixtureName: string;
  fixtureColor: string;
  onChange: (address: number, value: number) => void;
}

export function ChannelStrip({ address, value, channelName, fixtureName, fixtureColor, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  const getValueFromEvent = useCallback((clientY: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height)) * 255);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onChange(address, getValueFromEvent(e.clientY));
    const move = (ev: MouseEvent) => onChange(address, getValueFromEvent(ev.clientY));
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [address, getValueFromEvent, onChange]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    onChange(address, getValueFromEvent(e.touches[0].clientY));
    const move = (ev: TouchEvent) => { ev.preventDefault(); onChange(address, getValueFromEvent(ev.touches[0].clientY)); };
    const end = () => { window.removeEventListener("touchmove", move); window.removeEventListener("touchend", end); };
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
  }, [address, getValueFromEvent, onChange]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    onChange(address, Math.max(0, Math.min(255, value + (e.deltaY > 0 ? -5 : 5))));
  }, [address, value, onChange]);

  const pct = (value / 255) * 100;
  const isOn = value > 0;

  return (
    <div
      className="flex flex-col items-center h-full border-r border-border bg-background shrink-0 select-none"
      style={{ width: 72 }}
    >
      <div className="w-full px-2 pt-2 pb-1 flex flex-col items-center gap-1">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: fixtureColor }} />
        <span
          className="text-[9px] text-muted-foreground text-center leading-tight truncate w-full text-center"
          title={fixtureName}
        >
          {fixtureName}
        </span>
        <span
          className="text-[10px] font-medium text-center leading-tight truncate w-full text-center"
          title={channelName}
          style={{ color: isOn ? "white" : "oklch(0.7 0 0)" }}
        >
          {channelName}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground">{address}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full px-2 py-1 min-h-0">
        <PctInput
          pct={pct}
          onChange={(p) => onChange(address, Math.round(p / 100 * 255))}
          className="text-[10px] font-mono tabular-nums mb-1 text-center w-full"
          style={{ color: isOn ? "white" : "oklch(0.45 0 0)" }}
        />
        <div
          ref={trackRef}
          className="relative rounded-full cursor-pointer"
          style={{ width: 14, flexGrow: 1, maxHeight: 200, minHeight: 80, background: "oklch(0.12 0 0)", touchAction: "none" }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onWheel={handleWheel}
        >
          <div
            className="absolute bottom-0 left-0 right-0 rounded-full transition-none"
            style={{ height: `${pct}%`, background: isOn ? "oklch(0.65 0.12 80)" : "oklch(0.22 0 0)" }}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded cursor-grab active:cursor-grabbing"
            style={{
              width: 36, height: 14, bottom: `calc(${pct}% - 7px)`,
              background: isOn ? "oklch(0.82 0 0)" : "oklch(0.38 0 0)",
              boxShadow: "0 2px 4px rgba(0,0,0,0.5)", borderRadius: 3,
            }}
          />
        </div>
      </div>

      <div className="w-full px-1.5 pb-2">
        <button
          onClick={() => onChange(address, isOn ? 0 : 255)}
          className={cn(
            "w-full h-6 rounded text-[10px] font-bold tracking-wide transition-colors",
            isOn ? "bg-white text-black" : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {isOn ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}
