import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Proxies /api to the standalone backend during development, avoiding CORS.
// In Gate 5 staging, the frontend and backend are separate Cloud Run
// services — see docs/architecture/gcp-target-architecture.md — and the
// frontend build reads the real API base from VITE_API_BASE_URL instead.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
