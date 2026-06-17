import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

const localCacheDir = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'PhysicsSims', 'vite-cache')
  : '.vite-cache';

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_'],
  base: '/',
  cacheDir: localCacheDir,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
