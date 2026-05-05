import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scene = await prisma.scene.findUnique({ where: { id } });
  if (!scene) return new Response("Not found", { status: 404 });
  return Response.json({ ...scene, values: JSON.parse(scene.values) });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;
  const scene = await prisma.scene.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name as string }),
      ...(body.values !== undefined && { values: JSON.stringify(body.values) }),
      ...(body.fadeIn !== undefined && { fadeIn: body.fadeIn as number }),
      ...(body.fadeOut !== undefined && { fadeOut: body.fadeOut as number }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder as number }),
    },
  });
  return Response.json({ ...scene, values: JSON.parse(scene.values) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.scene.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
