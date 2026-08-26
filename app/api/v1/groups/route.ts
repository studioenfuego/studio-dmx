import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { broadcast } from "@/lib/wsServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const groups = await prisma.group.findMany({ orderBy: { sortOrder: "asc" } });
  return Response.json(
    groups.map((g) => ({
      ...g,
      fixtureIds: JSON.parse(g.fixtureIds),
      overrides: JSON.parse(g.overrides),
    }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { name: string; color?: string; sortOrder?: number };
  const count = await prisma.group.count();
  const group = await prisma.group.create({
    data: {
      name: body.name,
      color: body.color ?? "#8b5cf6",
      sortOrder: body.sortOrder ?? count,
    },
  });
  const allGroups = await prisma.group.findMany({ orderBy: { sortOrder: "asc" } });
  broadcast({
    type: "groups_updated",
    groups: allGroups.map((g) => ({ ...g, fixtureIds: JSON.parse(g.fixtureIds), overrides: JSON.parse(g.overrides) })),
  });

  return Response.json(
    { ...group, fixtureIds: [], overrides: {} },
    { status: 201 }
  );
}
