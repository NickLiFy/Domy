import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { apiMiddleware } from './server/index.js'

const liveDataApiPlugin = (): Plugin => ({
  name: 'domy-live-data-api',
  configureServer: (server) => {
    server.middlewares.use(apiMiddleware)
  },
  configurePreviewServer: (server) => {
    server.middlewares.use(apiMiddleware)
  },
})

export default defineConfig({
  plugins: [react(), liveDataApiPlugin()],
  // Pinned + strict so a stale server on this port makes `vite` fail loudly instead of
  // silently starting a second server on the next free port.
  server: { port: 5184, strictPort: true },
  preview: { port: 5184, strictPort: true },
})
