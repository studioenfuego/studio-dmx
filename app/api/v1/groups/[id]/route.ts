import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { broadcast } from "@/lib/wsServer";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;

  const group = await prisma.group.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name as string }),
      ...(body.color !== undefined && { color: body.color as string }),
      ...(body.level !== undefined && { level: body.level as number }),
      ...(body.fixtureIds !== undefined && {
        fixtureIds: JSON.stringify(body.fixtureIds),
      }),
      ...(body.overrides !== undefined && {
        overrides: JSON.stringify(body.overrides),
      }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder as number }),
    },
  });

  const allGroups = await prisma.group.findMany({ orderBy: { sortOrder: "asc" } });
  broadcast({
    type: "groups_updated",
    groups: allGroups.map((g) => ({ ...g, fixtureIds: JSON.parse(g.fixtureIds), overrides: JSON.parse(g.overrides) })),
  });

  return Response.json({
    ...group,
    fixtureIds: JSON.parse(group.fixtureIds),
    overrides: JSON.parse(group.overrides),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.group.delete({ where: { id } });

  const allGroups = await prisma.group.findMany({ orderBy: { sortOrder: "asc" } });
  broadcast({
    type: "groups_updated",
    groups: allGroups.map((g) => ({ ...g, fixtureIds: JSON.parse(g.fixtureIds), overrides: JSON.parse(g.overrides) })),
  });

  return new Response(null, { status: 204 });
}
