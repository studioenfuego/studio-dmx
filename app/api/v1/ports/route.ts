import { listEnttecPorts } from "@/lib/dmx/enttec";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ports = await listEnttecPorts();
    return Response.json(ports);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to list ports" },
      { status: 500 }
    );
  }
}
