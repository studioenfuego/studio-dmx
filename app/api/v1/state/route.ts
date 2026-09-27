import { prisma } from "@/lib/db";
import { universe } from "@/lib/dmx/universe";
import { serverBaseDimmers } from "@/lib/wsServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const [fixtures, groups, scenes] = await Promise.all([
    prisma.fixtureInstance.findMany({ include: { profile: true }, orderBy: { sortOrder: "asc" } }),
    prisma.group.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.scene.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const gm = universe.getGrandMaster();

  const fixtureStates = fixtures.map((f) => {
    const chs: { name: string; capability: string }[] = JSON.parse(f.profile.channels);
    const ms: { channels: string[] }[] = JSON.parse(f.profile.modes);
    const modeChannels = ms[f.modeIndex]?.channels ?? chs.map((c) => c.name);
    const dimmerIdx = modeChannels.findIndex((name) => chs.find((c) => c.name === name)?.capability === "dimmer");
    const dimmerAddr = dimmerIdx >= 0 ? f.startAddress + dimmerIdx : null;
    const dimmer = dimmerAddr !== null ? universe.getChannel(dimmerAddr) : null;
    const base = serverBaseDimmers.get(f.id) ?? dimmer;
    return {
      id: f.id,
      name: f.name,
      startAddress: f.startAddress,
      dimmer,
      dimmerPercent: dimmer !== null ? Math.round((dimmer / 255) * 100) : null,
      baseDimmer: base,
    };
  });

  const groupStates = groups.map((g) => ({
    id: g.id,
    name: g.name,
    level: g.level,
    levelPercent: Math.round((g.level / 255) * 100),
  }));

  return Response.json({
    grandMaster: gm,
    grandMasterPercent: Math.round((gm / 255) * 100),
    fixtures: fixtureStates,
    groups: groupStates,
    scenes: scenes.map((s) => ({ id: s.id, name: s.name })),
  });
}
