"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDMXStore } from "@/lib/store";
import { sendWS } from "@/lib/wsClient";
import { ChannelFader } from "@/components/faders/ChannelFader";
import { GrandMasterFader } from "@/components/faders/GrandMasterFader";
import { FixtureControls } from "@/components/faders/FixtureControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Play, ZapOff } from "lucide-react";
import type { SceneData } from "@/lib/types";

export default function PresetEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { channels, fixtures, setScenes, scenes, selectedFixtureIds, toggleFixtureSelection } = useDMXStore();
  const [scene, setScene] = useState<SceneData | null>(null);
  const [sceneName, setSceneName] = useState("");
  const [fadeIn, setFadeIn] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/scenes/${id}`)
      .then((r) => r.json())
      .then((s: SceneData) => {
        setScene(s);
        setSceneName(s.name);
        setFadeIn(s.fadeIn);
        sendWS({ type: "set_channels", channels: s.values });
      })
      .catch(() => {});
  }, [id]);

  const handleChannelChange = useCallback((channel: number, value: number) => {
    sendWS({ type: "set_channels", channels: { [channel]: value } });
  }, []);

  const saveScene = useCallback(async () => {
    if (!scene) return;
    setIsSaving(true);
    const values: Record<string, number> = {};
    channels.forEach((v, i) => { if (v > 0) values[i + 1] = v; });

    const res = await fetch(`/api/v1/scenes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: sceneName, values, fadeIn }),
    });
    if (res.ok) {
      const updated: SceneData = await res.json();
      setScene(updated);
      setScenes(scenes.map((s) => (s.id === id ? updated : s)));
    }
    setIsSaving(false);
  }, [scene, channels, id, sceneName, fadeIn, scenes, setScenes]);

  const selectedFixtures = fixtures.filter((f) => selectedFixtureIds.includes(f.id));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => router.push("/presets")}>
          <ArrowLeft size={14} />
          Back
        </Button>
        <Input
          value={sceneName}
          onChange={(e) => setSceneName(e.target.value)}
          className="h-8 text-sm font-medium max-w-48"
          placeholder="Scene name"
        />
        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-xs text-muted-foreground">Fade in:</span>
          <Input
            type="number"
            min={0}
            step={100}
            value={fadeIn}
            onChange={(e) => setFadeIn(parseInt(e.target.value) || 0)}
            className="h-7 w-20 text-xs font-mono"
          />
          <span className="text-xs text-muted-foreground">ms</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => sendWS({ type: "blackout" })}
          >
            <ZapOff size={12} />
            Blackout
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => scene && sendWS({ type: "recall_scene", sceneId: scene.id, fadeTime: 0 })}
          >
            <Play size={12} />
            Preview
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={saveScene}
            disabled={isSaving}
          >
            <Save size={12} />
            {isSaving ? "Saving..." : "Save Scene"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <GrandMasterFader isBlackout={false} onBlackoutExit={() => {}} groupsCollapsed={false} onToggleGroups={() => {}} />

        <ScrollArea className="flex-1">
          <div className="flex flex-wrap gap-2 p-4">
            {Array.from({ length: 512 }, (_, i) => i + 1).map((ch) => (
              <ChannelFader
                key={ch}
                channel={ch}
                value={channels[ch - 1] ?? 0}
                onChange={handleChannelChange}
              />
            ))}
          </div>
        </ScrollArea>

        <div className="w-64 border-l border-border flex flex-col shrink-0">
          <div className="px-4 py-2 border-b border-border">
            <h3 className="text-sm font-semibold">Fixtures</h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {fixtures.map((f) => {
                const active = selectedFixtureIds.includes(f.id);
                return (
                  <div
                    key={f.id}
                    className={`rounded border cursor-pointer px-2 py-1.5 text-xs transition-colors ${
                      active ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground"
                    }`}
                    onClick={() => toggleFixtureSelection(f.id)}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: f.color }} />
                      <span className="font-medium truncate">{f.name}</span>
                      <Badge variant="outline" className="text-[9px] ml-auto">Ch {f.startAddress}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          {selectedFixtures.length > 0 && (
            <>
              <div className="border-t border-border px-4 py-2">
                <h3 className="text-sm font-semibold">Controls</h3>
              </div>
              <ScrollArea className="h-96">
                <div className="p-2 space-y-2">
                  {selectedFixtures.map((f) => (
                    <FixtureControls key={f.id} fixture={f} />
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
