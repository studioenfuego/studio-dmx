import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { broadcast } from "@/lib/wsServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const scenes = await prisma.scene.findMany({ orderBy: { sortOrder: "asc" } });
  return Response.json(scenes.map((s) => ({ ...s, values: JSON.parse(s.values) })));
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    name: string;
    values: Record<string, number>;
    fadeIn?: number;
    fadeOut?: number;
    sortOrder?: number;
  };
  const scene = await prisma.scene.create({
    data: {
      name: body.name,
      values: JSON.stringify(body.values),
      fadeIn: body.fadeIn ?? 0,
      fadeOut: body.fadeOut ?? 0,
      sortOrder: body.sortOrder ?? 0,
    },
  });
  const allScenes = await prisma.scene.findMany({ orderBy: { sortOrder: "asc" } });
  broadcast({ type: "scenes_updated", scenes: allScenes.map((s) => ({ ...s, values: JSON.parse(s.values) })) });

  return Response.json({ ...scene, values: JSON.parse(scene.values) }, { status: 201 });
}
