import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fixture = await prisma.fixtureInstance.findUnique({
    where: { id },
    include: { profile: true },
  });
  if (!fixture) return new Response("Not found", { status: 404 });
  return Response.json({
    ...fixture,
    profile: {
      ...fixture.profile,
      channels: JSON.parse(fixture.profile.channels),
      modes: JSON.parse(fixture.profile.modes),
    },
  });
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
      ...(body.group !== undefined && { group: body.group as string | null }),
      ...(body.color !== undefined && { color: body.color as string }),
    },
    include: { profile: true },
  });

  return Response.json({
    ...fixture,
    profile: {
      ...fixture.profile,
      channels: JSON.parse(fixture.profile.channels),
      modes: JSON.parse(fixture.profile.modes),
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.fixtureInstance.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
