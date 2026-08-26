"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PctInput } from "./PctInput";
import type { GroupData } from "@/lib/types";

interface Props {
  group: GroupData;
  isSelected: boolean;
  onLevelChange: (groupId: string, level: number) => void;
  onLevelCommit: (groupId: string, level: number) => void;
  onSelect: () => void;
}

export function GroupFader({
  group,
  isSelected,
  onLevelChange,
  onLevelCommit,
  onSelect,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const commitLevel = useRef(group.level);

  const getValueFromEvent = useCallback((clientY: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height)) * 255);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const val = getValueFromEvent(e.clientY);
      onLevelChange(group.id, val);
      commitLevel.current = val;

      const handleMove = (ev: MouseEvent) => {
        const v = getValueFromEvent(ev.clientY);
        onLevelChange(group.id, v);
        commitLevel.current = v;
      };
      const handleUp = () => {
        onLevelCommit(group.id, commitLevel.current);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [group.id, getValueFromEvent, onLevelChange, onLevelCommit]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const val = getValueFromEvent(e.touches[0].clientY);
      onLevelChange(group.id, val);
      commitLevel.current = val;

      const handleMove = (ev: TouchEvent) => {
        ev.preventDefault();
        const v = getValueFromEvent(ev.touches[0].clientY);
        onLevelChange(group.id, v);
        commitLevel.current = v;
      };
      const handleEnd = () => {
        onLevelCommit(group.id, commitLevel.current);
        window.removeEventListener("touchmove", handleMove);
        window.removeEventListener("touchend", handleEnd);
      };
      window.addEventListener("touchmove", handleMove, { passive: false });
      window.addEventListener("touchend", handleEnd);
    },
    [group.id, getValueFromEvent, onLevelChange, onLevelCommit]
  );

  const pct = (group.level / 255) * 100;
  const hasOverrides = Object.keys(group.overrides).length > 0;

  return (
    <div
      className={cn(
        "flex flex-col items-center h-full border-r border-border transition-colors shrink-0 select-none cursor-pointer",
        isSelected ? "bg-accent/20" : "bg-background hover:bg-accent/10"
      )}
      style={{ width: 64 }}
      onClick={onSelect}
    >
      <div className="w-full px-1.5 pt-2 pb-1 flex flex-col items-center gap-1">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: group.color }}
        />
        <span
          className="text-[10px] font-semibold text-center leading-tight w-full truncate px-0.5"
          style={{ color: isSelected ? "white" : group.color }}
          title={group.name}
        >
          {group.name}
        </span>
        <PctInput
          pct={pct}
          onChange={(p) => {
            const val = Math.round(p / 100 * 255);
            onLevelChange(group.id, val);
            onLevelCommit(group.id, val);
          }}
          className="text-[10px] font-mono text-center w-full text-muted-foreground"
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full px-2 py-1 min-h-0">
        <div
          ref={trackRef}
          className="relative rounded-full cursor-pointer"
          style={{
            width: 14,
            flexGrow: 1,
            maxHeight: 200,
            minHeight: 80,
            background: "oklch(0.12 0 0)",
            touchAction: "none",
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div
            className="absolute bottom-0 left-0 right-0 rounded-full transition-none"
            style={{
              height: `${pct}%`,
              background: group.level > 0 ? group.color : "oklch(0.22 0 0)",
            }}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded cursor-grab active:cursor-grabbing"
            style={{
              width: 32,
              height: 14,
              bottom: `calc(${pct}% - 7px)`,
              background: group.level > 0 ? "oklch(0.82 0 0)" : "oklch(0.38 0 0)",
              boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
              borderRadius: 3,
            }}
          />
        </div>
      </div>

      <div className="w-full px-1.5 pb-2 flex flex-col gap-1">
        {hasOverrides && (
          <div
            className="w-full h-1.5 rounded-full"
            style={{ background: group.color, opacity: 0.6 }}
            title="Has active overrides"
          />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className={cn(
            "w-full h-6 rounded text-[10px] font-bold tracking-wide transition-colors",
            isSelected
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          EDIT
        </button>
      </div>
    </div>
  );
}
