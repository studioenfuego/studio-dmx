import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { broadcast } from "@/lib/wsServer";
import type { FixtureProfileData } from "@/lib/types";

export const dynamic = "force-dynamic";

function serializeFixture(f: Parameters<typeof broadcast>[0] extends { fixtures: infer A } ? A extends (infer B)[] ? B : never : never) {
  return f;
}
void serializeFixture;

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
    } as FixtureProfileData,
  };
}

export async function GET() {
  const fixtures = await prisma.fixtureInstance.findMany({
    include: { profile: true },
    orderBy: { sortOrder: "asc" },
  });
  return Response.json(fixtures.map(toFixtureShape));
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    name: string; profileId: string; startAddress: number;
    modeIndex?: number; positionX?: number; positionY?: number; group?: string; color?: string;
  };

  const count = await prisma.fixtureInstance.count();
  const fixture = await prisma.fixtureInstance.create({
    data: {
      name: body.name, profileId: body.profileId, startAddress: body.startAddress,
      modeIndex: body.modeIndex ?? 0, positionX: body.positionX ?? 0, positionY: body.positionY ?? 0,
      group: body.group, color: body.color ?? "#3b82f6", sortOrder: count,
    },
    include: { profile: true },
  });

  const allFixtures = await prisma.fixtureInstance.findMany({ include: { profile: true }, orderBy: { startAddress: "asc" } });
  broadcast({ type: "fixtures_updated", fixtures: allFixtures.map(toFixtureShape) });

  return Response.json(toFixtureShape(fixture), { status: 201 });
}
