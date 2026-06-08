import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Tests don't touch styles; override PostCSS discovery so Vite doesn't try
  // to load the project's Tailwind PostCSS config.
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
