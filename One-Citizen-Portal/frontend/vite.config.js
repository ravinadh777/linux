import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// See frontend/ARCHITECTURE.md. Feature-based aliases; API proxied to the backend in dev.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@app': path.resolve(__dirname, 'src/app'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@theme': path.resolve(__dirname, 'src/theme'),
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@stores': path.resolve(__dirname, 'src/stores'),
      '@assistant': path.resolve(__dirname, 'src/assistant'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Route-level code splitting is configured per-feature via React.lazy (see routing story).
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
});
