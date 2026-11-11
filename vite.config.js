import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react()],
  optimizeDeps: {
    entries: ['index.html'],
  },
  build: {
    outDir: mode === 'demo' ? 'demo-dist' : 'dist',
    assetsInlineLimit: mode === 'demo' ? Number.MAX_SAFE_INTEGER : 4096,
  },
}))
