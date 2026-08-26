import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { broadcast } from "@/lib/wsServer";

export const dynamic = "force-dynamic";

function toFixtureShape(f: {
  id: string; name: string; profileId: string; startAddress: number; modeIndex: number;
  positionX: number; positionY: number; iconRotation: number; iconScale: number;
  channelBreakout: boolean; group: string | null; color: string;
  profile: { id: string; name: string; manufacturer: string; oflKey: string | null; icon: string | null; channels: string; modes: string };
}) {
  return {
    id: f.id, name: f.name, profileId: f.profileId, startAddress: f.startAddress,
    modeIndex: f.modeIndex, positionX: f.positionX, positionY: f.positionY,
    iconRotation: f.iconRotation, iconScale: f.iconScale, channelBreakout: f.channelBreakout,
    group: f.group, color: f.color,
    profile: {
      id: f.profile.id, name: f.profile.name, manufacturer: f.profile.manufacturer,
      oflKey: f.profile.oflKey, icon: f.profile.icon,
      channels: JSON.parse(f.profile.channels), modes: JSON.parse(f.profile.modes),
    },
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fixture = await prisma.fixtureInstance.findUnique({ where: { id }, include: { profile: true } });
  if (!fixture) return new Response("Not found", { status: 404 });
  return Response.json(toFixtureShape(fixture));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;

  const fixture = await prisma.fixtureInstance.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name as string }),
      ...(body.startAddress !== undefined && { startAddress: body.startAddress as number }),
      ...(body.modeIndex !== undefined && { modeIndex: body.modeIndex as number }),
      ...(body.positionX !== undefined && { positionX: body.positionX as number }),
      ...(body.positionY !== undefined && { positionY: body.positionY as number }),
      ...(body.iconRotation !== undefined && { iconRotation: body.iconRotation as number }),
      ...(body.iconScale !== undefined && { iconScale: body.iconScale as number }),
      ...(body.channelBreakout !== undefined && { channelBreakout: body.channelBreakout as boolean }),
      ...(body.group !== undefined && { group: body.group as string | null }),
      ...(body.color !== undefined && { color: body.color as string }),
    },
    include: { profile: true },
  });

  const allFixtures = await prisma.fixtureInstance.findMany({ include: { profile: true }, orderBy: { sortOrder: "asc" } });
  broadcast({ type: "fixtures_updated", fixtures: allFixtures.map(toFixtureShape) });

  return Response.json(toFixtureShape(fixture));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.fixtureInstance.delete({ where: { id } });

  const allFixtures = await prisma.fixtureInstance.findMany({ include: { profile: true }, orderBy: { sortOrder: "asc" } });
  broadcast({ type: "fixtures_updated", fixtures: allFixtures.map(toFixtureShape) });

  return new Response(null, { status: 204 });
}
