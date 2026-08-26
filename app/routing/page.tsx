"use client";

import { useState, useCallback, useEffect } from "react";
import { useDMXStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Search, Pencil, Rows3, X } from "lucide-react";
import type { FixtureInstanceData, FixtureProfileData } from "@/lib/types";

export default function RoutingPage() {
  const { fixtures, setFixtures } = useDMXStore();
  const [search, setSearch] = useState("");
  const [profileSearch, setProfileSearch] = useState("");
  const [profileResults, setProfileResults] = useState<FixtureProfileData[]>([]);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [showAddPanel, setShowAddPanel] = useState(false);

  useEffect(() => {
    fetch("/api/v1/fixtures")
      .then((r) => r.json())
      .then(setFixtures)
      .catch(() => {});
  }, [setFixtures]);

  const searchProfiles = useCallback(async (q: string) => {
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

  const toggleBreakout = useCallback(async (id: string, current: boolean) => {
    const res = await fetch(`/api/v1/fixtures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelBreakout: !current }),
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
    if (modes && modes.length > f.modeIndex) {
      const mode = modes[f.modeIndex];
      const count = mode.channelCount;
      if (typeof count === "number" && !isNaN(count) && count > 0) return count;
      if (Array.isArray(mode.channels)) return mode.channels.length;
    }
    return f.profile?.channels.length ?? 1;
  };

  const usedChannels = new Set(
    fixtures.flatMap((f) => {
      const len = getModeChannelCount(f);
      return Array.from({ length: len }, (_, i) => f.startAddress + i);
    })
  );

  const addFixturePanel = (
    <>
      <div className="px-3 py-2 border-b border-border shrink-0">
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
            onClick={() => { addFixture(p); setShowAddPanel(false); }}
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
        {profileResults.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No profiles found</p>
        )}
      </ScrollArea>
    </>
  );

  return (
    <div className="flex flex-col sm:flex-row h-full">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-3 border-b border-border shrink-0">
          <h1 className="text-base font-semibold">Patching</h1>
          <div className="relative ml-2 hidden sm:block">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-7 pl-7 text-xs w-48"
              placeholder="Search fixtures..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Badge variant="outline" className="text-xs ml-auto hidden sm:flex">
            {fixtures.length} fixtures · {usedChannels.size}/512 channels
          </Badge>
          <Badge variant="outline" className="text-xs ml-auto sm:hidden">
            {fixtures.length} fixtures
          </Badge>
          <Button
            size="sm"
            variant={showAddPanel ? "default" : "outline"}
            className="sm:hidden h-7 text-xs gap-1 shrink-0"
            onClick={() => setShowAddPanel((p) => !p)}
          >
            {showAddPanel ? <X size={12} /> : <Plus size={12} />}
            {showAddPanel ? "Close" : "Add"}
          </Button>
        </div>

        {/* Mobile search bar */}
        <div className="sm:hidden px-3 py-2 border-b border-border shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-7 pl-7 text-xs w-full"
              placeholder="Search fixtures..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Mobile add panel — slides in below the search bar */}
        {showAddPanel && (
          <div className="sm:hidden flex flex-col border-b-2 border-primary/40 shrink-0" style={{ maxHeight: "45%" }}>
            <div className="px-3 py-2 border-b border-border shrink-0">
              <p className="text-xs font-semibold text-muted-foreground">Add Fixture</p>
            </div>
            {addFixturePanel}
          </div>
        )}

        {/* Fixture table */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b border-border z-10">
                <tr>
                  <th className="text-left px-2 sm:px-4 py-2 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="hidden sm:table-cell text-left px-4 py-2 text-xs font-medium text-muted-foreground">Profile</th>
                  <th className="text-left px-2 sm:px-4 py-2 text-xs font-medium text-muted-foreground">Mode</th>
                  <th className="text-left px-2 sm:px-4 py-2 text-xs font-medium text-muted-foreground">Start Ch</th>
                  <th className="hidden sm:table-cell text-left px-4 py-2 text-xs font-medium text-muted-foreground">Channels</th>
                  <th className="hidden sm:table-cell text-left px-4 py-2 text-xs font-medium text-muted-foreground">End Ch</th>
                  <th className="px-2 sm:px-4 py-2 text-xs font-medium text-muted-foreground" title="Break out each channel as its own fader">Faders</th>
                  <th className="px-2 sm:px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {filteredFixtures.map((f) => {
                  const channelCount = getModeChannelCount(f);
                  const modes = f.profile?.modes ?? [];
                  return (
                    <tr key={f.id} className="border-b border-border hover:bg-accent/30 transition-colors">
                      <td className="px-2 sm:px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: f.color }} />
                          {editingNameId === f.id ? (
                            <input
                              autoFocus
                              className="font-medium text-sm bg-muted border border-border rounded px-1 py-0 min-w-0 w-28 sm:w-40"
                              value={editingNameValue}
                              onChange={(e) => setEditingNameValue(e.target.value)}
                              onBlur={() => {
                                if (editingNameValue.trim()) updateFixtureName(f.id, editingNameValue.trim());
                                setEditingNameId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { if (editingNameValue.trim()) updateFixtureName(f.id, editingNameValue.trim()); setEditingNameId(null); }
                                if (e.key === "Escape") setEditingNameId(null);
                              }}
                            />
                          ) : (
                            <span
                              className="font-medium text-xs sm:text-sm cursor-pointer hover:text-blue-400 flex items-center gap-1 group truncate max-w-[100px] sm:max-w-none"
                              onClick={() => { setEditingNameId(f.id); setEditingNameValue(f.name); }}
                              title="Click to rename"
                            >
                              {f.name}
                              <Pencil size={10} className="opacity-0 group-hover:opacity-40 shrink-0" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-2 text-muted-foreground text-xs">
                        {f.profile?.manufacturer} {f.profile?.name}
                      </td>
                      <td className="px-2 sm:px-4 py-2">
                        {modes.length > 1 ? (
                          <select
                            value={f.modeIndex}
                            onChange={(e) => updateFixtureMode(f.id, parseInt(e.target.value))}
                            className="text-xs bg-muted border border-border rounded px-1 sm:px-2 py-0.5 text-foreground max-w-[80px] sm:max-w-[140px]"
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
                      <td className="px-2 sm:px-4 py-2">
                        <input
                          type="number"
                          min={1}
                          max={512}
                          value={f.startAddress}
                          onChange={(e) => updateFixtureAddress(f.id, parseInt(e.target.value))}
                          className="w-12 sm:w-16 text-xs font-mono bg-muted border border-border rounded px-1 sm:px-2 py-0.5 text-foreground"
                        />
                      </td>
                      <td className="hidden sm:table-cell px-4 py-2 text-muted-foreground text-xs font-mono">
                        {channelCount}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-2 text-muted-foreground text-xs font-mono">
                        {f.startAddress + channelCount - 1}
                      </td>
                      <td className="px-2 sm:px-4 py-2">
                        <button
                          onClick={() => toggleBreakout(f.id, f.channelBreakout)}
                          title={f.channelBreakout ? "Each channel is its own fader — click to combine" : "Show each channel as its own fader"}
                          className={`flex items-center justify-center w-7 h-7 rounded transition-colors ${
                            f.channelBreakout
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent"
                          }`}
                        >
                          <Rows3 size={13} />
                        </button>
                      </td>
                      <td className="px-2 sm:px-4 py-2">
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
                      No fixtures found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </div>

        {/* DMX channel usage graph — desktop only */}
        <div className="hidden sm:block px-4 py-2 border-t border-border shrink-0">
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: 32 }, (_, i) => {
              const chStart = i * 16 + 1;
              const chEnd = chStart + 15;
              const used = Array.from({ length: 16 }, (__, j) => usedChannels.has(chStart + j));
              return (
                <div key={i} className="flex gap-px" title={`Ch ${chStart}–${chEnd}`}>
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

      {/* Desktop add fixture panel */}
      <div className="hidden sm:flex w-72 border-l border-border flex-col shrink-0">
        <div className="px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold">Add Fixture</h2>
        </div>
        {addFixturePanel}
      </div>
    </div>
  );
}
