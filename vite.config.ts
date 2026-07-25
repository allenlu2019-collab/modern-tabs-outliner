/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        codeSplitting: false,
        entryFileNames: 'main.js'
      }
    }
  }
})
