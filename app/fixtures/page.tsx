"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Search, Plus, Trash2, Upload, Save, ChevronDown, ChevronUp, Download, Loader2, Library, CheckCircle2 } from "lucide-react";
import type { FixtureProfileData, ChannelDefinition, ModeDefinition } from "@/lib/types";

type OFLManufacturer = { key: string; name: string };

type MainView = "library" | "ofl";

const CAPABILITY_OPTIONS = [
  "dimmer", "red", "green", "blue", "white", "amber", "uv",
  "cct", "greenOffset", "crossFade", "fan",
  "pan", "panFine", "tilt", "tiltFine", "colorWheel", "goboPrimary",
  "goboSecondary", "strobe", "zoom", "focus", "iris", "prism", "frost",
  "speed", "effects", "program", "maintenance", "noFunction",
];

export default function FixturesPage() {
  const [profiles, setProfiles] = useState<FixtureProfileData[]>([]);
  const [search, setSearch] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<FixtureProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editProfile, setEditProfile] = useState<Partial<FixtureProfileData>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [expandedManufacturers, setExpandedManufacturers] = useState<Set<string>>(new Set());
  const [mainView, setMainView] = useState<MainView>("library");

  const [oflManufacturers, setOflManufacturers] = useState<OFLManufacturer[]>([]);
  const [oflFixtures, setOflFixtures] = useState<string[]>([]);
  const [oflSelectedMfg, setOflSelectedMfg] = useState<OFLManufacturer | null>(null);
  const [oflMfgSearch, setOflMfgSearch] = useState("");
  const [oflFixtureSearch, setOflFixtureSearch] = useState("");
  const [oflLoading, setOflLoading] = useState(false);
  const [oflFixturesLoading, setOflFixturesLoading] = useState(false);
  const [oflError, setOflError] = useState<string | null>(null);
  const [importingKeys, setImportingKeys] = useState<Set<string>>(new Set());
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());

  const fetchProfiles = useCallback(async (q: string) => {
    const res = await fetch(`/api/v1/profiles?q=${encodeURIComponent(q)}`);
    if (res.ok) setProfiles(await res.json());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchProfiles(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchProfiles]);

  const loadOFLManufacturers = useCallback(async () => {
    if (oflManufacturers.length > 0) return;
    setOflLoading(true);
    setOflError(null);
    try {
      const res = await fetch("/api/v1/ofl");
      if (!res.ok) throw new Error("Failed to reach GitHub");
      setOflManufacturers(await res.json());
    } catch (e) {
      setOflError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setOflLoading(false);
    }
  }, [oflManufacturers.length]);

  const selectOFLManufacturer = useCallback(async (mfg: OFLManufacturer) => {
    setOflSelectedMfg(mfg);
    setOflFixtures([]);
    setOflFixtureSearch("");
    setOflFixturesLoading(true);
    try {
      const res = await fetch(`/api/v1/ofl?manufacturer=${mfg.key}`);
      if (!res.ok) throw new Error("Failed to load fixtures");
      setOflFixtures(await res.json());
    } catch {
      setOflFixtures([]);
    } finally {
      setOflFixturesLoading(false);
    }
  }, []);

  const openOFL = useCallback(() => {
    console.log("[fixtures] openOFL called, switching to ofl view");
    setMainView("ofl");
    loadOFLManufacturers();
  }, [loadOFLManufacturers]);

  const importFromOFL = useCallback(async (fixtureKey: string) => {
    if (!oflSelectedMfg) return;
    const fullKey = `${oflSelectedMfg.key}/${fixtureKey}`;
    setImportingKeys((s) => new Set(s).add(fullKey));
    try {
      const res = await fetch("/api/v1/ofl/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manufacturer: oflSelectedMfg.key, fixture: fixtureKey }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportedKeys((s) => new Set(s).add(fullKey));
        await fetchProfiles(search);
        if (data.profile) {
          setSelectedProfile(data.profile);
          setMainView("library");
        }
      } else {
        alert(data.error ?? "Import failed");
      }
    } catch {
      alert("Import failed");
    } finally {
      setImportingKeys((s) => { const n = new Set(s); n.delete(fullKey); return n; });
    }
  }, [oflSelectedMfg, search, fetchProfiles]);

  const groupedProfiles = profiles.reduce<Record<string, FixtureProfileData[]>>((acc, p) => {
    if (!acc[p.manufacturer]) acc[p.manufacturer] = [];
    acc[p.manufacturer].push(p);
    return acc;
  }, {});

  const startCreate = () => {
    console.log("[fixtures] startCreate called, isEditing will be true");
    setSelectedProfile(null);
    setEditProfile({
      name: "",
      manufacturer: "",
      channels: [{ name: "Dimmer", capability: "dimmer" }],
      modes: [{ name: "Default", channelCount: 1, channels: ["Dimmer"] }],
    });
    setIsEditing(true);
  };

  const startEdit = (profile: FixtureProfileData) => {
    setSelectedProfile(profile);
    setEditProfile({ ...profile });
    setIsEditing(true);
  };

  const saveProfile = useCallback(async () => {
    if (!editProfile.name || !editProfile.manufacturer) return;
    setIsSaving(true);
    const url = selectedProfile ? `/api/v1/profiles/${selectedProfile.id}` : "/api/v1/profiles";
    const method = selectedProfile ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editProfile),
    });
    if (res.ok) {
      await fetchProfiles(search);
      setIsEditing(false);
    }
    setIsSaving(false);
  }, [editProfile, selectedProfile, search, fetchProfiles]);

  const deleteProfile = useCallback(async (id: string) => {
    if (!confirm("Delete this fixture profile?")) return;
    await fetch(`/api/v1/profiles/${id}`, { method: "DELETE" });
    await fetchProfiles(search);
    if (selectedProfile?.id === id) { setSelectedProfile(null); setIsEditing(false); }
  }, [selectedProfile, search, fetchProfiles]);

  const handleOFLImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const ofl = JSON.parse(text);
      const channels: ChannelDefinition[] = [];
      const modes: ModeDefinition[] = [];

      if (ofl.availableChannels) {
        for (const [name, ch] of Object.entries(ofl.availableChannels as Record<string, { capability?: { type?: string } }>)) {
          const cap = ch?.capability?.type ?? "noFunction";
          channels.push({ name, capability: cap.toLowerCase() as ChannelDefinition["capability"] });
        }
      }

      if (ofl.modes) {
        for (const mode of ofl.modes as Array<{ name?: string; channels: string[] }>) {
          modes.push({
            name: mode.name ?? "Default",
            channelCount: mode.channels.length,
            channels: mode.channels,
          });
        }
      }

      setEditProfile({
        name: ofl.name ?? file.name.replace(".json", ""),
        manufacturer: ofl.manufacturer ?? "",
        oflKey: file.name.replace(".json", ""),
        channels,
        modes,
      });
      setIsEditing(true);
      setSelectedProfile(null);
    } catch {
      alert("Failed to parse OFL JSON file");
    }
    e.target.value = "";
  }, []);

  const addChannel = () => {
    const ch: ChannelDefinition = { name: `Channel ${(editProfile.channels?.length ?? 0) + 1}`, capability: "noFunction" };
    setEditProfile((p) => ({ ...p, channels: [...(p.channels ?? []), ch] }));
  };

  const updateChannel = (i: number, update: Partial<ChannelDefinition>) => {
    const channels = [...(editProfile.channels ?? [])];
    channels[i] = { ...channels[i], ...update };
    setEditProfile((p) => ({ ...p, channels }));
  };

  const removeChannel = (i: number) => {
    const channels = (editProfile.channels ?? []).filter((_, idx) => idx !== i);
    setEditProfile((p) => ({ ...p, channels }));
  };

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-border flex flex-col shrink-0">
        <div className="px-3 py-3 border-b border-border flex items-center gap-2">
          <h2 className="text-sm font-semibold flex-1">My Profiles</h2>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={startCreate} title="New profile">
            <Plus size={14} />
          </Button>
        </div>
        <div className="px-2 py-2 border-b border-border flex gap-1">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-7 pl-7 text-xs" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <label className="cursor-pointer inline-flex items-center justify-center h-7 w-7 rounded-md border border-border bg-transparent hover:bg-accent text-foreground" title="Import OFL JSON file">
            <Upload size={12} />
            <input type="file" accept=".json" className="hidden" onChange={handleOFLImport} />
          </label>
        </div>
        <ScrollArea className="flex-1">
          {Object.entries(groupedProfiles).map(([manufacturer, profs]) => {
            const expanded = expandedManufacturers.has(manufacturer);
            return (
              <div key={manufacturer}>
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
                  onClick={() => setExpandedManufacturers((s) => {
                    const next = new Set(s);
                    if (next.has(manufacturer)) next.delete(manufacturer);
                    else next.add(manufacturer);
                    return next;
                  })}
                >
                  {expanded ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                  <span className="flex-1 text-left truncate">{manufacturer}</span>
                  <Badge variant="outline" className="text-[9px] px-1">{profs.length}</Badge>
                </button>
                {expanded && profs.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 px-4 py-1.5 cursor-pointer hover:bg-accent/30 transition-colors text-xs ${
                      selectedProfile?.id === p.id ? "bg-accent text-accent-foreground" : ""
                    }`}
                    onClick={() => { setSelectedProfile(p); setIsEditing(false); }}
                  >
                    <span className="flex-1 truncate">{p.name}</span>
                    <Badge variant="outline" className="text-[9px] px-1">{p.channels.length}ch</Badge>
                  </div>
                ))}
                <Separator />
              </div>
            );
          })}
          {profiles.length === 0 && (
            <div className="text-center py-8 px-4 text-xs text-muted-foreground space-y-2">
              <p>No profiles yet.</p>
              <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs h-7" onClick={openOFL}>
                <Library size={12} />
                Browse OFL Library
              </Button>
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border shrink-0">
          <button
            onClick={() => setMainView("library")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              mainView === "library" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Profiles
            {profiles.length > 0 && (
              <span className="text-[10px] bg-muted px-1 rounded">{profiles.length}</span>
            )}
          </button>
          <button
            onClick={openOFL}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              mainView === "ofl" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Library size={12} />
            OFL Library
          </button>
        </div>

        {mainView === "ofl" ? (
          <div className="flex flex-1 min-h-0">
            {/* Manufacturer list */}
            <div className="w-56 border-r border-border flex flex-col shrink-0">
              <div className="px-2 py-2 border-b border-border">
                <div className="relative">
                  <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-7 pl-6 text-xs"
                    placeholder="Filter manufacturers…"
                    value={oflMfgSearch}
                    onChange={(e) => setOflMfgSearch(e.target.value)}
                  />
                </div>
              </div>
              {oflError && (
                <div className="p-2 text-[10px] text-destructive">{oflError}</div>
              )}
              <ScrollArea className="flex-1">
                {oflLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
                    <Loader2 size={13} className="animate-spin" />Loading…
                  </div>
                ) : (
                  oflManufacturers
                    .filter((m) => m.name.toLowerCase().includes(oflMfgSearch.toLowerCase()))
                    .map((mfg) => (
                      <button
                        key={mfg.key}
                        onClick={() => selectOFLManufacturer(mfg)}
                        className={`w-full text-left px-3 py-1.5 text-xs truncate transition-colors hover:bg-accent/30 ${
                          oflSelectedMfg?.key === mfg.key ? "bg-accent text-accent-foreground font-medium" : ""
                        }`}
                      >
                        {mfg.name}
                      </button>
                    ))
                )}
              </ScrollArea>
            </div>

            {/* Fixture list */}
            <div className="flex-1 flex flex-col min-w-0">
              {oflSelectedMfg ? (
                <>
                  <div className="px-3 py-2 border-b border-border flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium">{oflSelectedMfg.name}</span>
                    {oflFixturesLoading && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
                    <div className="relative ml-auto w-44">
                      <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="h-7 pl-6 text-xs"
                        placeholder="Filter fixtures…"
                        value={oflFixtureSearch}
                        onChange={(e) => setOflFixtureSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="divide-y divide-border">
                      {oflFixtures
                        .filter((f) => f.toLowerCase().includes(oflFixtureSearch.toLowerCase()))
                        .map((fixtureKey) => {
                          const fullKey = `${oflSelectedMfg.key}/${fixtureKey}`;
                          const isImporting = importingKeys.has(fullKey);
                          const isImported = importedKeys.has(fullKey) ||
                            profiles.some((p) => p.oflKey === fullKey);
                          const displayName = fixtureKey
                            .split("-")
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(" ");
                          return (
                            <div
                              key={fixtureKey}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors"
                            >
                              <span className="flex-1 text-sm truncate">{displayName}</span>
                              <div className="shrink-0">
                                {isImported ? (
                                  <div className="flex items-center gap-1 text-xs text-green-500">
                                    <CheckCircle2 size={13} />
                                    <span>Imported</span>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1"
                                    disabled={isImporting}
                                    onClick={() => importFromOFL(fixtureKey)}
                                  >
                                    {isImporting
                                      ? <Loader2 size={11} className="animate-spin" />
                                      : <Download size={11} />}
                                    {isImporting ? "Importing…" : "Import"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  ← Select a manufacturer
                </div>
              )}
            </div>
          </div>
        ) : isEditing ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
              <h2 className="text-sm font-semibold">
                {selectedProfile ? "Edit Profile" : "New Profile"}
              </h2>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={saveProfile} disabled={isSaving}>
                  <Save size={12} />
                  {isSaving ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4 max-w-2xl">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Manufacturer</label>
                    <Input
                      value={editProfile.manufacturer ?? ""}
                      onChange={(e) => setEditProfile((p) => ({ ...p, manufacturer: e.target.value }))}
                      className="h-8 text-sm"
                      placeholder="e.g. Chauvet"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Model Name</label>
                    <Input
                      value={editProfile.name ?? ""}
                      onChange={(e) => setEditProfile((p) => ({ ...p, name: e.target.value }))}
                      className="h-8 text-sm"
                      placeholder="e.g. SlimPAR Pro Q USB"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold">Channels</h3>
                    <Badge variant="outline" className="text-xs">{editProfile.channels?.length ?? 0}</Badge>
                    <Button size="sm" variant="outline" className="h-6 text-xs gap-1 ml-auto" onClick={addChannel}>
                      <Plus size={10} />Add Channel
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {(editProfile.channels ?? []).map((ch, i) => (
                      <div key={i} className="flex items-center gap-2 bg-muted/30 rounded px-2 py-1">
                        <span className="text-xs text-muted-foreground font-mono w-6 shrink-0">{i + 1}</span>
                        <Input
                          value={ch.name}
                          onChange={(e) => updateChannel(i, { name: e.target.value })}
                          className="h-6 text-xs flex-1"
                          placeholder="Channel name"
                        />
                        <select
                          value={ch.capability}
                          onChange={(e) => updateChannel(i, { capability: e.target.value as ChannelDefinition["capability"] })}
                          className="h-6 text-xs bg-background border border-border rounded px-1 text-foreground"
                        >
                          {CAPABILITY_OPTIONS.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeChannel(i)}
                        >
                          <Trash2 size={10} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </>
        ) : selectedProfile ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
              <div>
                <h2 className="text-sm font-semibold">{selectedProfile.name}</h2>
                <p className="text-xs text-muted-foreground">{selectedProfile.manufacturer}</p>
              </div>
              <div className="ml-auto flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-destructive"
                  onClick={() => deleteProfile(selectedProfile.id)}
                >
                  <Trash2 size={12} className="mr-1" />Delete
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={() => startEdit(selectedProfile)}>
                  Edit Profile
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                <Card className="p-3">
                  <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                    Channels ({selectedProfile.channels.length})
                  </h3>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="pb-1 w-8">#</th>
                        <th className="pb-1">Name</th>
                        <th className="pb-1">Capability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProfile.channels.map((ch, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="py-1 font-mono text-muted-foreground">{i + 1}</td>
                          <td className="py-1">{ch.name}</td>
                          <td className="py-1">
                            <Badge variant="outline" className="text-[10px]">{ch.capability}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>

                {selectedProfile.modes.length > 0 && (
                  <Card className="p-3">
                    <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                      Modes ({selectedProfile.modes.length})
                    </h3>
                    {selectedProfile.modes.map((mode, i) => (
                      <div key={i} className="mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">{mode.name}</span>
                          <Badge variant="outline" className="text-[9px]">{mode.channelCount}ch</Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground pl-2">
                          {mode.channels.join(", ")}
                        </div>
                      </div>
                    ))}
                  </Card>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-3">
              <p className="text-sm">Select a profile or import one</p>
              <Button size="sm" className="gap-1.5 w-full" onClick={openOFL}>
                <Library size={14} />
                Browse OFL Library
              </Button>
              <Button size="sm" variant="outline" className="gap-1 w-full" onClick={startCreate}>
                <Plus size={14} />
                Create Custom
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
