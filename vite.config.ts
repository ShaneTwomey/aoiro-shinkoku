import { defineConfig } from 'vitest/config';
export default defineConfig({ base: './', test: { include: ['tests/**/*.test.ts'] }, build: {assetsInlineLimit: 0} });
