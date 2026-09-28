import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Gate 5 (ACTIVE): fully client-side prototype — no backend, so no /api
// dev proxy is needed anymore. `base` is set for GitHub Pages project-site
// hosting (served under /zanzan-cash-service/) when building; dev server
// keeps root-relative paths.
//
// PAGES_BASE_PATH lets a build target a different subpath than the
// production root — used by .github/workflows/deploy-pages-preview.yml to
// build the Accounting Module v0.1 feature branch into a preview subfolder
// (/zanzan-cash-service/preview/accounting-module/) alongside the
// untouched production root, without a second GitHub Pages site or a new
// external hosting credential.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? (process.env.PAGES_BASE_PATH ?? '/zanzan-cash-service/') : '/',
}))
