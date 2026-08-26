import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const bg = await prisma.stageBackground.findUnique({ where: { id: "singleton" } });
  return Response.json(bg ?? {
    imageUrl: null,
    x: 50,
    y: 50,
    scale: 100,
    rotation: 0,
    locked: false,
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;

  const bg = await prisma.stageBackground.upsert({
    where: { id: "singleton" },
    update: {
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl as string | null }),
      ...(body.x !== undefined && { x: body.x as number }),
      ...(body.y !== undefined && { y: body.y as number }),
      ...(body.scale !== undefined && { scale: body.scale as number }),
      ...(body.rotation !== undefined && { rotation: body.rotation as number }),
      ...(body.locked !== undefined && { locked: body.locked as boolean }),
    },
    create: {
      id: "singleton",
      imageUrl: (body.imageUrl as string | null) ?? null,
      x: (body.x as number) ?? 50,
      y: (body.y as number) ?? 50,
      scale: (body.scale as number) ?? 100,
      rotation: (body.rotation as number) ?? 0,
      locked: (body.locked as boolean) ?? false,
    },
  });

  return Response.json(bg);
}
