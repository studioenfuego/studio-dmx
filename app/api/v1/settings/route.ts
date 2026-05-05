import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { dmxEngine } from "@/lib/dmx/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  return Response.json(settings ?? {
    id: "singleton",
    dmxInterface: "artnet",
    artnetHost: "192.168.1.255",
    artnetPort: 6454,
    artnetNet: 0,
    artnetSubnet: 0,
    artnetUniverse: 0,
    enttecPort: null,
    grandMaster: 255,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;

  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {
      ...(body.dmxInterface !== undefined && { dmxInterface: body.dmxInterface as string }),
      ...(body.artnetHost !== undefined && { artnetHost: body.artnetHost as string }),
      ...(body.artnetPort !== undefined && { artnetPort: body.artnetPort as number }),
      ...(body.artnetNet !== undefined && { artnetNet: body.artnetNet as number }),
      ...(body.artnetSubnet !== undefined && { artnetSubnet: body.artnetSubnet as number }),
      ...(body.artnetUniverse !== undefined && { artnetUniverse: body.artnetUniverse as number }),
      ...(body.enttecPort !== undefined && { enttecPort: (body.enttecPort as string) || null }),
      ...(body.grandMaster !== undefined && { grandMaster: body.grandMaster as number }),
    },
    create: {
      id: "singleton",
      dmxInterface: (body.dmxInterface as string) ?? "artnet",
      artnetHost: (body.artnetHost as string) ?? "192.168.1.255",
      artnetPort: (body.artnetPort as number) ?? 6454,
      artnetNet: (body.artnetNet as number) ?? 0,
      artnetSubnet: (body.artnetSubnet as number) ?? 0,
      artnetUniverse: (body.artnetUniverse as number) ?? 0,
      enttecPort: (body.enttecPort as string) ?? null,
      grandMaster: (body.grandMaster as number) ?? 255,
    },
  });

  // Apply config change to running engine
  await dmxEngine.updateConfig({
    outputMode: settings.dmxInterface as "artnet" | "enttec",
    host: settings.artnetHost,
    port: settings.artnetPort,
    net: settings.artnetNet,
    subnet: settings.artnetSubnet,
    universe: settings.artnetUniverse,
    enttecPort: settings.enttecPort ?? undefined,
  });

  return Response.json(settings);
}
