"use client";

import { useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { FixtureInstanceData, ChannelDefinition } from "@/lib/types";

const SINGLE_COLOR_SWATCH: Record<string, string> = {
  amber: "rgb(255,140,0)",
  uv:    "rgb(90,0,210)",
  white: "rgb(255,255,255)",
  red:   "rgb(255,20,0)",
  green: "rgb(20,220,20)",
  blue:  "rgb(0,60,255)",
};

interface Props {
  fixture: FixtureInstanceData;
  channels: number[];
  isSoloed: boolean;
  isSelected: boolean;
  onDimmerChange: (value: number) => void;
  onToggle: () => void;
  onSolo: () => void;
  onSelect: () => void;
}

export function getFixtureActiveChannels(fixture: FixtureInstanceData): ChannelDefinition[] {
  if (!fixture.profile) return [];
  try {
    const modes = fixture.profile.modes;
    if (modes.length > fixture.modeIndex) {
      const mode = modes[fixture.modeIndex];
      return mode.channels.map((name: string) =>
        fixture.profile!.channels.find((c) => c.name === name) ?? {
          name,
          capability: "noFunction" as const,
        }
      );
    }
  } catch { /* */ }
  return fixture.profile.channels;
}

export function getCapabilityValue(
  fixture: FixtureInstanceData,
  channels: number[],
  fixtureChannels: ChannelDefinition[],
  capability: string
): number | null {
  const idx = fixtureChannels.findIndex((c) => c.capability === capability);
  if (idx < 0) return null;
  return channels[fixture.startAddress + idx - 1] ?? 0;
}

export function FixtureStrip({
  fixture,
  channels,
  isSoloed,
  isSelected,
  onDimmerChange,
  onToggle,
  onSolo,
  onSelect,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const lastNonZero = useRef(255);

  const fixtureChannels = useMemo(
    () => getFixtureActiveChannels(fixture),
    [fixture]
  );

  const dimmerIdx = fixtureChannels.findIndex((c) => c.capability === "dimmer");
  const dimmerValue =
    dimmerIdx >= 0 ? (channels[fixture.startAddress + dimmerIdx - 1] ?? 0) : null;

  const rIdx = fixtureChannels.findIndex((c) => c.capability === "red");
  const gIdx = fixtureChannels.findIndex((c) => c.capability === "green");
  const bIdx = fixtureChannels.findIndex((c) => c.capability === "blue");
  const wIdx = fixtureChannels.findIndex((c) => c.capability === "white");
  const aIdx = fixtureChannels.findIndex((c) => c.capability === "amber");

  const hasRGB = rIdx >= 0 && gIdx >= 0 && bIdx >= 0;
  const hasBiColor = !hasRGB && wIdx >= 0 && aIdx >= 0;

  const ch = (idx: number) => idx >= 0 ? (channels[fixture.startAddress + idx - 1] ?? 0) : 0;
  const rVal = ch(rIdx), gVal = ch(gIdx), bVal = ch(bIdx);
  const wVal = ch(wIdx), aVal = ch(aIdx);

  const masterLevel = dimmerValue ?? 0;
  const pct = (masterLevel / 255) * 100;

  if (masterLevel > 0) lastNonZero.current = masterLevel;

  // Swatch color — reflects the actual color the fixture is set to
  let swatchColor: string;
  if (hasRGB) {
    // RGB (optionally blended with white channel)
    swatchColor = `rgb(${Math.min(255, rVal + wVal)},${Math.min(255, gVal + wVal)},${Math.min(255, bVal + wVal)})`;
  } else if (hasBiColor) {
    // Bi-color: amber = warm ~3200K, white = cool ~5600K
    const total = wVal + aVal;
    if (total > 0) {
      const aR = aVal / total, wR = wVal / total;
      swatchColor = `rgb(${Math.round(255*aR+210*wR)},${Math.round(185*aR+225*wR)},${Math.round(120*aR+255*wR)})`;
    } else {
      swatchColor = "rgb(220,205,175)";
    }
  } else {
    // Single-color: pick the first known color capability as a fixed hue
    const colorCap = fixtureChannels.find((c) => c.capability in SINGLE_COLOR_SWATCH);
    swatchColor = colorCap ? SINGLE_COLOR_SWATCH[colorCap.capability] : "rgb(255,252,235)";
  }

  // Icon brightness: use dimmer when present; otherwise derive from color channels
  const effectiveIntensity = dimmerValue !== null
    ? dimmerValue
    : hasBiColor ? Math.max(wVal, aVal)
    : hasRGB    ? Math.max(rVal, gVal, bVal)
    : 0;
  const glowIntensity = effectiveIntensity / 255;

  const getValueFromEvent = useCallback((clientY: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.round(
      Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height)) * 255
    );
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (dimmerIdx < 0) return;
      onDimmerChange(getValueFromEvent(e.clientY));

      const handleMove = (ev: MouseEvent) =>
        onDimmerChange(getValueFromEvent(ev.clientY));
      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [dimmerIdx, getValueFromEvent, onDimmerChange]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (dimmerIdx < 0) return;
      const delta = e.deltaY > 0 ? -5 : 5;
      onDimmerChange(Math.max(0, Math.min(255, (dimmerValue ?? 0) + delta)));
    },
    [dimmerIdx, dimmerValue, onDimmerChange]
  );

  const handleToggle = useCallback(() => {
    if (dimmerIdx < 0) return;
    if ((dimmerValue ?? 0) > 0) {
      onDimmerChange(0);
    } else {
      onDimmerChange(lastNonZero.current);
    }
    onToggle();
  }, [dimmerIdx, dimmerValue, onDimmerChange, onToggle]);

  const isOn = (dimmerValue ?? 0) > 0;
  const noDimmer = dimmerIdx < 0;

  return (
    <div
      className={cn(
        "flex flex-col items-center h-full border-r border-border transition-colors shrink-0 select-none",
        isSelected ? "bg-accent/20 border-r-primary" : "bg-background",
        isSoloed && "bg-amber-950/30"
      )}
      style={{ width: 72 }}
    >
      <div
        className="w-full px-2 pt-2 pb-1 flex flex-col items-center gap-1 cursor-pointer"
        onClick={onSelect}
      >
        <div
          className="w-10 h-10 rounded-full border-2 transition-all shrink-0"
          style={{
            background: glowIntensity > 0.01
              ? swatchColor
              : hasRGB
                ? `rgb(${Math.round(rVal * 0.3)},${Math.round(gVal * 0.3)},${Math.round(bVal * 0.3)})`
                : "oklch(0.15 0 0)",
            borderColor: isSelected
              ? "white"
              : glowIntensity > 0.01
                ? swatchColor
                : "oklch(0.25 0 0)",
            boxShadow: glowIntensity > 0.01
              ? `0 0 ${Math.round(glowIntensity * 20)}px ${Math.round(glowIntensity * 10)}px ${swatchColor}55`
              : "none",
          }}
        />
        <span
          className="text-[10px] font-medium text-center leading-tight max-w-full px-0.5 truncate w-full text-center"
          title={fixture.name}
          style={{ color: isSelected ? "white" : "oklch(0.7 0 0)" }}
        >
          {fixture.name}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground">
          {fixture.startAddress}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full px-2 py-1 min-h-0">
        {noDimmer ? (
          <div className="text-[10px] text-muted-foreground text-center px-1">
            No dimmer channel
          </div>
        ) : (
          <>
            <span className="text-[10px] font-mono tabular-nums mb-1" style={{ color: isOn ? "white" : "oklch(0.45 0 0)" }}>
              {Math.round(pct)}%
            </span>

            <div
              ref={trackRef}
              className="relative rounded-full cursor-pointer"
              style={{
                width: 14,
                flexGrow: 1,
                maxHeight: 200,
                minHeight: 80,
                background: "oklch(0.12 0 0)",
              }}
              onMouseDown={handleMouseDown}
              onWheel={handleWheel}
            >
              <div
                className="absolute bottom-0 left-0 right-0 rounded-full transition-none"
                style={{
                  height: `${pct}%`,
                  background:
                    isOn
                      ? hasRGB
                        ? swatchColor
                        : "oklch(0.65 0.12 80)"
                      : "oklch(0.22 0 0)",
                }}
              />
              <div
                className="absolute left-1/2 -translate-x-1/2 rounded cursor-grab active:cursor-grabbing"
                style={{
                  width: 36,
                  height: 14,
                  bottom: `calc(${pct}% - 7px)`,
                  background: isOn ? "oklch(0.82 0 0)" : "oklch(0.38 0 0)",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
                  borderRadius: 3,
                }}
              />
            </div>
          </>
        )}
      </div>

      <div className="w-full px-1.5 pb-2 flex flex-col gap-1">
        <button
          onClick={handleToggle}
          disabled={noDimmer}
          className={cn(
            "w-full h-6 rounded text-[10px] font-bold tracking-wide transition-colors",
            isOn && !noDimmer
              ? "bg-white text-black"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
            noDimmer && "opacity-30 cursor-not-allowed"
          )}
        >
          {isOn ? "ON" : "OFF"}
        </button>

        <button
          onClick={onSolo}
          className={cn(
            "w-full h-6 rounded text-[10px] font-bold tracking-wide transition-colors",
            isSoloed
              ? "bg-amber-400 text-black"
              : "bg-muted text-muted-foreground hover:bg-amber-900/40 hover:text-amber-400"
          )}
        >
          SOLO
        </button>

        <button
          onClick={onSelect}
          className={cn(
            "w-full h-6 rounded text-[10px] font-bold tracking-wide transition-colors",
            isSelected
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          SEL
        </button>
      </div>
    </div>
  );
}
