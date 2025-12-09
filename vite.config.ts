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
    port: 5174,
    strictPort: false,
    hmr: {
      port: 5174,
    },
    // Прокси для разработки - перенаправляет /api на локальный сервер
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
        timeout: 30000,
        headers: {
          'Connection': 'keep-alive'
        },
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('🔄 [Vite Proxy] Sending API Request:', req.method, req.url, '→ http://localhost:4001' + req.url);
            // Убираем origin header чтобы избежать CORS проблем
            proxyReq.removeHeader('origin');
          });

          proxy.on('error', (err, _req, _res) => {
            console.error('❌ [Vite Proxy] Error:', err.message);
          });

          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('✅ [Vite Proxy] Response:', proxyRes.statusCode, req.url);
            // Добавляем CORS headers
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
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