import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await prisma.fixtureProfile.findUnique({ where: { id } });
  if (!profile) return new Response("Not found", { status: 404 });
  return Response.json({ ...profile, channels: JSON.parse(profile.channels), modes: JSON.parse(profile.modes) });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;
  const profile = await prisma.fixtureProfile.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name as string }),
      ...(body.manufacturer !== undefined && { manufacturer: body.manufacturer as string }),
      ...(body.icon !== undefined && { icon: body.icon as string | null }),
      ...(body.channels !== undefined && { channels: JSON.stringify(body.channels) }),
      ...(body.modes !== undefined && { modes: JSON.stringify(body.modes) }),
    },
  });
  return Response.json({ ...profile, channels: JSON.parse(profile.channels), modes: JSON.parse(profile.modes) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.fixtureProfile.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
