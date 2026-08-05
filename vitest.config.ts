import path from "node:path";
import { defineConfig } from "vitest/config";

// Mirrors tsconfig.json's "@/*" -> "./src/*" path mapping so files that use the
// `@/` alias (e.g. src/app/api/pilot-login/route.ts) can be imported directly in tests.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
