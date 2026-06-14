import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle .cer certificate files into Vercel serverless function deployments.
  // Without this, Vercel strips files from the project root and the runtime
  // cannot find them at /var/task/ (the serverless CWD).
  outputFileTracingIncludes: {
    // Apply to all API routes / server actions
    "/api/**": ["./ProductionCertificate.cer", "./SandboxCertificate.cer"],
  },
  webpack: (config) => {
    config.cache = false;
    return config;
  },
};

export default nextConfig;
