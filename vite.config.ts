import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

/**
 * The Cloudflare plugin runs the Worker — including the Durable Object — inside
 * the Vite dev server. That means `npm run dev` on :5173 gives hot reload AND
 * working buzzers from one command, instead of needing a separate `wrangler dev`
 * on another port.
 */
export default defineConfig({
  plugins: [react(), cloudflare()],
  appType: 'spa',
  // host:true prints a LAN URL, so a real phone can hit /buzz during testing.
  server: { port: 5173, host: true },
})
