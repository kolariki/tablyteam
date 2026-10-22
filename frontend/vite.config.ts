import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API = process.env.ARENA_API ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      // public, server-rendered pages and files (blog, FAQ, sitemap, robots, llms.txt)
      '^/(blog|faq|sitemap\\.xml|robots\\.txt|llms\\.txt|llms-full\\.txt)([/?].*)?$': API,
      '/ws': { target: API.replace(/^http/, 'ws'), ws: true },
    },
  },
})
