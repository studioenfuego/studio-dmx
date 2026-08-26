import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add your local network IP here if you access the dev server from other devices (e.g. "10.0.0.5")
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["serialport", "@serialport/bindings-cpp"],
  devIndicators: false,
};

export default nextConfig;
