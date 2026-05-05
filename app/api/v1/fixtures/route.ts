import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type { FixtureProfileData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const fixtures = await prisma.fixtureInstance.findMany({
    include: { profile: true },
    orderBy: { startAddress: "asc" },
  });

  return Response.json(
    fixtures.map((f) => ({
      id: f.id,
      name: f.name,
      profileId: f.profileId,
      startAddress: f.startAddress,
      modeIndex: f.modeIndex,
      positionX: f.positionX,
      positionY: f.positionY,
      group: f.group,
      color: f.color,
      profile: {
        id: f.profile.id,
        name: f.profile.name,
        manufacturer: f.profile.manufacturer,
        oflKey: f.profile.oflKey,
        channels: JSON.parse(f.profile.channels),
        modes: JSON.parse(f.profile.modes),
      } as FixtureProfileData,
    }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    name: string;
    profileId: string;
    startAddress: number;
    modeIndex?: number;
    positionX?: number;
    positionY?: number;
    group?: string;
    color?: string;
  };

  const fixture = await prisma.fixtureInstance.create({
    data: {
      name: body.name,
      profileId: body.profileId,
      startAddress: body.startAddress,
      modeIndex: body.modeIndex ?? 0,
      positionX: body.positionX ?? 0,
      positionY: body.positionY ?? 0,
      group: body.group,
      color: body.color ?? "#3b82f6",
    },
    include: { profile: true },
  });

  return Response.json({
    id: fixture.id,
    name: fixture.name,
    profileId: fixture.profileId,
    startAddress: fixture.startAddress,
    modeIndex: fixture.modeIndex,
    positionX: fixture.positionX,
    positionY: fixture.positionY,
    group: fixture.group,
    color: fixture.color,
    profile: {
      id: fixture.profile.id,
      name: fixture.profile.name,
      manufacturer: fixture.profile.manufacturer,
      channels: JSON.parse(fixture.profile.channels),
      modes: JSON.parse(fixture.profile.modes),
    },
  }, { status: 201 });
}
