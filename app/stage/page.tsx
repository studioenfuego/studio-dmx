"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useDMXStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, X, ImageUp, RotateCw, Lock, Unlock, ImageOff, Upload, Loader2 } from "lucide-react";
import { FixtureControls } from "@/components/faders/FixtureControls";
import type { StageBackgroundData } from "@/lib/types";

const DEFAULT_BACKGROUND: StageBackgroundData = {
  imageUrl: null,
  x: 50,
  y: 50,
  scale: 100,
  rotation: 0,
  locked: false,
};

export default function StagePage() {
  const { fixtures, setFixtures } = useDMXStore();
  const [draggingFixtureId, setDraggingFixtureId] = useState<string | null>(null);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [background, setBackground] = useState<StageBackgroundData>(DEFAULT_BACKGROUND);
  const [draggingBackground, setDraggingBackground] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const [availableIcons, setAvailableIcons] = useState<string[]>([]);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);

  const selectedFixture = useMemo(
    () => fixtures.find((f) => f.id === selectedFixtureId) ?? null,
    [fixtures, selectedFixtureId]
  );

  useEffect(() => {
    fetch("/api/v1/fixtures")
      .then((r) => r.json())
      .then(setFixtures)
      .catch(() => {});
  }, [setFixtures]);

  useEffect(() => {
    fetch("/api/v1/stage-background")
      .then((r) => r.json())
      .then(setBackground)
      .catch(() => {});
  }, []);

  const fetchIcons = useCallback(async () => {
    const res = await fetch("/api/v1/fixture-icons");
    if (res.ok) setAvailableIcons(await res.json());
  }, []);

  useEffect(() => {
    fetchIcons();
  }, [fetchIcons]);

  const updateFixtureIcon = useCallback(async (profileId: string, icon: string | null) => {
    const res = await fetch(`/api/v1/profiles/${profileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ icon }),
    });
    if (res.ok) {
      setFixtures(fixtures.map((f) =>
        f.profileId === profileId && f.profile
          ? { ...f, profile: { ...f.profile, icon } }
          : f
      ));
    }
  }, [fixtures, setFixtures]);

  const handleIconUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, profileId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingIcon(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v1/fixture-icons", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        await fetchIcons();
        await updateFixtureIcon(profileId, data.icon);
      } else {
        alert(data.error ?? "Upload failed");
      }
    } catch {
      alert("Upload failed");
    } finally {
      setIsUploadingIcon(false);
      e.target.value = "";
    }
  }, [fetchIcons, updateFixtureIcon]);

  const updateBackground = useCallback(async (updates: Partial<StageBackgroundData>) => {
    setBackground((prev) => ({ ...prev, ...updates }));
    const res = await fetch("/api/v1/stage-background", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) setBackground(await res.json());
  }, []);

  const handleBackgroundUpload = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/v1/stage-background/upload", {
      method: "POST",
      body: formData,
    });
    if (res.ok) setBackground(await res.json());
  }, []);

  const removeBackground = useCallback(() => {
    updateBackground({ imageUrl: null, x: 50, y: 50, scale: 100, rotation: 0, locked: false });
  }, [updateBackground]);

  const rotateBackground = useCallback(() => {
    updateBackground({ rotation: (background.rotation + 90) % 360 });
  }, [background.rotation, updateBackground]);

  const updateFixtureName = useCallback(async (id: string, name: string) => {
    const res = await fetch(`/api/v1/fixtures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const updated = await res.json();
      setFixtures(fixtures.map((f) => (f.id === id ? updated : f)));
    }
  }, [fixtures, setFixtures]);

  const handleStageDrop = useCallback(async (id: string, x: number, y: number) => {
    const res = await fetch(`/api/v1/fixtures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionX: x, positionY: y }),
    });
    if (res.ok) {
      const updated = await res.json();
      setFixtures(fixtures.map((f) => (f.id === id ? updated : f)));
    }
  }, [fixtures, setFixtures]);

  const updateFixtureIconTransform = useCallback(async (id: string, updates: { iconRotation?: number; iconScale?: number }) => {
    const res = await fetch(`/api/v1/fixtures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setFixtures(fixtures.map((f) => (f.id === id ? updated : f)));
    }
  }, [fixtures, setFixtures]);

  const handleBackgroundMouseDown = useCallback((e: React.MouseEvent) => {
    if (background.locked) return;
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    setDraggingBackground(true);
    const handleMove = (ev: MouseEvent) => {
      const rect = stage.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
      setBackground((prev) => ({ ...prev, x, y }));
    };
    const handleUp = (ev: MouseEvent) => {
      const rect = stage.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
      setDraggingBackground(false);
      updateBackground({ x, y });
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [background.locked, updateBackground]);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <h1 className="text-base font-semibold">Stage</h1>
          <Badge variant="outline" className="text-xs ml-auto">
            {fixtures.length} fixtures
          </Badge>
        </div>

        <div className="flex-1 min-h-0">
          <div
            ref={stageRef}
            className="relative w-full h-full bg-muted/20 overflow-hidden"
            style={{ minHeight: 400 }}
          >
            <input
              ref={bgFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBackgroundUpload(file);
                e.target.value = "";
              }}
            />
            {background.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={background.imageUrl}
                alt="Stage background"
                draggable={false}
                className="absolute select-none"
                style={{
                  left: `${background.x}%`,
                  top: `${background.y}%`,
                  width: `${background.scale}%`,
                  transform: `translate(-50%, -50%) rotate(${background.rotation}deg)`,
                  cursor: background.locked ? "default" : draggingBackground ? "grabbing" : "grab",
                  outline: background.locked ? "none" : "1px dashed rgba(255,255,255,0.3)",
                  zIndex: 0,
                }}
                onMouseDown={handleBackgroundMouseDown}
              />
            )}
            <div className="absolute inset-4 border border-dashed border-border rounded-lg" />
            <div className="absolute top-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
              Stage
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-background/80 backdrop-blur rounded-md border border-border p-1.5" style={{ zIndex: 2 }}>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => bgFileInputRef.current?.click()}
                title="Upload background image"
              >
                <ImageUp size={13} />
                {background.imageUrl ? "Replace" : "Add image"}
              </Button>
              {background.imageUrl && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={rotateBackground}
                    title="Rotate 90°"
                  >
                    <RotateCw size={13} />
                  </Button>
                  <div className="flex items-center gap-1 px-1">
                    <input
                      type="range"
                      min={10}
                      max={300}
                      value={background.scale}
                      onChange={(e) => setBackground((prev) => ({ ...prev, scale: parseInt(e.target.value) }))}
                      onMouseUp={(e) => updateBackground({ scale: parseInt((e.target as HTMLInputElement).value) })}
                      className="w-20 accent-primary"
                      title="Scale"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => updateBackground({ locked: !background.locked })}
                    title={background.locked ? "Unlock background" : "Lock background"}
                  >
                    {background.locked ? <Lock size={13} /> : <Unlock size={13} />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={removeBackground}
                    title="Remove background"
                  >
                    <Trash2 size={13} />
                  </Button>
                </>
              )}
            </div>
            {fixtures.map((f) => (
              <div
                key={f.id}
                className="absolute cursor-move select-none"
                style={{
                  left: `${f.positionX || 50}%`,
                  top: `${f.positionY || 50}%`,
                  transform: "translate(-50%, -50%)",
                  touchAction: "none",
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDraggingFixtureId(f.id);
                  const stage = stageRef.current;
                  if (!stage) return;
                  let moved = false;
                  const startX = e.clientX, startY = e.clientY;
                  const handleMove = (ev: MouseEvent) => {
                    if (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4) moved = true;
                    if (!moved) return;
                    const rect = stage.getBoundingClientRect();
                    const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
                    const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
                    setFixtures(fixtures.map((fix) =>
                      fix.id === f.id ? { ...fix, positionX: x, positionY: y } : fix
                    ));
                  };
                  const handleUp = (ev: MouseEvent) => {
                    if (!moved) {
                      setSelectedFixtureId((prev) => (prev === f.id ? null : f.id));
                    } else {
                      const rect = stage.getBoundingClientRect();
                      const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
                      const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
                      handleStageDrop(f.id, x, y);
                    }
                    setDraggingFixtureId(null);
                    window.removeEventListener("mousemove", handleMove);
                    window.removeEventListener("mouseup", handleUp);
                  };
                  window.addEventListener("mousemove", handleMove);
                  window.addEventListener("mouseup", handleUp);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  setDraggingFixtureId(f.id);
                  const stage = stageRef.current;
                  if (!stage) return;
                  let moved = false;
                  const startX = e.touches[0].clientX, startY = e.touches[0].clientY;
                  const handleMove = (ev: TouchEvent) => {
                    ev.preventDefault();
                    const touch = ev.touches[0];
                    if (Math.abs(touch.clientX - startX) > 4 || Math.abs(touch.clientY - startY) > 4) moved = true;
                    if (!moved) return;
                    const rect = stage.getBoundingClientRect();
                    const x = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
                    const y = Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100));
                    setFixtures(fixtures.map((fix) =>
                      fix.id === f.id ? { ...fix, positionX: x, positionY: y } : fix
                    ));
                  };
                  const handleEnd = (ev: TouchEvent) => {
                    const touch = ev.changedTouches[0];
                    if (!moved) {
                      setSelectedFixtureId((prev) => (prev === f.id ? null : f.id));
                    } else {
                      const rect = stage.getBoundingClientRect();
                      const x = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
                      const y = Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100));
                      handleStageDrop(f.id, x, y);
                    }
                    setDraggingFixtureId(null);
                    window.removeEventListener("touchmove", handleMove);
                    window.removeEventListener("touchend", handleEnd);
                  };
                  window.addEventListener("touchmove", handleMove, { passive: false });
                  window.addEventListener("touchend", handleEnd);
                }}
              >
                {f.profile?.icon ? (
                  <div
                    className="relative flex items-center justify-center rounded-md transition-[box-shadow]"
                    style={{
                      width: `${40 * ((f.iconScale || 100) / 100)}px`,
                      height: `${40 * ((f.iconScale || 100) / 100)}px`,
                      boxShadow: selectedFixtureId === f.id
                        ? `0 0 0 2px white, 0 0 12px 2px ${f.color}`
                        : draggingFixtureId === f.id
                          ? `0 0 0 2px rgba(255,255,255,0.6)`
                          : undefined,
                    }}
                    title={`${f.name} (Ch ${f.startAddress})`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.profile.icon}
                      alt=""
                      draggable={false}
                      className="w-full h-full drop-shadow-md"
                      style={{ transform: `rotate(${f.iconRotation || 0}deg)`, objectFit: "contain" }}
                    />
                    {selectedFixtureId === f.id && (
                      <div
                        className="absolute left-1/2 top-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-white border-2 border-blue-500 shadow cursor-grab active:cursor-grabbing"
                        style={{ transform: `rotate(${f.iconRotation || 0}deg) translateY(-${20 * ((f.iconScale || 100) / 100) + 14}px)`, touchAction: "none" }}
                        title="Drag to rotate"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const iconEl = e.currentTarget.parentElement as HTMLElement;
                          const rect = iconEl.getBoundingClientRect();
                          const cx = rect.left + rect.width / 2;
                          const cy = rect.top + rect.height / 2;
                          const angleFromEvent = (ev: MouseEvent) => {
                            const deg = Math.atan2(ev.clientY - cy, ev.clientX - cx) * (180 / Math.PI) + 90;
                            return ((deg % 360) + 360) % 360;
                          };
                          const handleMove = (ev: MouseEvent) => {
                            const rotation = angleFromEvent(ev);
                            setFixtures(fixtures.map((fix) =>
                              fix.id === f.id ? { ...fix, iconRotation: rotation } : fix
                            ));
                          };
                          const handleUp = (ev: MouseEvent) => {
                            updateFixtureIconTransform(f.id, { iconRotation: angleFromEvent(ev) });
                            window.removeEventListener("mousemove", handleMove);
                            window.removeEventListener("mouseup", handleUp);
                          };
                          window.addEventListener("mousemove", handleMove);
                          window.addEventListener("mouseup", handleUp);
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const iconEl = e.currentTarget.parentElement as HTMLElement;
                          const rect = iconEl.getBoundingClientRect();
                          const cx = rect.left + rect.width / 2;
                          const cy = rect.top + rect.height / 2;
                          const angleFromTouch = (touch: Touch) => {
                            const deg = Math.atan2(touch.clientY - cy, touch.clientX - cx) * (180 / Math.PI) + 90;
                            return ((deg % 360) + 360) % 360;
                          };
                          const handleMove = (ev: TouchEvent) => {
                            ev.preventDefault();
                            const rotation = angleFromTouch(ev.touches[0]);
                            setFixtures(fixtures.map((fix) =>
                              fix.id === f.id ? { ...fix, iconRotation: rotation } : fix
                            ));
                          };
                          const handleEnd = (ev: TouchEvent) => {
                            updateFixtureIconTransform(f.id, { iconRotation: angleFromTouch(ev.changedTouches[0]) });
                            window.removeEventListener("touchmove", handleMove);
                            window.removeEventListener("touchend", handleEnd);
                          };
                          window.addEventListener("touchmove", handleMove, { passive: false });
                          window.addEventListener("touchend", handleEnd);
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div
                    className="w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-md transition-[border-color,box-shadow]"
                    style={{
                      background: f.color,
                      borderColor: selectedFixtureId === f.id ? "white" : draggingFixtureId === f.id ? "rgba(255,255,255,0.6)" : "transparent",
                      boxShadow: selectedFixtureId === f.id ? `0 0 12px 2px ${f.color}` : undefined,
                    }}
                    title={`${f.name} (Ch ${f.startAddress})`}
                  />
                )}
                <div className="text-[10px] text-center text-foreground mt-1 whitespace-nowrap">
                  {f.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-72 border-l border-border flex flex-col shrink-0">
        {selectedFixture ? (
          <>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: selectedFixture.color }} />
              {editingNameId === selectedFixture.id ? (
                <input
                  autoFocus
                  className="text-sm font-semibold flex-1 bg-muted border border-border rounded px-1 py-0 min-w-0"
                  value={editingNameValue}
                  onChange={(e) => setEditingNameValue(e.target.value)}
                  onBlur={() => {
                    if (editingNameValue.trim()) updateFixtureName(selectedFixture.id, editingNameValue.trim());
                    setEditingNameId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { if (editingNameValue.trim()) updateFixtureName(selectedFixture.id, editingNameValue.trim()); setEditingNameId(null); }
                    if (e.key === "Escape") setEditingNameId(null);
                  }}
                />
              ) : (
                <span
                  className="text-sm font-semibold flex-1 truncate cursor-pointer hover:text-blue-400"
                  onClick={() => { setEditingNameId(selectedFixture.id); setEditingNameValue(selectedFixture.name); }}
                  title="Click to rename"
                >
                  {selectedFixture.name}
                </span>
              )}
              <button onClick={() => setSelectedFixtureId(null)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <X size={14} />
              </button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-3">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Stage Icon</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateFixtureIcon(selectedFixture.profileId, null)}
                      className={`w-10 h-10 rounded border flex items-center justify-center transition-colors ${
                        !selectedFixture.profile?.icon ? "border-primary bg-accent" : "border-border hover:bg-accent/30"
                      }`}
                      title="No icon"
                    >
                      <ImageOff size={14} className="text-muted-foreground" />
                    </button>
                    {availableIcons.map((icon) => (
                      <button
                        type="button"
                        key={icon}
                        onClick={() => updateFixtureIcon(selectedFixture.profileId, icon)}
                        className={`w-10 h-10 rounded border flex items-center justify-center p-1 transition-colors ${
                          selectedFixture.profile?.icon === icon ? "border-primary bg-accent" : "border-border hover:bg-accent/30"
                        }`}
                        title={icon.split("/").pop()}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={icon} alt="" className="max-w-full max-h-full" />
                      </button>
                    ))}
                    <label
                      className={`w-10 h-10 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-accent/30 transition-colors ${
                        isUploadingIcon ? "opacity-50 pointer-events-none" : ""
                      }`}
                      title="Upload new SVG icon"
                    >
                      {isUploadingIcon ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      <input
                        type="file"
                        accept=".svg,image/svg+xml"
                        className="hidden"
                        onChange={(e) => handleIconUpload(e, selectedFixture.profileId)}
                      />
                    </label>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Applies to all fixtures using this profile.</p>
                </div>
                {selectedFixture.profile?.icon && (
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Icon Size</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={25}
                        max={300}
                        value={selectedFixture.iconScale || 100}
                        onChange={(e) => {
                          const iconScale = parseInt(e.target.value);
                          setFixtures(fixtures.map((fix) =>
                            fix.id === selectedFixture.id ? { ...fix, iconScale } : fix
                          ));
                        }}
                        onMouseUp={(e) => updateFixtureIconTransform(selectedFixture.id, { iconScale: parseInt((e.target as HTMLInputElement).value) })}
                        className="flex-1 accent-primary"
                      />
                      <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(selectedFixture.iconScale || 100)}%</span>
                    </div>
                  </div>
                )}
                <FixtureControls fixture={selectedFixture} />
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
            Click a fixture on the stage to edit its icon, size, rotation, and channels.
          </div>
        )}
      </div>
    </div>
  );
}
