import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Shared pure mobile reconciliation code is exercised without the Expo runtime.
  // Keep transpilation independent of apps/mobile/tsconfig.json on API-only CI.
  esbuild: { tsconfigRaw: JSON.stringify({ compilerOptions: { target: 'ES2022', useDefineForClassFields: true } }) },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
