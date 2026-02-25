import { defineConfig } from 'vite';
import { resolve } from 'path';

const GAME_ID = process.env['GAME_ID'] || 'chronicle-of-shadows';

export default defineConfig(({ mode }) => ({
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@game': resolve(__dirname, `games/${GAME_ID}`),
    },
  },
  define: {
    // Expose build mode to runtime code (e.g. main.ts checks MODE)
    'import.meta.env.GAME_ID': JSON.stringify(GAME_ID),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: mode !== 'game',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
}));
