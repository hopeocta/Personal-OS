import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['ical.js', 'garmin-connect', '@anthropic-ai/sdk'],
};

export default nextConfig;
