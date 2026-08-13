/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // Tests must not depend on a developer's local .env — it's gitignored and absent
    // in CI, so anything reading import.meta.env.VITE_API_BASE_URL needs this defined
    // here regardless of what's on disk.
    env: {
      VITE_API_BASE_URL: 'http://localhost:8080',
    },
    // Explicit imports (`import { describe, it, expect } from 'vitest'`) in every test
    // file instead of `globals: true` — keeps tests consistent with this codebase's
    // preference for explicit imports over ambient globals, and avoids widening
    // tsconfig.app.json's deliberately narrow `types` array.
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/vite-env.d.ts',
        'src/main.tsx',
      ],
    },
  },
})
