/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev port: pass it on the command line (npm run dev -- --port 3301) so parallel agents each keep their own.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks: an app-only deploy leaves these cached in returning visitors' browsers.
        // three / R3F / drei / motion are deliberately not grouped: they stay in the lazy chunks that import them.
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|cookie|set-cookie-parser)[\\/]/,
            },
            {
              name: "supabase",
              test: /[\\/]node_modules[\\/](@supabase|tslib|iceberg-js)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    testTimeout: 15000,
  },
});
