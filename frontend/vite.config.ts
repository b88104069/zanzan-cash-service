import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Gate 5 (ACTIVE): fully client-side prototype — no backend, so no /api
// dev proxy is needed anymore. `base` is set for GitHub Pages project-site
// hosting (served under /zanzan-cash-service/) when building; dev server
// keeps root-relative paths.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/zanzan-cash-service/' : '/',
}))
