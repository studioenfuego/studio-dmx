"use client";

import { useEffect } from "react";
import { connectWS, onWSMessage, onWSStatus } from "@/lib/wsClient";
import { useDMXStore } from "@/lib/store";

export function DMXProvider({ children }: { children: React.ReactNode }) {
  const store = useDMXStore();

  useEffect(() => {
    connectWS();

    const offMsg = onWSMessage((msg) => {
      switch (msg.type) {
        case "state":
          if (Array.isArray(msg.channels)) store.setChannels(msg.channels as number[]);
          if (typeof msg.grandMaster === "number") store.setGrandMaster(msg.grandMaster as number);
          if (msg.baseDimmers && typeof msg.baseDimmers === "object") {
            Object.entries(msg.baseDimmers as Record<string, number>).forEach(([fid, val]) =>
              store.setBaseDimmer(fid, val)
            );
          }
          break;
        case "grand_master":
          if (typeof msg.value === "number") store.setGrandMaster(msg.value as number);
          break;
        case "scene_recalled":
          store.setCurrentScene(msg.sceneId as string | null);
          break;
        case "fixtures_updated":
          store.setFixtures(msg.fixtures as Parameters<typeof store.setFixtures>[0]);
          break;
        case "scenes_updated":
          store.setScenes(msg.scenes as Parameters<typeof store.setScenes>[0]);
          break;
        case "looks_updated":
          store.setLooks(msg.looks as Parameters<typeof store.setLooks>[0]);
          break;
        case "groups_updated":
          store.setGroups(msg.groups as Parameters<typeof store.setGroups>[0]);
          break;
        case "base_dimmer":
          store.setBaseDimmer(msg.fixtureId as string, msg.value as number);
          break;
      }
    });

    const offStatus = onWSStatus((connected) => {
      store.setWsConnected(connected);
    });

    async function loadData() {
      try {
        const [fixturesRes, scenesRes, looksRes, groupsRes] = await Promise.all([
          fetch("/api/v1/fixtures"),
          fetch("/api/v1/scenes"),
          fetch("/api/v1/looks"),
          fetch("/api/v1/groups"),
        ]);
        if (fixturesRes.ok) store.setFixtures(await fixturesRes.json());
        if (scenesRes.ok) store.setScenes(await scenesRes.json());
        if (looksRes.ok) store.setLooks(await looksRes.json());
        if (groupsRes.ok) store.setGroups(await groupsRes.json());
      } catch (e) {
        console.error("[DMXProvider] Failed to load data:", e);
      }
    }

    loadData();

    return () => {
      offMsg();
      offStatus();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
