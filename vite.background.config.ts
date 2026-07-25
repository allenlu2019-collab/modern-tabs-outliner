import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    copyPublicDir: false,
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/background.ts'),
      formats: ['es'],
      fileName: () => 'background.js',
    },
    rolldownOptions: {
      output: {
        codeSplitting: false,
      },
    },
  },
})
