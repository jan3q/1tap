import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: {
    // appIsrStatus: false, // Usunięte aby przeszła kompilacja TypeScript w Next.js 16
  },
};

export default nextConfig;
