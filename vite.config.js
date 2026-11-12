import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import sendEmailHandler from './api/send-email.js'

const emailApiPlugin = () => ({
  name: 'nhip-viec-email-api',
  configureServer(server) {
    server.middlewares.use('/api/send-email', (req, res) => {
      sendEmailHandler(req, res)
    })
  },
})

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), emailApiPlugin()],
  optimizeDeps: {
    entries: ['index.html'],
  },
  build: {
    outDir: mode === 'demo' ? 'demo-dist' : 'dist',
    assetsInlineLimit: mode === 'demo' ? Number.MAX_SAFE_INTEGER : 4096,
  },
}))
