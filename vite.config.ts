import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config for snuggiettv/hell-clock (GH Pages base path)
export default defineConfig({
  plugins: [react()],
  base: '/hell-clock/',
  build: { sourcemap: true },
})
