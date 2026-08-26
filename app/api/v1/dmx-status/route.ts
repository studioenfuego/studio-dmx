import os from "os";
import { dmxEngine } from "@/lib/dmx/engine";

export const dynamic = "force-dynamic";

function getNetworkInterfaces() {
  const result: { name: string; address: string; netmask: string }[] = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        result.push({ name, address: addr.address, netmask: addr.netmask });
      }
    }
  }
  return result;
}

export async function GET() {
  const status = dmxEngine.getStatus();
  const interfaces = getNetworkInterfaces();
  return Response.json({ ...status, interfaces });
}
