"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useDMXStore } from "@/lib/store";
import { sendWS } from "@/lib/wsClient";
import { GrandMasterFader } from "@/components/faders/GrandMasterFader";
import { FixtureStrip, getFixtureActiveChannels } from "@/components/faders/FixtureStrip";
import { FixtureControls } from "@/components/faders/FixtureControls";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ZapOff, X, ChevronRight } from "lucide-react";
import type { FixtureInstanceData } from "@/lib/types";
import Link from "next/link";

export default function FadersPage() {
  const { channels, fixtures } = useDMXStore();
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const [soloedFixtureId, setSoloedFixtureId] = useState<string | null>(null);
  const preSoloValues = useRef<Record<string, number>>({});

  const selectedFixture = useMemo(
    () => fixtures.find((f) => f.id === selectedFixtureId) ?? null,
    [fixtures, selectedFixtureId]
  );

  const getDimmerChannel = useCallback((fixture: FixtureInstanceData): number | null => {
    const fixtureChannels = getFixtureActiveChannels(fixture);
    const idx = fixtureChannels.findIndex((c) => c.capability === "dimmer");
    if (idx < 0) return null;
    return fixture.startAddress + idx;
  }, []);

  const handleDimmerChange = useCallback(
    (fixture: FixtureInstanceData, value: number) => {
      const dimmerCh = getDimmerChannel(fixture);
      if (dimmerCh === null) return;
      sendWS({ type: "set_channels", channels: { [dimmerCh]: value } });
    },
    [getDimmerChannel]
  );

  const handleToggle = useCallback((_fixture: FixtureInstanceData) => {
    /* handled inside FixtureStrip via onDimmerChange */
  }, []);

  const handleSolo = useCallback(
    (fixture: FixtureInstanceData) => {
      if (soloedFixtureId === fixture.id) {
        setSoloedFixtureId(null);
        const restore: Record<string, number> = {};
        Object.entries(preSoloValues.current).forEach(([ch, val]) => {
          restore[ch] = val;
        });
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
    setSelectedFixtureId((prev) => (prev === fixture.id ? null : fixture.id));
  }, []);

  const handleBlackout = useCallback(() => {
    setSoloedFixtureId(null);
    preSoloValues.current = {};
    sendWS({ type: "blackout" });
  }, []);

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
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs font-bold gap-1.5"
            onClick={handleBlackout}
          >
            <ZapOff size={12} />
            BLACKOUT
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <GrandMasterFader />

        <div className="flex flex-1 min-w-0 overflow-x-auto overflow-y-hidden">
          {fixtures.map((fixture) => (
            <FixtureStrip
              key={fixture.id}
              fixture={fixture}
              channels={channels}
              isSoloed={soloedFixtureId === fixture.id}
              isSelected={selectedFixtureId === fixture.id}
              onDimmerChange={(val) => handleDimmerChange(fixture, val)}
              onToggle={() => handleToggle(fixture)}
              onSolo={() => handleSolo(fixture)}
              onSelect={() => handleSelect(fixture)}
            />
          ))}
          <div className="flex-1 min-w-8" />
        </div>

        {selectedFixture && (
          <div className="w-72 border-l border-border flex flex-col shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: selectedFixture.color }}
              />
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
          </div>
        )}
      </div>
    </div>
  );
}
