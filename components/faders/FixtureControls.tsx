"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import { useDMXStore } from "@/lib/store";
import { sendWS } from "@/lib/wsClient";
import type { FixtureInstanceData, ChannelDefinition } from "@/lib/types";

const EFFECT_SLOTS = [
  { label: "Off", value: 0 },
  { label: "Slot 1", value: 8 },
  { label: "Slot 2", value: 24 },
  { label: "Slot 3", value: 40 },
  { label: "Slot 4", value: 56 },
  { label: "Slot 5", value: 72 },
  { label: "Slot 6", value: 88 },
  { label: "Slot 7", value: 104 },
  { label: "Slot 8", value: 120 },
  { label: "Slot 9", value: 136 },
  { label: "Slot 10", value: 152 },
  { label: "Slot 11", value: 168 },
  { label: "Slot 12", value: 184 },
  { label: "Slot 13", value: 200 },
  { label: "Slot 14", value: 216 },
  { label: "Slot 15", value: 232 },
];

interface Props {
  fixture: FixtureInstanceData;
}

export function FixtureControls({ fixture }: Props) {
  const { channels } = useDMXStore();

  const fixtureChannels: ChannelDefinition[] = useMemo(() => {
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
  }, [fixture]);

  const getChannelValue = (index: number) =>
    channels[fixture.startAddress + index - 1] ?? 0;

  const setCapability = (capability: string, value: number) => {
    const channelUpdates: Record<string, number> = {};
    fixtureChannels.forEach((ch, i) => {
      if (ch.capability === capability) {
        channelUpdates[fixture.startAddress + i] = value;
      }
    });
    if (Object.keys(channelUpdates).length > 0) {
      sendWS({ type: "set_channels", channels: channelUpdates });
    }
  };

  const rgbValue = useMemo(() => {
    const r = fixtureChannels.findIndex((c) => c.capability === "red");
    const g = fixtureChannels.findIndex((c) => c.capability === "green");
    const b = fixtureChannels.findIndex((c) => c.capability === "blue");
    if (r < 0 || g < 0 || b < 0) return null;
    return {
      r: getChannelValue(r),
      g: getChannelValue(g),
      b: getChannelValue(b),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, fixture.startAddress, fixtureChannels]);

  const storeHex = rgbValue
    ? `#${rgbValue.r.toString(16).padStart(2, "0")}${rgbValue.g.toString(16).padStart(2, "0")}${rgbValue.b.toString(16).padStart(2, "0")}`
    : "#000000";

  // Local color state prevents feedback loop: picker → WS → store → picker bounce
  const [pickerHex, setPickerHex] = useState(storeHex);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!isDragging.current) setPickerHex(storeHex);
  }, [storeHex]);

  const handleColorChange = (hex: string) => {
    isDragging.current = true;
    setPickerHex(hex);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // Send all three RGB channels in one message to avoid triple echo-flicker
    const updates: Record<string, number> = {};
    fixtureChannels.forEach((ch, i) => {
      if (ch.capability === "red") updates[fixture.startAddress + i] = r;
      else if (ch.capability === "green") updates[fixture.startAddress + i] = g;
      else if (ch.capability === "blue") updates[fixture.startAddress + i] = b;
    });
    if (Object.keys(updates).length > 0) sendWS({ type: "set_channels", channels: updates });
  };

  const handleColorDragEnd = () => {
    isDragging.current = false;
  };

  const hasCapability = (cap: string) =>
    fixtureChannels.some((c) => c.capability === cap);

  const dimmerIdx = fixtureChannels.findIndex((c) => c.capability === "dimmer");
  const dimmerValue = dimmerIdx >= 0 ? getChannelValue(dimmerIdx) : null;

  const panIdx = fixtureChannels.findIndex((c) => c.capability === "pan");
  const tiltIdx = fixtureChannels.findIndex((c) => c.capability === "tilt");
  const panValue = panIdx >= 0 ? getChannelValue(panIdx) : null;
  const tiltValue = tiltIdx >= 0 ? getChannelValue(tiltIdx) : null;

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground font-mono">
        Ch {fixture.startAddress}–{fixture.startAddress + fixtureChannels.length - 1}
        {fixture.profile && (
          <span className="ml-2 text-muted-foreground/60">
            {fixture.profile.manufacturer} {fixture.profile.name}
          </span>
        )}
      </div>

      {/* CCT — dedicated Kelvin channel (2700K–10000K) */}
      {hasCapability("cct") && (() => {
        const idx = fixtureChannels.findIndex((c) => c.capability === "cct");
        const val = idx >= 0 ? getChannelValue(idx) : 0;
        const kelvin = Math.round(2700 + (val / 255) * 7300);
        const thumbR = Math.round(255 - (val / 255) * 65);
        const thumbG = Math.round(167 + (val / 255) * 53);
        const thumbB = Math.round(87 + (val / 255) * 168);
        return (
          <div key="cct" className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Color Temp</label>
              <span className="text-xs font-mono text-muted-foreground">{kelvin}K</span>
            </div>
            <div className="relative h-5 rounded-full overflow-hidden"
              style={{ background: "linear-gradient(to right, rgb(255,167,87), rgb(255,210,140), rgb(255,248,235), rgb(200,225,255))" }}>
              <input
                type="range" min={0} max={255} value={val}
                onChange={(e) => setCapability("cct", parseInt(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none"
                style={{ left: `calc(${(val / 255) * 100}% - 6px)`, background: `rgb(${thumbR},${thumbG},${thumbB})` }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>2700K Warm</span>
              <span>10000K Cool</span>
            </div>
          </div>
        );
      })()}

      {/* Green Offset — per Litepanels DMX table:
           0–10 = neutral, 11–20 = M100, 21–119 = M99→M1,
           120–145 = neutral (default 133), 146–244 = G1→G99, 245–255 = G100 */}
      {hasCapability("greenOffset") && (() => {
        const idx = fixtureChannels.findIndex((c) => c.capability === "greenOffset");
        const val = idx >= 0 ? getChannelValue(idx) : 0;
        let offsetValue: number;
        if (val <= 10) offsetValue = 0;
        else if (val <= 20) offsetValue = -100;
        else if (val <= 119) offsetValue = Math.round(-99 + ((val - 21) / 98) * 98);
        else if (val <= 145) offsetValue = 0;
        else if (val <= 244) offsetValue = Math.round(1 + ((val - 146) / 98) * 98);
        else offsetValue = 100;
        const offsetLabel = offsetValue > 0 ? `G +${offsetValue}` : offsetValue < 0 ? `M ${Math.abs(offsetValue)}` : "0";
        const t = Math.abs(offsetValue) / 100;
        const thumbR = offsetValue <= 0 ? Math.round(180 + t * 40) : Math.round(180 - t * 140);
        const thumbG = offsetValue <= 0 ? Math.round(180 - t * 140) : Math.round(180 + t * 30);
        const thumbB = offsetValue <= 0 ? Math.round(180 + t * 40) : Math.round(180 - t * 140);
        return (
          <div key="greenOffset" className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Green Offset</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCapability("greenOffset", 133)}
                  className="text-[9px] text-muted-foreground/60 hover:text-muted-foreground border border-border/40 rounded px-1 py-0.5"
                >
                  reset
                </button>
                <span className="text-xs font-mono text-muted-foreground">{offsetLabel}</span>
              </div>
            </div>
            <div className="relative h-5 rounded-full overflow-hidden"
              style={{ background: "linear-gradient(to right, rgb(200,200,200) 4%, rgb(220,40,220) 8%, rgb(210,120,210) 47%, rgb(190,190,190) 52%, rgb(100,200,100) 58%, rgb(40,200,40) 96%, rgb(40,200,40))" }}>
              <input
                type="range" min={0} max={255} value={val}
                onChange={(e) => setCapability("greenOffset", parseInt(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none"
                style={{ left: `calc(${(val / 255) * 100}% - 6px)`, background: `rgb(${thumbR},${thumbG},${thumbB})` }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>M 100</span>
              <span>0</span>
              <span>G 100</span>
            </div>
          </div>
        );
      })()}

      {/* Cross-Fade: White ← → RGB */}
      {hasCapability("crossFade") && (() => {
        const idx = fixtureChannels.findIndex((c) => c.capability === "crossFade");
        const val = idx >= 0 ? getChannelValue(idx) : 0;
        const pct = Math.round((val / 255) * 100);
        return (
          <div key="crossFade" className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Color Mix</label>
              <span className="text-xs font-mono text-muted-foreground">
                {val === 0 ? "White" : val >= 255 ? "RGB" : `${pct}% RGB`}
              </span>
            </div>
            <input
              type="range" min={0} max={255} value={val}
              onChange={(e) => setCapability("crossFade", parseInt(e.target.value))}
              className="w-full accent-blue-400"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>← White</span>
              <span>RGB →</span>
            </div>
          </div>
        );
      })()}

      {hasCapability("red") && hasCapability("green") && hasCapability("blue") && (
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Color</label>
          <div onPointerUp={handleColorDragEnd} onPointerLeave={handleColorDragEnd}>
            <HexColorPicker color={pickerHex} onChange={handleColorChange} style={{ width: "100%", height: 180 }} />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-sm border border-border shrink-0" style={{ background: pickerHex }} />
            <input
              type="text"
              value={pickerHex}
              onChange={(e) => {
                if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) handleColorChange(e.target.value);
              }}
              className="flex-1 text-xs font-mono bg-muted border border-border rounded px-2 py-1 text-foreground"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "R", value: parseInt(pickerHex.slice(1, 3), 16) },
              { label: "G", value: parseInt(pickerHex.slice(3, 5), 16) },
              { label: "B", value: parseInt(pickerHex.slice(5, 7), 16) },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-[10px] text-muted-foreground">{label}</div>
                <div className="text-xs font-mono">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {panValue !== null && tiltValue !== null && (
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pan / Tilt</label>
          <div
            className="relative w-full bg-muted rounded cursor-crosshair border border-border"
            style={{ aspectRatio: "1" }}
            onMouseDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const updatePanTilt = (ev: MouseEvent | React.MouseEvent) => {
                const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                const y = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
                setCapability("pan", Math.round(x * 255));
                setCapability("tilt", Math.round(y * 255));
              };
              updatePanTilt(e);
              const move = (ev: MouseEvent) => updatePanTilt(ev);
              const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
              window.addEventListener("mousemove", move);
              window.addEventListener("mouseup", up);
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-full border-t border-border/30" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-full border-l border-border/30" />
            </div>
            <div
              className="absolute w-5 h-5 rounded-full bg-blue-400 border-2 border-white shadow-lg -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${(panValue / 255) * 100}%`, top: `${(tiltValue / 255) * 100}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted rounded p-2 text-center">
              <div className="text-[10px] text-muted-foreground">Pan</div>
              <div className="text-xs font-mono">{Math.round((panValue / 255) * 540 - 270)}°</div>
            </div>
            <div className="bg-muted rounded p-2 text-center">
              <div className="text-[10px] text-muted-foreground">Tilt</div>
              <div className="text-xs font-mono">{Math.round((tiltValue / 255) * 270 - 135)}°</div>
            </div>
          </div>
        </div>
      )}

      {/* Bi-color (warm + cool) — colour temperature crossfade */}
      {(() => {
        if (hasCapability("red")) return null; // RGB fixture; handle separately
        if (!hasCapability("white") || !hasCapability("amber")) return null;
        const wIdx = fixtureChannels.findIndex((c) => c.capability === "white");
        const aIdx = fixtureChannels.findIndex((c) => c.capability === "amber");
        const wVal = wIdx >= 0 ? getChannelValue(wIdx) : 0;
        const aVal = aIdx >= 0 ? getChannelValue(aIdx) : 0;
        const total = wVal + aVal;
        // ct slider: 0 = full warm (amber), 255 = full cool (white)
        const ct = total > 0 ? Math.round((wVal / total) * 255) : 128;
        const kelvin = Math.round(3200 + (ct / 255) * 2400);
        return (
          <div key="ct" className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Color Temp</label>
              <span className="text-xs font-mono text-muted-foreground">{kelvin}K</span>
            </div>
            <div className="relative h-5 rounded-full overflow-hidden"
              style={{ background: "linear-gradient(to right, rgb(255,185,120), rgb(255,245,230), rgb(210,225,255))" }}>
              <input
                type="range"
                min={0}
                max={255}
                value={ct}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  const updates: Record<string, number> = {};
                  fixtureChannels.forEach((ch, i) => {
                    if (ch.capability === "amber") updates[fixture.startAddress + i] = Math.round((1 - v / 255) * 255);
                    if (ch.capability === "white") updates[fixture.startAddress + i] = Math.round((v / 255) * 255);
                  });
                  if (Object.keys(updates).length) sendWS({ type: "set_channels", channels: updates });
                }}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
              {/* thumb indicator */}
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none"
                style={{ left: `calc(${(ct / 255) * 100}% - 6px)`, background: `rgb(${Math.round(255 - ct * 0.18)},${Math.round(185 + ct * 0.16)},${Math.round(120 + ct * 0.53)})` }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>3200K Warm</span>
              <span>5600K Cool</span>
            </div>
          </div>
        );
      })()}

      {["dimmer", "white", "amber", "uv", "strobe", "zoom", "focus", "iris", "frost", "speed"].map((cap) => {
        if (!hasCapability(cap)) return null;
        // Skip white/amber when they are handled by the CT control above
        if ((cap === "white" || cap === "amber") && !hasCapability("red") && hasCapability("white") && hasCapability("amber")) return null;
        const idx = fixtureChannels.findIndex((c) => c.capability === cap);
        const val = idx >= 0 ? getChannelValue(idx) : 0;
        const LABELS: Record<string, string> = { uv: "UV", white: "White", amber: "Amber" };
        return (
          <div key={cap} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider capitalize">{LABELS[cap] ?? cap}</label>
              <span className="text-xs font-mono text-muted-foreground">{val}</span>
            </div>
            <input
              type="range"
              min={0}
              max={255}
              value={val}
              onChange={(e) => setCapability(cap, parseInt(e.target.value))}
              className="w-full accent-blue-400"
            />
          </div>
        );
      })}

      {/* Fan Control */}
      {hasCapability("fan") && (() => {
        const FAN_MODES = [
          { label: "Auto",    value: 0,   desc: "Full power" },
          { label: "Delayed", value: 64,  desc: "Hi-temp" },
          { label: "Max",     value: 128, desc: "50% power" },
          { label: "Off",     value: 192, desc: "Disabled" },
        ] as const;
        const idx = fixtureChannels.findIndex((c) => c.capability === "fan");
        const val = idx >= 0 ? getChannelValue(idx) : 0;
        const active = [...FAN_MODES].reverse().find((m) => val >= m.value) ?? FAN_MODES[0];
        return (
          <div key="fan" className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fan</label>
              <span className="text-xs font-mono text-muted-foreground">{active.desc}</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {FAN_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setCapability("fan", mode.value)}
                  className={`px-1 py-1.5 text-[10px] rounded border transition-colors ${
                    active.value === mode.value
                      ? "bg-blue-500 border-blue-400 text-white"
                      : "bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {["effects", "program"].map((cap) => {
        if (!hasCapability(cap)) return null;
        const idx = fixtureChannels.findIndex((c) => c.capability === cap);
        const val = idx >= 0 ? getChannelValue(idx) : 0;
        const activeSlot = [...EFFECT_SLOTS].reverse().find((s) => val >= s.value) ?? EFFECT_SLOTS[0];
        return (
          <div key={cap} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider capitalize">{cap}</label>
              <span className="text-xs font-mono text-muted-foreground">{activeSlot.label} ({val})</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {EFFECT_SLOTS.map((slot) => (
                <button
                  key={slot.value}
                  onClick={() => setCapability(cap, slot.value)}
                  className={`px-1 py-1.5 text-[10px] rounded border transition-colors ${
                    activeSlot.value === slot.value
                      ? "bg-blue-500 border-blue-400 text-white"
                      : "bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {fixtureChannels.filter((c) => c.capability === "noFunction").length > 0 && (
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Raw Channels</label>
          {fixtureChannels.map((ch, i) => {
            if (ch.capability !== "noFunction") return null;
            const chNum = fixture.startAddress + i;
            const val = channels[chNum - 1] ?? 0;
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-mono w-24 shrink-0 truncate">{ch.name}</span>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={val}
                  onChange={(e) => {
                    sendWS({ type: "set_channels", channels: { [chNum]: parseInt(e.target.value) } });
                  }}
                  className="flex-1"
                />
                <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{val}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
