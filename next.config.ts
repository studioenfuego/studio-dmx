import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["serialport", "@serialport/bindings-cpp"],
};

export default nextConfig;
