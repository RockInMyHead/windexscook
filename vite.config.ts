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
      '/api/elevenlabs': {
        target: 'http://localhost:1041',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/api/openai': {
        target: 'http://localhost:1041',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending OpenAI Request to the Target:', req.method, req.url);
          });
          
          proxy.on('error', (err, _req, _res) => {
            console.log('OpenAI proxy error', err);
          });
          
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received OpenAI Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  }
})