"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDMXStore } from "@/lib/store";
import { sendWS } from "@/lib/wsClient";
import { GrandMasterFader } from "@/components/faders/GrandMasterFader";
import { FixtureStrip, getFixtureActiveChannels } from "@/components/faders/FixtureStrip";
import { FixtureControls } from "@/components/faders/FixtureControls";
import { GroupFader } from "@/components/faders/GroupFader";
import { GroupEditPanel } from "@/components/faders/GroupEditPanel";
import { ChannelStrip } from "@/components/faders/ChannelStrip";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ZapOff, X, ChevronRight, Plus, GripHorizontal } from "lucide-react";
import type { FixtureInstanceData, GroupData, GroupOverrides } from "@/lib/types";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableFixtureWrapper({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex flex-col h-full"
    >
      <div
        className="flex items-center justify-center h-5 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripHorizontal size={11} />
      </div>
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}

export default function FadersPage() {
  const { channels, fixtures, setFixtures, groups, setGroups, updateGroup, baseDimmers, setBaseDimmer, grandMaster, setGrandMaster } = useDMXStore();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [soloedFixtureId, setSoloedFixtureId] = useState<string | null>(null);
  const [isBlackout, setIsBlackout] = useState(false);
  const [groupsCollapsed, setGroupsCollapsed] = useState(false);
  const preSoloValues = useRef<Record<string, number>>({});
  const preBlackoutGM = useRef<number>(255);

  const selectedFixture = useMemo(
    () => fixtures.find((f) => f.id === selectedFixtureId) ?? null,
    [fixtures, selectedFixtureId]
  );
  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  // Load groups on mount
  useEffect(() => {
    fetch("/api/v1/groups")
      .then((r) => r.json())
      .then(setGroups)
      .catch(() => {});
  }, [setGroups]);

  // Register dimmer channels with universe whenever fixtures change
  useEffect(() => {
    const addrs: number[] = [];
    fixtures.forEach((f) => {
      const chs = getFixtureActiveChannels(f);
      chs.forEach((c, idx) => {
        if (c.capability === "dimmer") addrs.push(f.startAddress + idx);
      });
    });
    if (addrs.length > 0) sendWS({ type: "set_dimmer_channels", addresses: addrs });
  }, [fixtures]);

  const getDimmerChannel = useCallback((fixture: FixtureInstanceData): number | null => {
    const fixtureChannels = getFixtureActiveChannels(fixture);
    const idx = fixtureChannels.findIndex((c) => c.capability === "dimmer");
    if (idx < 0) return null;
    return fixture.startAddress + idx;
  }, []);

  const getFixtureGroup = useCallback(
    (fixtureId: string) => groups.find((g) => g.fixtureIds.includes(fixtureId)) ?? null,
    [groups]
  );

  // DCA-style dimmer: store the base level, send base * groupLevel / 255
  const handleDimmerChange = useCallback(
    (fixture: FixtureInstanceData, value: number) => {
      setBaseDimmer(fixture.id, value);
      sendWS({ type: "set_base_dimmer", fixtureId: fixture.id, value });
      const dimmerCh = getDimmerChannel(fixture);
      if (dimmerCh === null) return;
      const group = getFixtureGroup(fixture.id);
      const effective = group ? Math.round(value * group.level / 255) : value;
      sendWS({ type: "set_channels", channels: { [dimmerCh]: effective } });
    },
    [getDimmerChannel, getFixtureGroup, setBaseDimmer]
  );

  const handleGroupLevelChange = useCallback(
    (groupId: string, newLevel: number) => {
      updateGroup(groupId, { level: newLevel });
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      const prevLevel = group.level; // old level, before Zustand update settles
      const updates: Record<string, number> = {};
      group.fixtureIds.forEach((fid) => {
        const fixture = fixtures.find((f) => f.id === fid);
        if (!fixture) return;
        const dimmerCh = getDimmerChannel(fixture);
        if (dimmerCh === null) return;
        // If no explicit baseDimmer, reconstruct the true base by reversing the DCA math
        // using the old group level — prevents drift when the DCA is used before any
        // individual fader is touched (channels[dimmerCh-1] is already scaled by prevLevel)
        const base = baseDimmers[fid] ?? (
          prevLevel > 0
            ? Math.round((channels[dimmerCh - 1] ?? 0) * 255 / prevLevel)
            : (channels[dimmerCh - 1] ?? 0)
        );
        updates[dimmerCh] = Math.round(base * newLevel / 255);
      });
      if (Object.keys(updates).length) sendWS({ type: "set_channels", channels: updates });
    },
    [groups, fixtures, baseDimmers, channels, getDimmerChannel, updateGroup]
  );

  const handleGroupLevelCommit = useCallback(
    async (groupId: string, level: number) => {
      await fetch(`/api/v1/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });
    },
    []
  );

  const sendGroupOverrides = useCallback(
    (group: GroupData, overrides: GroupOverrides) => {
      const updates: Record<string, number> = {};
      group.fixtureIds.forEach((fid) => {
        const fixture = fixtures.find((f) => f.id === fid);
        if (!fixture?.profile) return;
        const chs = getFixtureActiveChannels(fixture);
        chs.forEach((ch, i) => {
          const addr = fixture.startAddress + i;
          if (ch.capability === "cct" && overrides.cct !== undefined) updates[addr] = overrides.cct;
          if ((ch.capability === "greenOffset" || ch.capability === "greenOffsetLinear") && overrides.greenOffset !== undefined) updates[addr] = overrides.greenOffset;
          if (ch.capability === "crossFade" && overrides.crossFade !== undefined) updates[addr] = overrides.crossFade;
          if (ch.capability === "fan" && overrides.fan !== undefined) updates[addr] = overrides.fan;
          if (overrides.color) {
            const r = parseInt(overrides.color.slice(1, 3), 16);
            const g = parseInt(overrides.color.slice(3, 5), 16);
            const b = parseInt(overrides.color.slice(5, 7), 16);
            if (ch.capability === "red") updates[addr] = r;
            if (ch.capability === "green") updates[addr] = g;
            if (ch.capability === "blue") updates[addr] = b;
          }
        });
      });
      if (Object.keys(updates).length) sendWS({ type: "set_channels", channels: updates });
    },
    [fixtures]
  );

  const handleGroupOverrideChange = useCallback(
    async (groupId: string, overrides: GroupOverrides) => {
      updateGroup(groupId, { overrides });
      const group = groups.find((g) => g.id === groupId);
      if (group) sendGroupOverrides({ ...group, overrides }, overrides);
      await fetch(`/api/v1/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides }),
      });
    },
    [groups, updateGroup, sendGroupOverrides]
  );

  const createGroup = useCallback(async () => {
    const name = `DCD ${groups.length + 1}`;
    const res = await fetch("/api/v1/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const g = await res.json();
      setGroups([...groups, g]);
      setSelectedGroupId(g.id);
    }
  }, [groups, setGroups]);

  const deleteGroup = useCallback(
    async (groupId: string) => {
      await fetch(`/api/v1/groups/${groupId}`, { method: "DELETE" });
      setGroups(groups.filter((g) => g.id !== groupId));
      if (selectedGroupId === groupId) setSelectedGroupId(null);
    },
    [groups, setGroups, selectedGroupId]
  );

  const toggleFixtureInGroup = useCallback(
    async (groupId: string, fixtureId: string) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      const next = group.fixtureIds.includes(fixtureId)
        ? group.fixtureIds.filter((id) => id !== fixtureId)
        : [...group.fixtureIds, fixtureId];
      updateGroup(groupId, { fixtureIds: next });
      await fetch(`/api/v1/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureIds: next }),
      });
    },
    [groups, updateGroup]
  );

  const handleToggle = useCallback((_fixture: FixtureInstanceData) => {
    /* handled inside FixtureStrip via onDimmerChange */
  }, []);

  const handleSolo = useCallback(
    (fixture: FixtureInstanceData) => {
      if (soloedFixtureId === fixture.id) {
        setSoloedFixtureId(null);
        const restore: Record<string, number> = {};
        Object.entries(preSoloValues.current).forEach(([ch, val]) => { restore[ch] = val; });
        sendWS({ type: "set_channels", channels: restore });
        preSoloValues.current = {};
      } else {
        const saved: Record<string, number> = {};
        const zeros: Record<string, number> = {};
        fixtures.forEach((f) => {
          if (f.id === fixture.id) return;
          const dimmerCh = getDimmerChannel(f);
          if (dimmerCh !== null) {
            saved[dimmerCh] = channels[dimmerCh - 1] ?? 0;
            zeros[dimmerCh] = 0;
          }
        });
        preSoloValues.current = saved;
        setSoloedFixtureId(fixture.id);
        sendWS({ type: "set_channels", channels: zeros });
      }
    },
    [soloedFixtureId, fixtures, channels, getDimmerChannel]
  );

  const handleSelect = useCallback((fixture: FixtureInstanceData) => {
    setSelectedGroupId(null);
    setSelectedFixtureId((prev) => (prev === fixture.id ? null : fixture.id));
  }, []);

  const handleChannelChange = useCallback((address: number, value: number) => {
    sendWS({ type: "set_channels", channels: { [address]: value } });
  }, []);

  const handleBlackout = useCallback(() => {
    if (isBlackout) {
      // Release: restore pre-blackout GM
      setIsBlackout(false);
      const restored = preBlackoutGM.current;
      setGrandMaster(restored);
      sendWS({ type: "grand_master", value: restored });
    } else {
      // Activate: save GM, drop to 0
      preBlackoutGM.current = grandMaster;
      setIsBlackout(true);
      setSoloedFixtureId(null);
      preSoloValues.current = {};
      setGrandMaster(0);
      sendWS({ type: "grand_master", value: 0 });
    }
  }, [isBlackout, grandMaster, setGrandMaster]);

  const handleBlackoutExit = useCallback(() => {
    setIsBlackout(false);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fixtures.findIndex((f) => f.id === active.id);
    const newIndex = fixtures.findIndex((f) => f.id === over.id);
    const reordered = arrayMove([...fixtures], oldIndex, newIndex);
    setFixtures(reordered);
    await fetch("/api/v1/fixtures/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reordered.map((f, i) => ({ id: f.id, sortOrder: i }))),
    });
  }, [fixtures, setFixtures]);

  if (fixtures.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 text-muted-foreground">
        <p className="text-sm">No fixtures patched yet.</p>
        <Link href="/routing">
          <Button size="sm" variant="outline" className="gap-1">
            Go to Routing <ChevronRight size={14} />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <h1 className="text-sm font-semibold text-muted-foreground">Faders</h1>
        {soloedFixtureId && (
          <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 rounded px-2 py-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs text-amber-400 font-medium">SOLO ACTIVE</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isBlackout && (
            <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/40 rounded px-2 py-0.5 blackout-active">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="text-xs text-red-400 font-medium">BLACKOUT</span>
            </div>
          )}
          <Button
            variant="destructive"
            size="sm"
            className={`h-7 text-xs font-bold gap-1.5${isBlackout ? " blackout-active" : ""}`}
            onClick={handleBlackout}
          >
            <ZapOff size={12} />
            {isBlackout ? "RESTORE" : "BLACKOUT"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <GrandMasterFader
          isBlackout={isBlackout}
          onBlackoutExit={handleBlackoutExit}
          groupsCollapsed={groupsCollapsed}
          onToggleGroups={() => setGroupsCollapsed((c) => !c)}
        />

        {/* DCD group faders — left of fixture strips */}
        {groups.length > 0 && !groupsCollapsed && (
          <div className="flex border-r-2 border-primary/30 shrink-0">
            {groups.map((group) => (
              <GroupFader
                key={group.id}
                group={group}
                isSelected={selectedGroupId === group.id}
                onLevelChange={handleGroupLevelChange}
                onLevelCommit={handleGroupLevelCommit}
                onSelect={() => {
                  setSelectedFixtureId(null);
                  setSelectedGroupId((prev) => (prev === group.id ? null : group.id));
                }}
              />
            ))}
            <button
              onClick={createGroup}
              className="flex items-center justify-center w-8 h-full text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors"
              title="Add DCD group"
            >
              <Plus size={14} />
            </button>
          </div>
        )}

        {/* Add first group button when none exist */}
        {groups.length === 0 && !groupsCollapsed && (
          <button
            onClick={createGroup}
            className="flex flex-col items-center justify-center gap-1 w-12 h-full border-r border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors text-[10px]"
            title="Create a DCD group"
          >
            <Plus size={12} />
            <span>DCD</span>
          </button>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fixtures.map((f) => f.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex flex-1 min-w-0 overflow-x-auto overflow-y-hidden">
              {fixtures.map((fixture) => {
                const fixtureGroup = getFixtureGroup(fixture.id);
                if (fixture.channelBreakout) {
                  const fixtureChannels = getFixtureActiveChannels(fixture);
                  return (
                    <SortableFixtureWrapper key={fixture.id} id={fixture.id}>
                      <div className="flex flex-1 min-h-0">
                        {fixtureChannels.map((ch, i) => (
                          <ChannelStrip
                            key={`${fixture.id}-ch${i}`}
                            address={fixture.startAddress + i}
                            value={channels[fixture.startAddress + i - 1] ?? 0}
                            channelName={ch.name}
                            fixtureName={fixture.name}
                            fixtureColor={fixture.color}
                            onChange={handleChannelChange}
                          />
                        ))}
                      </div>
                    </SortableFixtureWrapper>
                  );
                }
                return (
                  <SortableFixtureWrapper key={fixture.id} id={fixture.id}>
                    <FixtureStrip
                      fixture={fixture}
                      channels={channels}
                      isSoloed={soloedFixtureId === fixture.id}
                      isSelected={selectedFixtureId === fixture.id}
                      onDimmerChange={(val) => handleDimmerChange(fixture, val)}
                      onToggle={() => handleToggle(fixture)}
                      onSolo={() => handleSolo(fixture)}
                      onSelect={() => handleSelect(fixture)}
                      groupColor={fixtureGroup?.color}
                    />
                  </SortableFixtureWrapper>
                );
              })}
              <div className="flex-1 min-w-8" />
            </div>
          </SortableContext>
        </DndContext>

        {/* Right panel: group editor OR fixture controls */}
        {(selectedGroup || selectedFixture) && (
          <div className="w-72 border-l border-border flex flex-col shrink-0">
            {selectedGroup ? (
              <GroupEditPanel
                key={selectedGroup.id}
                group={selectedGroup}
                fixtures={fixtures}
                allGroups={groups}
                onRename={async (name) => {
                  updateGroup(selectedGroup.id, { name });
                  await fetch(`/api/v1/groups/${selectedGroup.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name }),
                  });
                }}
                onOverrideChange={(overrides) => handleGroupOverrideChange(selectedGroup.id, overrides)}
                onToggleFixture={(fid) => toggleFixtureInGroup(selectedGroup.id, fid)}
                onDelete={() => deleteGroup(selectedGroup.id)}
                onClose={() => setSelectedGroupId(null)}
              />
            ) : selectedFixture ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: selectedFixture.color }} />
                  <span className="text-sm font-semibold flex-1 truncate">{selectedFixture.name}</span>
                  <button
                    onClick={() => setSelectedFixtureId(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-3">
                    <FixtureControls fixture={selectedFixture} />
                  </div>
                </ScrollArea>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
