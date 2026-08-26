"use client";

import { create } from "zustand";
import type {
  FixtureInstanceData,
  FixtureProfileData,
  SceneData,
  LookData,
  SettingsData,
  GroupData,
} from "./types";

export interface DMXStore {
  channels: number[];
  grandMaster: number;
  fixtures: FixtureInstanceData[];
  profiles: FixtureProfileData[];
  scenes: SceneData[];
  looks: LookData[];
  settings: SettingsData | null;
  currentSceneId: string | null;
  selectedFixtureIds: string[];
  wsConnected: boolean;
  groups: GroupData[];
  baseDimmers: Record<string, number>; // fixtureId -> base dimmer 0-255

  setChannels: (channels: number[]) => void;
  setChannel: (address: number, value: number) => void;
  setGrandMaster: (value: number) => void;
  setFixtures: (fixtures: FixtureInstanceData[]) => void;
  setProfiles: (profiles: FixtureProfileData[]) => void;
  setScenes: (scenes: SceneData[]) => void;
  setLooks: (looks: LookData[]) => void;
  setSettings: (settings: SettingsData) => void;
  setCurrentScene: (id: string | null) => void;
  setSelectedFixtures: (ids: string[]) => void;
  toggleFixtureSelection: (id: string) => void;
  setWsConnected: (connected: boolean) => void;
  setGroups: (groups: GroupData[]) => void;
  updateGroup: (id: string, updates: Partial<GroupData>) => void;
  setBaseDimmer: (fixtureId: string, value: number) => void;
}

export const useDMXStore = create<DMXStore>((set) => ({
  channels: new Array(512).fill(0),
  grandMaster: 255,
  fixtures: [],
  profiles: [],
  scenes: [],
  looks: [],
  settings: null,
  currentSceneId: null,
  selectedFixtureIds: [],
  wsConnected: false,
  groups: [],
  baseDimmers: {},

  setChannels: (channels) => set({ channels }),
  setChannel: (address, value) =>
    set((state) => {
      const next = [...state.channels];
      next[address - 1] = Math.max(0, Math.min(255, value));
      return { channels: next };
    }),
  setGrandMaster: (grandMaster) => set({ grandMaster }),
  setFixtures: (fixtures) => set({ fixtures }),
  setProfiles: (profiles) => set({ profiles }),
  setScenes: (scenes) => set({ scenes }),
  setLooks: (looks) => set({ looks }),
  setSettings: (settings) => set({ settings }),
  setCurrentScene: (currentSceneId) => set({ currentSceneId }),
  setSelectedFixtures: (selectedFixtureIds) => set({ selectedFixtureIds }),
  toggleFixtureSelection: (id) =>
    set((state) => ({
      selectedFixtureIds: state.selectedFixtureIds.includes(id)
        ? state.selectedFixtureIds.filter((f) => f !== id)
        : [...state.selectedFixtureIds, id],
    })),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setGroups: (groups) => set({ groups }),
  updateGroup: (id, updates) =>
    set((state) => ({
      groups: state.groups.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    })),
  setBaseDimmer: (fixtureId, value) =>
    set((state) => ({
      baseDimmers: { ...state.baseDimmers, [fixtureId]: value },
    })),
}));
