import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // React Compiler runs as a Babel pass (build-time auto-memoization).
    react({ babel: { plugins: [['babel-plugin-react-compiler', { target: '19' }]] } }),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Tauri expects a fixed dev port and its own error overlay.
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    // es2022 (not safari14): avoids esbuild's Safari destructuring workaround.
    // The macOS 11+ WKWebView runs es2022 fine; esbuild injects nothing newer.
    target: 'es2022',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
});
