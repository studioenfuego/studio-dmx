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
          if (Array.isArray(msg.channels)) {
            store.setChannels(msg.channels as number[]);
          }
          if (typeof msg.grandMaster === "number") {
            store.setGrandMaster(msg.grandMaster as number);
          }
          break;
        case "grand_master":
          if (typeof msg.value === "number") {
            store.setGrandMaster(msg.value as number);
          }
          break;
        case "scene_recalled":
          store.setCurrentScene(msg.sceneId as string | null);
          break;
      }
    });

    const offStatus = onWSStatus((connected) => {
      store.setWsConnected(connected);
    });

    async function loadData() {
      try {
        const [fixturesRes, scenesRes, looksRes] = await Promise.all([
          fetch("/api/v1/fixtures"),
          fetch("/api/v1/scenes"),
          fetch("/api/v1/looks"),
        ]);
        if (fixturesRes.ok) store.setFixtures(await fixturesRes.json());
        if (scenesRes.ok) store.setScenes(await scenesRes.json());
        if (looksRes.ok) store.setLooks(await looksRes.json());
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
