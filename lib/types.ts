export interface ChannelDefinition {
  name: string;
  capability: CapabilityType;
  defaultValue?: number;
  fine?: boolean;
}

export interface ModeDefinition {
  name: string;
  channelCount: number;
  channels: string[];
}

export type CapabilityType =
  | "dimmer"
  | "red"
  | "green"
  | "blue"
  | "white"
  | "amber"
  | "uv"
  | "pan"
  | "panFine"
  | "tilt"
  | "tiltFine"
  | "colorWheel"
  | "goboPrimary"
  | "goboSecondary"
  | "cct"
  | "greenOffset"
  | "crossFade"
  | "fan"
  | "strobe"
  | "zoom"
  | "focus"
  | "iris"
  | "prism"
  | "frost"
  | "speed"
  | "effects"
  | "program"
  | "maintenance"
  | "noFunction";

export interface FixtureProfileData {
  id: string;
  name: string;
  manufacturer: string;
  oflKey?: string | null;
  channels: ChannelDefinition[];
  modes: ModeDefinition[];
}

export interface FixtureInstanceData {
  id: string;
  name: string;
  profileId: string;
  startAddress: number;
  modeIndex: number;
  positionX: number;
  positionY: number;
  group?: string | null;
  color: string;
  profile?: FixtureProfileData;
}

export interface SceneData {
  id: string;
  name: string;
  values: Record<string, number>;
  fadeIn: number;
  fadeOut: number;
  sortOrder: number;
  thumbnail?: string | null;
}

export interface LookData {
  id: string;
  name: string;
  type: "color" | "position" | "beam" | "gobo" | "effect";
  values: Record<string, number>;
}

export interface SettingsData {
  dmxInterface: string;
  artnetHost: string;
  artnetPort: number;
  artnetNet: number;
  artnetSubnet: number;
  artnetUniverse: number;
  grandMaster: number;
}

export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

export interface WSSetChannelsMessage extends WSMessage {
  type: "set_channels";
  channels: Record<string, number>;
}

export interface WSSetFixtureMessage extends WSMessage {
  type: "set_fixture";
  fixtureId: string;
  params: Record<string, number>;
}

export interface WSRecallSceneMessage extends WSMessage {
  type: "recall_scene";
  sceneId: string;
  fadeTime?: number;
}

export interface WSSubscribeMessage extends WSMessage {
  type: "subscribe";
  channels?: number[];
  fixtures?: string[];
}

export interface WSStateMessage extends WSMessage {
  type: "state";
  channels: number[];
}

export interface WSBlackoutMessage extends WSMessage {
  type: "blackout";
}

export interface WSGrandMasterMessage extends WSMessage {
  type: "grand_master";
  value: number;
}
