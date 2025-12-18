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
    allowedHosts: ['ba2ab2d89763.ngrok-free.app'],
    hmr: {
      port: 5174,
    },
    // Прокси для разработки - перенаправляет /api на локальный сервер
    proxy: {
      '/api': {
        target: 'http://localhost:1041',
        changeOrigin: true,
        secure: false,
        timeout: 60000, // Увеличиваем таймаут для долгих AI запросов
        headers: {
          'Connection': 'keep-alive'
        },
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('🔄 [Vite Proxy] Sending API Request:', req.method, req.url, '→ http://localhost:1041' + req.url);
            // Убираем origin header чтобы избежать CORS проблем
            proxyReq.removeHeader('origin');
            // Увеличиваем таймаут для прокси запроса
            proxyReq.setTimeout(60000);
          });

          proxy.on('error', (err, _req, _res) => {
            console.error('❌ [Vite Proxy] Error:', err.message);
          });

          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('✅ [Vite Proxy] Response:', proxyRes.statusCode, req.url);
            // Добавляем расширенные CORS headers
            proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
            proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Accept, Origin';
            proxyRes.headers['Access-Control-Expose-Headers'] = 'X-CSRF-Token, Content-Length';
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