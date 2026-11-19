import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App personnelle : chaque page lit des données fraîches (session, base), donc pas de cache de composants.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
