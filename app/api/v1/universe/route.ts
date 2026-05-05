import { NextRequest } from "next/server";
import { universe } from "@/lib/dmx/universe";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    channels: universe.getChannels(),
    grandMaster: universe.getGrandMaster(),
    output: universe.getOutputChannels(),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;

  if (body.blackout === true) {
    universe.blackout();
    return Response.json({ ok: true, action: "blackout" });
  }

  if (typeof body.grandMaster === "number") {
    universe.setGrandMaster(body.grandMaster);
  }

  if (body.channels && typeof body.channels === "object") {
    universe.setChannels(body.channels as Record<string, number>);
  }

  return Response.json({
    ok: true,
    channels: universe.getChannels(),
    grandMaster: universe.getGrandMaster(),
  });
}
