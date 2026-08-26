import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' -> relative asset paths so the build works on GitHub Pages
// under any /repo-name/ path without extra config.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    hmr: { clientPort: 443 },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
})
