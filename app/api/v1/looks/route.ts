import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { broadcast } from "@/lib/wsServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const looks = await prisma.look.findMany({ orderBy: { name: "asc" } });
  return Response.json(looks.map((l) => ({ ...l, values: JSON.parse(l.values) })));
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    name: string;
    type: string;
    values: Record<string, number>;
  };
  const look = await prisma.look.create({
    data: { name: body.name, type: body.type, values: JSON.stringify(body.values) },
  });
  const allLooks = await prisma.look.findMany({ orderBy: { name: "asc" } });
  broadcast({ type: "looks_updated", looks: allLooks.map((l) => ({ ...l, values: JSON.parse(l.values) })) });

  return Response.json({ ...look, values: JSON.parse(look.values) }, { status: 201 });
}
