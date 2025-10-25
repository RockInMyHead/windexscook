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
    // Прокси для разработки и продакшена
    proxy: {
      '/api': {
        target: 'http://localhost:1041',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending API Request to the Target:', req.method, req.url);
          });
          
          proxy.on('error', (err, _req, _res) => {
            console.log('API proxy error', err);
          });
          
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received API Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  }
})