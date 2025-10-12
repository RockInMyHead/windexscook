const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 1031;

// Проксируем все запросы на новый сервер
app.use('/', createProxyMiddleware({
  target: 'http://localhost:1041',
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error');
  }
}));

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on port ${PORT}, forwarding to localhost:1041`);
});
