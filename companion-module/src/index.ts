import {
  InstanceBase,
  InstanceStatus,
  type SomeCompanionConfigField,
  type CompanionVariableDefinitions,
  type CompanionVariableValues,
  type CompanionActionDefinitions,
  type CompanionFeedbackDefinitions,
} from "@companion-module/base";

// ── Types ──────────────────────────────────────────────────────────────────

interface Config {
  host: string;
  port: number;
}

interface StateFixture {
  id: string;
  name: string;
  dimmer: number | null;
  dimmerPercent: number | null;
}

interface StateGroup {
  id: string;
  name: string;
  level: number;
  levelPercent: number;
}

interface StateScene {
  id: string;
  name: string;
}

interface AppState {
  grandMaster: number;
  grandMasterPercent: number;
  fixtures: StateFixture[];
  groups: StateGroup[];
  scenes: StateScene[];
}

// ── Module ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default class StudioDMXInstance extends InstanceBase<any> {
  private cfg: Config = { host: "localhost", port: 3333 };
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private state: AppState = {
    grandMaster: 255,
    grandMasterPercent: 100,
    fixtures: [],
    groups: [],
    scenes: [],
  };

  // ── Lifecycle ────────────────────────────────────────────────────────────

  async init(config: Config): Promise<void> {
    this.cfg = config;
    this.updateStatus(InstanceStatus.Connecting);
    this.setVariableDefinitions({ grand_master_percent: { name: "Grand Master %" }, grand_master_value: { name: "Grand Master (0-255)" } });
    this.setVariableValues({ grand_master_percent: 0, grand_master_value: 0 });
    await this.refreshState();
    this.startPolling();
  }

  async destroy(): Promise<void> {
    this.stopPolling();
  }

  async configUpdated(config: Config): Promise<void> {
    this.cfg = config;
    this.stopPolling();
    this.updateStatus(InstanceStatus.Connecting);
    await this.refreshState();
    this.startPolling();
  }

  getConfigFields(): SomeCompanionConfigField[] {
    return [
      {
        type: "textinput",
        id: "host",
        label: "Host",
        default: "localhost",
        width: 8,
      },
      {
        type: "number",
        id: "port",
        label: "Port",
        default: 3333,
        min: 1,
        max: 65535,
        width: 4,
      },
    ];
  }

  // ── Polling ───────────────────────────────────────────────────────────────

  private startPolling(): void {
    this.pollTimer = setInterval(() => void this.refreshState(), 5000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private baseUrl(): string {
    return `http://${this.cfg.host}:${this.cfg.port}`;
  }

  private async refreshState(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl()}/api/v1/state`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.state = (await res.json()) as AppState;
      this.updateStatus(InstanceStatus.Ok);
      this.syncVariables();
      this.checkAllFeedbacks();
      this.setActionDefinitions(this.buildActions());
      this.setFeedbackDefinitions(this.buildFeedbacks());
    } catch (e) {
      this.updateStatus(InstanceStatus.ConnectionFailure, String(e));
    }
  }

  private async post(action: string, extra: Record<string, unknown>): Promise<void> {
    await fetch(`${this.baseUrl()}/api/v1/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    await this.refreshState();
  }

  // ── Variables ─────────────────────────────────────────────────────────────

  private syncVariables(): void {
    const defs: CompanionVariableDefinitions<CompanionVariableValues> = {
      grand_master_percent: { name: "Grand Master %" },
      grand_master_value: { name: "Grand Master (0-255)" },
    };
    for (const f of this.state.fixtures) {
      defs[`fixture_${slug(f.name)}_dimmer_percent`] = { name: `${f.name} Dimmer %` };
    }
    for (const g of this.state.groups) {
      defs[`group_${slug(g.name)}_level_percent`] = { name: `${g.name} Level %` };
    }
    this.setVariableDefinitions(defs);

    const vals: CompanionVariableValues = {
      grand_master_percent: this.state.grandMasterPercent,
      grand_master_value: this.state.grandMaster,
    };
    for (const f of this.state.fixtures) {
      vals[`fixture_${slug(f.name)}_dimmer_percent`] = f.dimmerPercent ?? 0;
    }
    for (const g of this.state.groups) {
      vals[`group_${slug(g.name)}_level_percent`] = g.levelPercent;
    }
    this.setVariableValues(vals);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  private buildActions(): CompanionActionDefinitions {
    const sceneChoices = this.state.scenes.map((s) => ({ id: s.name, label: s.name }));
    const fixtureChoices = this.state.fixtures.map((f) => ({ id: f.name, label: f.name }));
    const groupChoices = this.state.groups.map((g) => ({ id: g.name, label: g.name }));

    return {
      recall_scene: {
        name: "Recall Scene",
        options: [
          {
            type: "dropdown",
            id: "name",
            label: "Scene",
            choices: sceneChoices,
            default: sceneChoices[0]?.id ?? "",
          },
          { type: "number", id: "fadeTime", label: "Fade time (ms)", default: 0, min: 0, max: 60000 },
        ],
        callback: async (action) => {
          await this.post("scene", { name: action.options["name"], fadeTime: action.options["fadeTime"] });
        },
      },

      set_fixture_dimmer: {
        name: "Set Fixture Dimmer",
        options: [
          {
            type: "dropdown",
            id: "fixture",
            label: "Fixture",
            choices: fixtureChoices,
            default: fixtureChoices[0]?.id ?? "",
          },
          { type: "number", id: "percent", label: "Level %", default: 100, min: 0, max: 100 },
        ],
        callback: async (action) => {
          await this.post("dimmer", { fixture: action.options["fixture"], percent: action.options["percent"] });
        },
      },

      set_grand_master: {
        name: "Set Grand Master",
        options: [
          { type: "number", id: "percent", label: "Level %", default: 100, min: 0, max: 100 },
        ],
        callback: async (action) => {
          await this.post("grandMaster", { percent: action.options["percent"] });
        },
      },

      blackout: {
        name: "Blackout",
        options: [],
        callback: async () => {
          await this.post("blackout", {});
        },
      },

      set_group_level: {
        name: "Set Group Level",
        options: [
          {
            type: "dropdown",
            id: "name",
            label: "Group",
            choices: groupChoices,
            default: groupChoices[0]?.id ?? "",
          },
          { type: "number", id: "levelPercent", label: "Level %", default: 100, min: 0, max: 100 },
        ],
        callback: async (action) => {
          await this.post("group", { name: action.options["name"], levelPercent: action.options["levelPercent"] });
        },
      },

      // ── Knob / encoder adjust actions ────────────────────────────────────

      adjust_grand_master: {
        name: "Adjust Grand Master (knob)",
        options: [
          { type: "number", id: "step", label: "Step % (use negative to decrease)", default: 5, min: -100, max: 100 },
        ],
        callback: async (action) => {
          const step = action.options["step"] as number;
          const next = clamp(this.state.grandMasterPercent + step, 0, 100);
          await this.post("grandMaster", { percent: next });
        },
      },

      adjust_fixture_dimmer: {
        name: "Adjust Fixture Dimmer (knob)",
        options: [
          {
            type: "dropdown",
            id: "fixture",
            label: "Fixture",
            choices: fixtureChoices,
            default: fixtureChoices[0]?.id ?? "",
          },
          { type: "number", id: "step", label: "Step % (use negative to decrease)", default: 5, min: -100, max: 100 },
        ],
        callback: async (action) => {
          const step = action.options["step"] as number;
          const f = this.state.fixtures.find((x) => x.name === action.options["fixture"]);
          const next = clamp((f?.dimmerPercent ?? 0) + step, 0, 100);
          await this.post("dimmer", { fixture: action.options["fixture"], percent: next });
        },
      },

      adjust_group_level: {
        name: "Adjust Group Level (knob)",
        options: [
          {
            type: "dropdown",
            id: "name",
            label: "Group",
            choices: groupChoices,
            default: groupChoices[0]?.id ?? "",
          },
          { type: "number", id: "step", label: "Step % (use negative to decrease)", default: 5, min: -100, max: 100 },
        ],
        callback: async (action) => {
          const step = action.options["step"] as number;
          const g = this.state.groups.find((x) => x.name === action.options["name"]);
          const next = clamp((g?.levelPercent ?? 0) + step, 0, 100);
          await this.post("group", { name: action.options["name"], levelPercent: next });
        },
      },
    };
  }

  // ── Feedbacks ─────────────────────────────────────────────────────────────

  private buildFeedbacks(): CompanionFeedbackDefinitions {
    const fixtureChoices = this.state.fixtures.map((f) => ({ id: f.name, label: f.name }));
    const groupChoices = this.state.groups.map((g) => ({ id: g.name, label: g.name }));

    return {
      fixture_on: {
        type: "boolean",
        name: "Fixture is On",
        description: "True when fixture dimmer is above threshold",
        defaultStyle: { bgcolor: 0x00aa00, color: 0xffffff },
        options: [
          {
            type: "dropdown",
            id: "fixture",
            label: "Fixture",
            choices: fixtureChoices,
            default: fixtureChoices[0]?.id ?? "",
          },
          { type: "number", id: "threshold", label: "Min % to be 'on'", default: 1, min: 0, max: 100 },
        ],
        callback: (feedback) => {
          const f = this.state.fixtures.find((x) => x.name === feedback.options["fixture"]);
          return (f?.dimmerPercent ?? 0) >= (feedback.options["threshold"] as number);
        },
      },

      grand_master_level: {
        type: "boolean",
        name: "Grand Master at level",
        description: "True when grand master is at or above threshold",
        defaultStyle: { bgcolor: 0x0044cc, color: 0xffffff },
        options: [
          { type: "number", id: "threshold", label: "Min %", default: 100, min: 0, max: 100 },
        ],
        callback: (feedback) => {
          return this.state.grandMasterPercent >= (feedback.options["threshold"] as number);
        },
      },

      group_active: {
        type: "boolean",
        name: "Group is Active",
        description: "True when group level is above threshold",
        defaultStyle: { bgcolor: 0x884400, color: 0xffffff },
        options: [
          {
            type: "dropdown",
            id: "name",
            label: "Group",
            choices: groupChoices,
            default: groupChoices[0]?.id ?? "",
          },
          { type: "number", id: "threshold", label: "Min % to be 'active'", default: 1, min: 0, max: 100 },
        ],
        callback: (feedback) => {
          const g = this.state.groups.find((x) => x.name === feedback.options["name"]);
          return (g?.levelPercent ?? 0) >= (feedback.options["threshold"] as number);
        },
      },
    };
  }
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
