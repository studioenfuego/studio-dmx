"use client";

import { useState, useRef, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import { Trash2, X } from "lucide-react";
import type { FixtureInstanceData, GroupData, GroupOverrides } from "@/lib/types";

interface Props {
  group: GroupData;
  fixtures: FixtureInstanceData[];
  allGroups: GroupData[];
  onRename: (name: string) => Promise<void>;
  onOverrideChange: (overrides: GroupOverrides) => void;
  onToggleFixture: (fixtureId: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

const FAN_MODES = [
  { label: "Auto",    value: 0,   desc: "Full power" },
  { label: "Delayed", value: 64,  desc: "Hi-temp" },
  { label: "Max",     value: 128, desc: "50% power" },
  { label: "Off",     value: 192, desc: "Disabled" },
] as const;

export function GroupEditPanel({
  group,
  fixtures,
  allGroups,
  onRename,
  onOverrideChange,
  onToggleFixture,
  onDelete,
  onClose,
}: Props) {
  const colorEnabled = group.overrides.color !== undefined;
  const storeHex = group.overrides.color ?? "#ffffff";
  const [pickerHex, setPickerHex] = useState(storeHex);
  const isDragging = useRef(false);

  // Sync picker when override value changes externally (e.g. from a preset recall)
  useEffect(() => {
    if (!isDragging.current) setPickerHex(storeHex);
  }, [storeHex]);

  const setOv = (updates: Partial<GroupOverrides>) =>
    onOverrideChange({ ...group.overrides, ...updates });

  const delOv = (key: keyof GroupOverrides) => {
    const next = { ...group.overrides };
    delete next[key];
    onOverrideChange(next);
  };

  // CCT display helpers (identical to FixtureControls)
  const cctVal = group.overrides.cct ?? 128;
  const cctKelvin = Math.round(2700 + (cctVal / 255) * 7300);
  const cctThumbR = Math.round(255 - (cctVal / 255) * 65);
  const cctThumbG = Math.round(167 + (cctVal / 255) * 53);
  const cctThumbB = Math.round(87 + (cctVal / 255) * 168);

  // Green offset display helpers (standard linear mapping, same as greenOffsetLinear)
  const gmVal = group.overrides.greenOffset ?? 128;
  const gmOffset = Math.max(-100, Math.min(100, Math.round((gmVal - 128) / 1.27)));
  const gmLabel = gmOffset > 0 ? `G +${gmOffset}` : gmOffset < 0 ? `M ${Math.abs(gmOffset)}` : "0";
  const gmT = Math.abs(gmOffset) / 100;
  const gmThumbR = gmOffset <= 0 ? Math.round(180 + gmT * 40) : Math.round(180 - gmT * 140);
  const gmThumbG = gmOffset <= 0 ? Math.round(180 - gmT * 140) : Math.round(180 + gmT * 30);
  const gmThumbB = gmOffset <= 0 ? Math.round(180 + gmT * 40) : Math.round(180 - gmT * 140);

  // CrossFade display
  const cfVal = group.overrides.crossFade ?? 0;
  const cfPct = Math.round((cfVal / 255) * 100);
  const cfLabel = cfVal === 0 ? "White" : cfVal >= 255 ? "RGB" : `${cfPct}% RGB`;

  // Fan display
  const fanVal = group.overrides.fan ?? 0;
  const activeFan = [...FAN_MODES].reverse().find((m) => fanVal >= m.value) ?? FAN_MODES[0];

  return (
    <>
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: group.color }} />
        <span className="text-sm font-semibold flex-1 truncate">{group.name}</span>
        <button
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive transition-colors mr-1"
          title="Delete group"
        >
          <Trash2 size={13} />
        </button>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-4">

          {/* ── Name ── */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Name</label>
            <input
              key={group.id}
              className="w-full bg-muted border border-border rounded px-2 py-1 text-sm"
              defaultValue={group.name}
              onBlur={(e) => onRename(e.target.value.trim() || group.name)}
            />
          </div>

          {/* ── Fixture assignment ── */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Assigned Fixtures ({group.fixtureIds.length})
            </label>
            <div className="space-y-1">
              {fixtures.map((f) => {
                const inGroup = group.fixtureIds.includes(f.id);
                const otherGroup = allGroups.find((g) => g.id !== group.id && g.fixtureIds.includes(f.id));
                return (
                  <button
                    key={f.id}
                    onClick={() => !otherGroup && onToggleFixture(f.id)}
                    disabled={!!otherGroup}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${
                      inGroup
                        ? "bg-primary/20 border border-primary/40 text-foreground"
                        : otherGroup
                        ? "opacity-40 cursor-not-allowed bg-muted"
                        : "bg-muted hover:bg-accent/20 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: f.color }} />
                    <span className="flex-1 truncate">{f.name}</span>
                    {otherGroup && <span className="text-[10px] opacity-60">{otherGroup.name}</span>}
                    {inGroup && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: group.color }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Overrides ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">Overrides</label>
              <span className="text-[10px] text-muted-foreground/60">Toggle to lock for group</span>
            </div>

            {/* Color Temp (CCT) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={group.overrides.cct !== undefined}
                  onChange={(e) => e.target.checked ? setOv({ cct: 128 }) : delOv("cct")}
                  className="shrink-0"
                />
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">Color Temp</label>
                {group.overrides.cct !== undefined && (
                  <span className="text-xs font-mono text-muted-foreground">{cctKelvin}K</span>
                )}
              </div>
              {group.overrides.cct !== undefined && (
                <>
                  <div
                    className="relative h-5 rounded-full overflow-hidden"
                    style={{ background: "linear-gradient(to right, rgb(255,167,87), rgb(255,210,140), rgb(255,248,235), rgb(200,225,255))" }}
                  >
                    <input
                      type="range" min={0} max={255} value={cctVal}
                      onChange={(e) => setOv({ cct: parseInt(e.target.value) })}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none"
                      style={{ left: `calc(${(cctVal / 255) * 100}% - 6px)`, background: `rgb(${cctThumbR},${cctThumbG},${cctThumbB})` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>2700K Warm</span>
                    <span>10000K Cool</span>
                  </div>
                </>
              )}
            </div>

            {/* Green / Magenta */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={group.overrides.greenOffset !== undefined}
                  onChange={(e) => e.target.checked ? setOv({ greenOffset: 128 }) : delOv("greenOffset")}
                  className="shrink-0"
                />
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">Green Offset</label>
                {group.overrides.greenOffset !== undefined && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setOv({ greenOffset: 128 })}
                      className="text-[9px] text-muted-foreground/60 hover:text-muted-foreground border border-border/40 rounded px-1 py-0.5"
                    >
                      reset
                    </button>
                    <span className="text-xs font-mono text-muted-foreground">{gmLabel}</span>
                  </div>
                )}
              </div>
              {group.overrides.greenOffset !== undefined && (
                <>
                  <div
                    className="relative h-5 rounded-full overflow-hidden"
                    style={{ background: "linear-gradient(to right, rgb(220,40,220), rgb(190,190,190) 50%, rgb(40,200,40))" }}
                  >
                    <input
                      type="range" min={0} max={255} value={gmVal}
                      onChange={(e) => setOv({ greenOffset: parseInt(e.target.value) })}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none"
                      style={{ left: `calc(${(gmVal / 255) * 100}% - 6px)`, background: `rgb(${gmThumbR},${gmThumbG},${gmThumbB})` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>M 100</span>
                    <span>0</span>
                    <span>G 100</span>
                  </div>
                </>
              )}
            </div>

            {/* CCT ↔ RGB CrossFade */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={group.overrides.crossFade !== undefined}
                  onChange={(e) => e.target.checked ? setOv({ crossFade: 0 }) : delOv("crossFade")}
                  className="shrink-0"
                />
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">Color Mix</label>
                {group.overrides.crossFade !== undefined && (
                  <span className="text-xs font-mono text-muted-foreground">{cfLabel}</span>
                )}
              </div>
              {group.overrides.crossFade !== undefined && (
                <>
                  <input
                    type="range" min={0} max={255} value={cfVal}
                    onChange={(e) => setOv({ crossFade: parseInt(e.target.value) })}
                    className="w-full accent-blue-400"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>← White</span>
                    <span>RGB →</span>
                  </div>
                </>
              )}
            </div>

            {/* Fan */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={group.overrides.fan !== undefined}
                  onChange={(e) => e.target.checked ? setOv({ fan: 0 }) : delOv("fan")}
                  className="shrink-0"
                />
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">Fan</label>
                {group.overrides.fan !== undefined && (
                  <span className="text-xs font-mono text-muted-foreground">{activeFan.desc}</span>
                )}
              </div>
              {group.overrides.fan !== undefined && (
                <div className="grid grid-cols-4 gap-1">
                  {FAN_MODES.map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() => setOv({ fan: mode.value })}
                      className={`px-1 py-1.5 text-[10px] rounded border transition-colors ${
                        activeFan.value === mode.value
                          ? "bg-blue-500 border-blue-400 text-white"
                          : "bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* RGB Color */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={colorEnabled}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setPickerHex("#ffffff");
                      setOv({ color: "#ffffff" });
                    } else {
                      delOv("color");
                    }
                  }}
                  className="shrink-0"
                />
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">Color</label>
              </div>
              {colorEnabled && (
                <>
                  <div
                    onPointerUp={() => { isDragging.current = false; }}
                    onPointerLeave={() => { isDragging.current = false; }}
                  >
                    <HexColorPicker
                      color={pickerHex}
                      onChange={(hex) => {
                        isDragging.current = true;
                        setPickerHex(hex);
                        setOv({ color: hex });
                      }}
                      style={{ width: "100%", height: 180 }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-sm border border-border shrink-0" style={{ background: pickerHex }} />
                    <input
                      type="text"
                      value={pickerHex}
                      onChange={(e) => {
                        if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                          setPickerHex(e.target.value);
                          setOv({ color: e.target.value });
                        }
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
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
