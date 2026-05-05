import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const GH_RAW = "https://raw.githubusercontent.com/OpenLightingProject/open-fixture-library/master/fixtures";

type Capability = "dimmer" | "red" | "green" | "blue" | "white" | "amber" | "uv"
  | "cct" | "greenOffset" | "crossFade" | "fan"
  | "pan" | "tilt" | "colorWheel" | "gobo" | "strobe" | "zoom" | "focus"
  | "iris" | "frost" | "prism" | "speed" | "effects" | "program"
  | "maintenance" | "noFunction";

function mapOFLCapability(cap: Record<string, unknown> | null | undefined): Capability {
  if (!cap) return "noFunction";
  const type = cap.type as string;
  switch (type) {
    case "Intensity": return "dimmer";
    case "ColorIntensity": {
      const color = ((cap.color as string) ?? "").toLowerCase();
      if (color === "red") return "red";
      if (color === "green") return "green";
      if (color === "blue") return "blue";
      if (color === "white") return "white";
      if (color === "amber") return "amber";
      if (color === "uv") return "uv";
      return "dimmer";
    }
    case "ColorTemperature": return "cct";
    case "Pan": return "pan";
    case "Tilt": return "tilt";
    case "ColorPreset":
    case "ColorWheelRotation":
    case "ColorWheelIndex": return "colorWheel";
    case "GoboIndex":
    case "GoboStencilRotation":
    case "GoboWheelRotation": return "gobo";
    case "ShutterStrobe":
    case "StrobeSpeed":
    case "StrobeDuration":
    case "StrobeFrequency": return "strobe";
    case "BeamAngle":
    case "ZoomAngle": return "zoom";
    case "FocusDistance": return "focus";
    case "IrisAngle": return "iris";
    case "Frost":
    case "FrostSpeed": return "frost";
    case "PrismRotation": return "prism";
    case "Speed": return "speed";
    case "Effect":
    case "EffectSpeed":
    case "EffectParameter": return "effects";
    case "ProgramSpeed":
    case "SoundSensitivity": return "program";
    case "Maintenance":
    case "Generic": return "maintenance";
    default: return "noFunction";
  }
}

function resolveChannelCapability(ch: Record<string, unknown>): Capability {
  if (ch.capability) {
    return mapOFLCapability(ch.capability as Record<string, unknown>);
  }
  if (Array.isArray(ch.capabilities) && ch.capabilities.length > 0) {
    const caps = ch.capabilities as Array<Record<string, unknown>>;
    const nonNone = caps.find((c) => c.type !== "NoFunction");
    return mapOFLCapability(nonNone ?? caps[0]);
  }
  return "noFunction";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.manufacturer || !body?.fixture) {
    return Response.json({ error: "manufacturer and fixture are required" }, { status: 400 });
  }

  const { manufacturer, fixture } = body as { manufacturer: string; fixture: string };

  let oflData: Record<string, unknown>;
  try {
    const res = await fetch(`${GH_RAW}/${manufacturer}/${fixture}.json`, {
      headers: { "User-Agent": "studio-dmx/1.0" },
    });
    if (!res.ok) return Response.json({ error: "Fixture not found on OFL" }, { status: 404 });
    oflData = await res.json();
  } catch {
    return Response.json({ error: "Failed to fetch from OFL" }, { status: 502 });
  }

  const name = (oflData.name as string) ?? fixture;
  const oflKey = `${manufacturer}/${fixture}`;

  const existing = await prisma.fixtureProfile.findUnique({ where: { oflKey } });
  if (existing) {
    return Response.json({ profile: existing, imported: false, message: "Already imported" });
  }

  const availableChannels = (oflData.availableChannels ?? {}) as Record<string, Record<string, unknown>>;
  const oflModes = (oflData.modes ?? []) as Array<{ name: string; channels: Array<string | { insert: string; channelOrder: string[] }> }>;

  const channels = Object.entries(availableChannels).map(([chName, chDef]) => ({
    name: chName,
    capability: resolveChannelCapability(chDef),
  }));

  const modes = oflModes.map((mode) => {
    const channels = mode.channels
      .flatMap((ch) => {
        if (typeof ch === "string") return [ch];
        if (typeof ch === "object" && ch.insert === "matrixChannels") {
          return ch.channelOrder ?? [];
        }
        return [];
      })
      .filter((ch) => availableChannels[ch] !== undefined);
    return { name: mode.name, channelCount: channels.length, channels };
  });

  const manufacturerName = (() => {
    const meta = oflData.meta as Record<string, unknown> | undefined;
    if (meta?.manufacturerName) return meta.manufacturerName as string;
    return manufacturer
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  })();

  const profile = await prisma.fixtureProfile.create({
    data: {
      name,
      manufacturer: manufacturerName,
      oflKey,
      channels: JSON.stringify(channels),
      modes: JSON.stringify(modes),
    },
  });

  return Response.json({
    profile: { ...profile, channels: JSON.parse(profile.channels), modes: JSON.parse(profile.modes) },
    imported: true,
  });
}
