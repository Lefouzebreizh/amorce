import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // @ffmpeg/ffmpeg charge son worker et son core en runtime : on le laisse
  // hors du pre-bundling pour que les URL de blob restent valides.
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
  server: { port: 5173 },
})
