import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json() as { id: string; sortOrder: number }[];
  await prisma.$transaction(
    body.map(({ id, sortOrder }) =>
      prisma.fixtureInstance.update({ where: { id }, data: { sortOrder } })
    )
  );
  return Response.json({ ok: true });
}
