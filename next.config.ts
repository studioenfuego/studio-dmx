import type { NextConfig } from "next";
import os from "os";

// Allow access from any local network interface automatically —
// so tablets, phones, and other machines on the same network just work.
function localNetworkIPs(): string[] {
  const ips: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) ips.push(addr.address);
    }
  }
  return ips;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", ...localNetworkIPs()],
  serverExternalPackages: ["serialport", "@serialport/bindings-cpp"],
  devIndicators: false,
};

export default nextConfig;
