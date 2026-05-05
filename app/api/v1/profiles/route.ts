import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const profiles = await prisma.fixtureProfile.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { manufacturer: { contains: q } },
          ],
        }
      : undefined,
    orderBy: [{ manufacturer: "asc" }, { name: "asc" }],
    take: 100,
  });
  return Response.json(
    profiles.map((p) => ({
      ...p,
      channels: JSON.parse(p.channels),
      modes: JSON.parse(p.modes),
    }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    name: string;
    manufacturer: string;
    oflKey?: string;
    channels: unknown[];
    modes: unknown[];
  };
  const profile = await prisma.fixtureProfile.create({
    data: {
      name: body.name,
      manufacturer: body.manufacturer,
      oflKey: body.oflKey,
      channels: JSON.stringify(body.channels),
      modes: JSON.stringify(body.modes),
    },
  });
  return Response.json(
    { ...profile, channels: JSON.parse(profile.channels), modes: JSON.parse(profile.modes) },
    { status: 201 }
  );
}
