import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { universe } from "@/lib/dmx/universe";
import { broadcast, serverBaseDimmers } from "@/lib/wsServer";

export const dynamic = "force-dynamic";

function pctToVal(body: Record<string, unknown>, key = "value", pctKey = "percent"): number | null {
  if (typeof body[key] === "number") return Math.round(Math.max(0, Math.min(255, body[key] as number)));
  if (typeof body[pctKey] === "number") return Math.round(Math.max(0, Math.min(1, (body[pctKey] as number) / 100)) * 255);
  return null;
}

// Find the 0-indexed position of the dimmer channel within a fixture's active mode
function dimmerChannelIndex(channels: string, modes: string, modeIndex: number): number {
  const chs: { name: string; capability: string }[] = JSON.parse(channels);
  const ms: { channels: string[] }[] = JSON.parse(modes);
  const modeChannels = ms[modeIndex]?.channels ?? chs.map((c) => c.name);
  return modeChannels.findIndex((name) => {
    const def = chs.find((c) => c.name === name);
    return def?.capability === "dimmer";
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const action = body.action as string | undefined;

  // ── SCENE ────────────────────────────────────────────────────────────────
  if (action === "scene") {
    const fadeTime = typeof body.fadeTime === "number" ? body.fadeTime : undefined;
    let scene = null;

    if (typeof body.id === "string") {
      scene = await prisma.scene.findUnique({ where: { id: body.id } });
    } else if (typeof body.name === "string") {
      scene = await prisma.scene.findFirst({ where: { name: { equals: body.name } } });
    }

    if (!scene) return Response.json({ ok: false, error: "Scene not found" }, { status: 404 });

    const fadeMs = fadeTime ?? scene.fadeIn;
    await universe.fadeToScene(JSON.parse(scene.values) as Record<string, number>, fadeMs);
    broadcast({ type: "scene_recalled", sceneId: scene.id, name: scene.name });
    return Response.json({ ok: true, action: "scene", scene: scene.name });
  }

  // ── DIMMER ───────────────────────────────────────────────────────────────
  if (action === "dimmer") {
    const val = pctToVal(body);
    if (val === null) return Response.json({ ok: false, error: "Provide value (0-255) or percent (0-100)" }, { status: 400 });

    let fixture = null;
    if (typeof body.id === "string") {
      fixture = await prisma.fixtureInstance.findUnique({ where: { id: body.id }, include: { profile: true } });
    } else if (typeof body.fixture === "string") {
      fixture = await prisma.fixtureInstance.findFirst({ where: { name: { equals: body.fixture } }, include: { profile: true } });
    }

    if (!fixture) return Response.json({ ok: false, error: "Fixture not found" }, { status: 404 });

    const idx = dimmerChannelIndex(fixture.profile.channels, fixture.profile.modes, fixture.modeIndex);
    if (idx < 0) return Response.json({ ok: false, error: "Fixture has no dimmer channel" }, { status: 400 });

    const address = fixture.startAddress + idx;
    serverBaseDimmers.set(fixture.id, val);
    universe.setChannel(address, val);
    broadcast({ type: "base_dimmer", fixtureId: fixture.id, value: val });
    return Response.json({ ok: true, action: "dimmer", fixture: fixture.name, address, value: val });
  }

  // ── GRAND MASTER ─────────────────────────────────────────────────────────
  if (action === "grandMaster" || action === "grand-master") {
    const val = pctToVal(body);
    if (val === null) return Response.json({ ok: false, error: "Provide value (0-255) or percent (0-100)" }, { status: 400 });
    universe.setGrandMaster(val);
    broadcast({ type: "grand_master", value: val });
    return Response.json({ ok: true, action: "grandMaster", value: val });
  }

  // ── BLACKOUT ─────────────────────────────────────────────────────────────
  if (action === "blackout") {
    universe.blackout();
    broadcast({ type: "blackout" });
    return Response.json({ ok: true, action: "blackout" });
  }

  // ── GROUP LEVEL ───────────────────────────────────────────────────────────
  if (action === "group") {
    const level = pctToVal(body, "level", "levelPercent");
    if (level === null) return Response.json({ ok: false, error: "Provide level (0-255) or levelPercent (0-100)" }, { status: 400 });

    let group = null;
    if (typeof body.id === "string") {
      group = await prisma.group.findUnique({ where: { id: body.id } });
    } else if (typeof body.name === "string") {
      group = await prisma.group.findFirst({ where: { name: { equals: body.name } } });
    }

    if (!group) return Response.json({ ok: false, error: "Group not found" }, { status: 404 });

    // Apply DCA: scale each fixture's base dimmer by the new group level
    const fixtureIds: string[] = JSON.parse(group.fixtureIds);
    const fixtures = await prisma.fixtureInstance.findMany({
      where: { id: { in: fixtureIds } },
      include: { profile: true },
    });

    const channelUpdates: Record<string, number> = {};
    for (const f of fixtures) {
      const idx = dimmerChannelIndex(f.profile.channels, f.profile.modes, f.modeIndex);
      if (idx < 0) continue;
      const base = serverBaseDimmers.get(f.id) ?? universe.getChannel(f.startAddress + idx);
      channelUpdates[f.startAddress + idx] = Math.round(base * level / 255);
    }

    await prisma.group.update({ where: { id: group.id }, data: { level } });
    universe.setChannels(channelUpdates);
    broadcast({ type: "groups_updated", groups: [] }); // clients re-fetch
    return Response.json({ ok: true, action: "group", group: group.name, level });
  }

  return Response.json(
    { ok: false, error: `Unknown action "${action}". Valid: scene, dimmer, grandMaster, blackout, group` },
    { status: 400 }
  );
}
