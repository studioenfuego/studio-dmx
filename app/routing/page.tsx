"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useDMXStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Search, Grid, List } from "lucide-react";
import type { FixtureInstanceData, FixtureProfileData } from "@/lib/types";

type LayoutView = "table" | "stage";

export default function RoutingPage() {
  const { fixtures, setFixtures, profiles, setProfiles } = useDMXStore();
  const [layoutView, setLayoutView] = useState<LayoutView>("table");
  const [search, setSearch] = useState("");
  const [profileSearch, setProfileSearch] = useState("");
  const [profileResults, setProfileResults] = useState<FixtureProfileData[]>([]);
  const [draggingFixtureId, setDraggingFixtureId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/v1/fixtures")
      .then((r) => r.json())
      .then(setFixtures)
      .catch(() => {});
  }, [setFixtures]);

  const searchProfiles = useCallback(async (q: string) => {
    if (!q.trim()) { setProfileResults([]); return; }
    const res = await fetch(`/api/v1/profiles?q=${encodeURIComponent(q)}`);
    if (res.ok) setProfileResults(await res.json());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchProfiles(profileSearch), 300);
    return () => clearTimeout(t);
  }, [profileSearch, searchProfiles]);

  const addFixture = useCallback(async (profile: FixtureProfileData) => {
    const maxAddr = fixtures.reduce((max, f) => {
      const end = f.startAddress + (f.profile?.channels.length ?? 1) - 1;
      return Math.max(max, end);
    }, 0);
    const nextAddr = maxAddr + 1;
    const res = await fetch("/api/v1/fixtures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${profile.manufacturer} ${profile.name}`,
        profileId: profile.id,
        startAddress: nextAddr,
      }),
    });
    if (res.ok) {
      const newFixture = await res.json();
      setFixtures([...fixtures, newFixture]);
    }
  }, [fixtures, setFixtures]);

  const deleteFixture = useCallback(async (id: string) => {
    await fetch(`/api/v1/fixtures/${id}`, { method: "DELETE" });
    setFixtures(fixtures.filter((f) => f.id !== id));
  }, [fixtures, setFixtures]);

  const updateFixtureAddress = useCallback(async (id: string, address: number) => {
    const res = await fetch(`/api/v1/fixtures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startAddress: address }),
    });
    if (res.ok) {
      const updated = await res.json();
      setFixtures(fixtures.map((f) => (f.id === id ? updated : f)));
    }
  }, [fixtures, setFixtures]);

  const updateFixtureMode = useCallback(async (id: string, modeIndex: number) => {
    const res = await fetch(`/api/v1/fixtures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modeIndex }),
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

  const filteredFixtures = fixtures.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const getModeChannelCount = (f: FixtureInstanceData) => {
    const modes = f.profile?.modes;
    if (modes && modes.length > f.modeIndex) return modes[f.modeIndex].channelCount;
    return f.profile?.channels.length ?? 1;
  };

  const usedChannels = new Set(
    fixtures.flatMap((f) => {
      const len = getModeChannelCount(f);
      return Array.from({ length: len }, (_, i) => f.startAddress + i);
    })
  );

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <h1 className="text-base font-semibold">Routing</h1>
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant={layoutView === "table" ? "default" : "outline"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setLayoutView("table")}
            >
              <List size={13} />
            </Button>
            <Button
              variant={layoutView === "stage" ? "default" : "outline"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setLayoutView("stage")}
            >
              <Grid size={13} />
            </Button>
          </div>
          <div className="relative ml-2">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-7 pl-7 text-xs w-48"
              placeholder="Search fixtures..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Badge variant="outline" className="text-xs ml-auto">
            {fixtures.length} fixtures · {usedChannels.size}/512 channels
          </Badge>
        </div>

        <div className="flex-1 min-h-0">
          {layoutView === "table" ? (
            <ScrollArea className="h-full">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b border-border z-10">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Profile</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Mode</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Start Ch</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Channels</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">End Ch</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredFixtures.map((f) => {
                    const channelCount = getModeChannelCount(f);
                    const modes = f.profile?.modes ?? [];
                    return (
                      <tr key={f.id} className="border-b border-border hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: f.color }} />
                            <span className="font-medium">{f.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">
                          {f.profile?.manufacturer} {f.profile?.name}
                        </td>
                        <td className="px-4 py-2">
                          {modes.length > 1 ? (
                            <select
                              value={f.modeIndex}
                              onChange={(e) => updateFixtureMode(f.id, parseInt(e.target.value))}
                              className="text-xs bg-muted border border-border rounded px-2 py-0.5 text-foreground max-w-[140px]"
                            >
                              {modes.map((m, i) => (
                                <option key={i} value={i}>
                                  {m.name} ({m.channelCount}ch)
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {modes[0]?.name ?? "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min={1}
                            max={512}
                            value={f.startAddress}
                            onChange={(e) => updateFixtureAddress(f.id, parseInt(e.target.value))}
                            className="w-16 text-xs font-mono bg-muted border border-border rounded px-2 py-0.5 text-foreground"
                          />
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs font-mono">
                          {channelCount}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs font-mono">
                          {f.startAddress + channelCount - 1}
                        </td>
                        <td className="px-4 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteFixture(f.id)}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredFixtures.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        No fixtures found. Add fixtures from the panel on the right.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollArea>
          ) : (
            <div
              ref={stageRef}
              className="relative w-full h-full bg-muted/20 overflow-hidden"
              style={{ minHeight: 400 }}
            >
              <div className="absolute inset-4 border border-dashed border-border rounded-lg" />
              <div className="absolute top-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
                Stage
              </div>
              {fixtures.map((f) => (
                <div
                  key={f.id}
                  className="absolute cursor-move select-none"
                  style={{
                    left: `${f.positionX || 50}%`,
                    top: `${f.positionY || 50}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDraggingFixtureId(f.id);
                    const stage = stageRef.current;
                    if (!stage) return;
                    const handleMove = (ev: MouseEvent) => {
                      const rect = stage.getBoundingClientRect();
                      const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
                      const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
                      setFixtures(fixtures.map((fix) =>
                        fix.id === f.id ? { ...fix, positionX: x, positionY: y } : fix
                      ));
                    };
                    const handleUp = (ev: MouseEvent) => {
                      const rect = stage.getBoundingClientRect();
                      const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
                      const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
                      handleStageDrop(f.id, x, y);
                      setDraggingFixtureId(null);
                      window.removeEventListener("mousemove", handleMove);
                      window.removeEventListener("mouseup", handleUp);
                    };
                    window.addEventListener("mousemove", handleMove);
                    window.addEventListener("mouseup", handleUp);
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-md"
                    style={{
                      background: f.color,
                      borderColor: draggingFixtureId === f.id ? "white" : "transparent",
                    }}
                    title={`${f.name} (Ch ${f.startAddress})`}
                  />
                  <div className="text-[9px] text-center text-foreground mt-0.5 max-w-[60px] truncate">
                    {f.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-border shrink-0">
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: 32 }, (_, i) => {
              const chStart = i * 16 + 1;
              const chEnd = chStart + 15;
              const used = Array.from({ length: 16 }, (__, j) => usedChannels.has(chStart + j));
              const anyUsed = used.some(Boolean);
              return (
                <div
                  key={i}
                  className="flex gap-px"
                  title={`Ch ${chStart}–${chEnd}`}
                >
                  {used.map((u, j) => (
                    <div
                      key={j}
                      className="w-1.5 h-3 rounded-sm"
                      style={{ background: u ? "oklch(0.6 0.15 260)" : "oklch(0.2 0 0)" }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">DMX Channel Usage (512 channels)</p>
        </div>
      </div>

      <div className="w-64 border-l border-border flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Add Fixture</h2>
        </div>
        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-7 pl-7 text-xs"
              placeholder="Search profiles..."
              value={profileSearch}
              onChange={(e) => setProfileSearch(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {profileResults.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 px-3 py-2 border-b border-border hover:bg-accent/30 cursor-pointer"
              onClick={() => addFixture(p)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{p.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{p.manufacturer}</div>
              </div>
              <Badge variant="outline" className="text-[9px] shrink-0">
                {p.channels.length}ch
              </Badge>
              <Plus size={12} className="text-muted-foreground shrink-0" />
            </div>
          ))}
          {profileSearch && profileResults.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No profiles found</p>
          )}
          {!profileSearch && (
            <p className="text-xs text-muted-foreground text-center py-4 px-3">
              Search for a fixture profile to add it to your show
            </p>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
