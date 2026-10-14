"use client";

import { useState, useCallback } from "react";
import { useDMXStore } from "@/lib/store";
import { sendWS } from "@/lib/wsClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Play, Edit, Trash2, Clock, Copy } from "lucide-react";
import type { SceneData } from "@/lib/types";
import Link from "next/link";

export default function PresetsPage() {
  const { scenes, setScenes, channels, currentSceneId, setCurrentScene } = useDMXStore();
  const [newSceneName, setNewSceneName] = useState("");
  const [fadeTime, setFadeTime] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedScene = scenes.find((s) => s.id === selectedId) ?? null;

  const recordScene = useCallback(async () => {
    const name = newSceneName.trim() || `Scene ${scenes.length + 1}`;
    const values: Record<string, number> = {};
    channels.forEach((v, i) => { values[i + 1] = v; });

    const res = await fetch("/api/v1/scenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, values, fadeIn: fadeTime }),
    });
    if (res.ok) {
      const scene: SceneData = await res.json();
      setScenes([...scenes, scene]);
      setNewSceneName("");
    }
  }, [channels, scenes, setScenes, newSceneName, fadeTime]);

  const recallScene = useCallback(async (scene: SceneData) => {
    setCurrentScene(scene.id);
    sendWS({ type: "recall_scene", sceneId: scene.id, fadeTime });
    await fetch(`/api/v1/scenes/${scene.id}/recall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fadeTime }),
    });
  }, [fadeTime, setCurrentScene]);

  const deleteScene = useCallback(async (id: string) => {
    await fetch(`/api/v1/scenes/${id}`, { method: "DELETE" });
    setScenes(scenes.filter((s) => s.id !== id));
    setSelectedId(null);
  }, [scenes, setScenes]);

  const duplicateScene = useCallback(async (scene: SceneData) => {
    const res = await fetch("/api/v1/scenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${scene.name} (copy)`,
        values: scene.values,
        fadeIn: scene.fadeIn,
        fadeOut: scene.fadeOut,
      }),
    });
    if (res.ok) {
      const newScene: SceneData = await res.json();
      setScenes([...scenes, newScene]);
      setSelectedId(newScene.id);
    }
  }, [scenes, setScenes]);

  const activeChannelCount = (scene: SceneData) =>
    Object.values(scene.values).filter((v) => v > 0).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-base font-semibold">Presets</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Clock size={13} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Fade:</span>
            <Input
              type="number"
              min={0}
              step={100}
              value={fadeTime}
              onChange={(e) => setFadeTime(parseInt(e.target.value) || 0)}
              className="h-7 w-20 text-xs font-mono"
            />
            <span className="text-xs text-muted-foreground">ms</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-2">
          <Input
            placeholder="New scene name..."
            value={newSceneName}
            onChange={(e) => setNewSceneName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") recordScene(); }}
            className="h-8 text-sm flex-1"
          />
          <Button onClick={recordScene} size="sm" className="h-8 gap-1">
            <Plus size={14} />
            Record Current State
          </Button>
        </div>
      </div>

      {/* Action bar — shown when a preset is selected */}
      {selectedScene && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/50 shrink-0">
          <span className="text-xs font-medium truncate max-w-[140px]">{selectedScene.name}</span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant="default"
              className="h-7 gap-1.5 text-xs"
              onClick={() => recallScene(selectedScene)}
            >
              <Play size={11} />
              Recall
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={() => duplicateScene(selectedScene)}
            >
              <Copy size={11} />
              Duplicate
            </Button>
            <Link href={`/presets/${selectedScene.id}/edit`}>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                <Edit size={11} />
                Edit
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
              onClick={() => deleteScene(selectedScene.id)}
            >
              <Trash2 size={11} />
              Delete
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4">
          {scenes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm">No scenes saved yet.</p>
              <p className="text-xs mt-1">Use the faders to set a look, then record it above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {scenes.map((scene) => {
                const isActive = scene.id === currentSceneId;
                const isSelected = scene.id === selectedId;
                const channelCount = activeChannelCount(scene);
                const previewColors = Object.entries(scene.values)
                  .filter(([, v]) => v > 0)
                  .slice(0, 8)
                  .map(([, v]) => v);

                return (
                  <Card
                    key={scene.id}
                    className={`p-3 cursor-pointer transition-all select-none ${
                      isSelected
                        ? "border-primary ring-2 ring-primary"
                        : isActive
                        ? "border-primary ring-1 ring-primary/50"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedId(isSelected ? null : scene.id)}
                  >
                    <div className="flex gap-0.5 mb-2 h-6">
                      {previewColors.length > 0 ? (
                        previewColors.map((v, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-sm"
                            style={{
                              background: `oklch(${0.3 + (v / 255) * 0.5} 0.1 260)`,
                            }}
                          />
                        ))
                      ) : (
                        <div className="flex-1 rounded-sm bg-muted" />
                      )}
                    </div>

                    <div className="font-medium text-xs truncate">{scene.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {channelCount} channels
                      {scene.fadeIn > 0 && ` · ${scene.fadeIn}ms`}
                    </div>

                    {isActive && (
                      <Badge className="absolute top-2 right-2 text-[9px] px-1 py-0 h-4">
                        Active
                      </Badge>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
