import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { universe } from "@/lib/dmx/universe";
import { broadcast } from "@/lib/wsServer";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scene = await prisma.scene.findUnique({ where: { id } });
  if (!scene) return new Response("Not found", { status: 404 });

  const body = await request.json().catch(() => ({})) as { fadeTime?: number };
  const fadeMs = body.fadeTime ?? scene.fadeIn;
  const values = JSON.parse(scene.values) as Record<string, number>;

  await universe.fadeToScene(values, fadeMs);

  broadcast({ type: "scene_recalled", sceneId: id, name: scene.name });

  return Response.json({ ok: true, sceneId: id, name: scene.name });
}
