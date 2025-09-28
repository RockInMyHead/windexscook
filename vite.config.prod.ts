import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Прокси для разработки - перенаправляем API запросы на отдельный сервер
    proxy: {
      '/api/elevenlabs': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/api/openai': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    // Настройки для продакшена
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        }
      }
    }
  },
  define: {
    // Переменные для продакшена
    __API_BASE_URL__: JSON.stringify(process.env.API_BASE_URL || ''),
  }
})
