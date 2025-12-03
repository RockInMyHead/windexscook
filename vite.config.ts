import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { config } from 'dotenv'

// Загружаем переменные окружения
config()

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // Прокси для разработки - перенаправляет /api на локальный сервер
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: false,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('🔄 [Vite Proxy] Sending API Request:', req.method, req.url, '→ http://localhost:4000' + req.url);
          });

          proxy.on('error', (err, _req, _res) => {
            console.error('❌ [Vite Proxy] Error:', err.message);
          });

          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('✅ [Vite Proxy] Response:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
})