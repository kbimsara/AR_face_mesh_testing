import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 defaults to Turbopack; declare an explicit (empty) turbopack
  // section so that the webpack fallback block below doesn't trigger the
  // "webpack config but no turbopack config" error.
  turbopack: {},

  // Fallback for webpack-mode builds — prevents MediaPipe from trying to
  // bundle Node.js-only modules into the browser bundle.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
};

export default nextConfig;
