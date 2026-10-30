/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import pkg from './package.json' with { type: 'json' }

// SINGLE=1 builds one self-contained Namiria.html that works by double-clicking (file://)
const single = process.env.SINGLE === '1'

// For GitHub Pages set VITE_BASE to "/<repo-name>/" when building, e.g.
//   VITE_BASE=/namiria/ npm run build
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'),
  },
  base: single ? './' : (process.env.VITE_BASE ?? '/'),
  plugins: [
    react(),
    ...(single
      ? [viteSingleFile(), { name: 'strip-pages-redirect', transformIndexHtml: (html: string) => html.replace(/<script data-pages-redirect>[\s\S]*?<\/script>/, '') }]
      : []),
  ],
  build: single ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000 } : {},
  server: { host: true, port: 5173 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
