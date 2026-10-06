import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      'ui': path.resolve(import.meta.dirname, './src/components/ui'),
      'charts': path.resolve(import.meta.dirname, './src/components/charts'),
      'layout': path.resolve(import.meta.dirname, './src/components/layout'),
      'lib': path.resolve(import.meta.dirname, './src/lib'),
      'context': path.resolve(import.meta.dirname, './src/context'),
      'hooks': path.resolve(import.meta.dirname, './src/hooks'),
      'pages': path.resolve(import.meta.dirname, './src/pages'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
