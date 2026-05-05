import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

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
  return Response.json({ ...look, values: JSON.parse(look.values) }, { status: 201 });
}
