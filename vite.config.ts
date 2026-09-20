import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { prepareVisionAssets } from './scripts/prepare-vision.mjs';
prepareVisionAssets();
export default defineConfig({ plugins: [react()], server: { host: '127.0.0.1', port: 5173 }, build: { outDir: 'dist' } });
