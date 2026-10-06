import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      'ui': path.resolve(import.meta.dirname, './src/components/ui'),
      'lib': path.resolve(import.meta.dirname, './src/lib'),
      'context': path.resolve(import.meta.dirname, './src/context'),
      'pages': path.resolve(import.meta.dirname, './src/pages'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
