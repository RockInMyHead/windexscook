import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Загружаем переменные окружения
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ElevenLabs API роут
app.use('/api/elevenlabs', async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      console.log('⚠️ ElevenLabs API key not configured');
      return res.status(500).json({ 
        error: 'ElevenLabs API key not configured',
        message: 'Please set ELEVENLABS_API_KEY in environment variables'
      });
    }

    // Получаем путь после /api/elevenlabs/
    const path = req.path.replace('/api/elevenlabs', '/v1');
    const url = `https://api.elevenlabs.io${path}`;

    console.log(`🔄 Proxying ${req.method} request to: ${url}`);

    // Создаем заголовки для запроса к ElevenLabs
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'PastelChefAI/1.0'
    };

    // Подготавливаем тело запроса
    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.is('application/json')) {
        body = JSON.stringify(req.body);
      } else {
        body = req.body;
      }
    }

    const response = await fetch(url, {
      method: req.method,
      headers,
      body,
    });

    const responseData = await response.text();
    
    console.log(`✅ Response from ElevenLabs: ${response.status}`);

    // Устанавливаем заголовки ответа
    res.status(response.status);
    
    // Копируем важные заголовки от ElevenLabs
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.set('Content-Type', contentType);
    }

    // Если это аудио файл, отправляем как бинарные данные
    if (contentType && contentType.includes('audio')) {
      const audioBuffer = await response.buffer();
      res.send(audioBuffer);
    } else {
      res.send(responseData);
    }

  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// OpenAI API роут (если нужен)
app.use('/api/openai', async (req, res) => {
  try {
    const apiKey = process.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      console.log('⚠️ OpenAI API key not configured');
      return res.status(500).json({ 
        error: 'OpenAI API key not configured',
        message: 'Please set VITE_OPENAI_API_KEY in environment variables'
      });
    }

    const path = req.path.replace('/api/openai', '');
    const url = `https://api.openai.com${path}`;

    console.log(`🔄 Proxying ${req.method} request to OpenAI: ${url}`);

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'PastelChefAI/1.0'
    };

    const response = await fetch(url, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const responseData = await response.text();
    
    console.log(`✅ Response from OpenAI: ${response.status}`);

    res.status(response.status);
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.set('Content-Type', contentType);
    }
    res.send(responseData);

  } catch (error) {
    console.error('❌ OpenAI Proxy error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    services: {
      elevenlabs: !!process.env.ELEVENLABS_API_KEY,
      openai: !!process.env.VITE_OPENAI_API_KEY
    }
  });
});

// API info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Pastel Chef AI API',
    version: '1.0.0',
    description: 'API proxy for Pastel Chef AI application',
    endpoints: {
      elevenlabs: '/api/elevenlabs/*',
      openai: '/api/openai/*',
      health: '/health'
    },
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Pastel Chef AI API Server running on port ${PORT}`);
  console.log(`🔑 ElevenLabs API key configured: ${process.env.ELEVENLABS_API_KEY ? 'Yes' : 'No'}`);
  console.log(`🔑 OpenAI API key configured: ${process.env.VITE_OPENAI_API_KEY ? 'Yes' : 'No'}`);
  console.log(`📡 Available endpoints:`);
  console.log(`   - ElevenLabs proxy: http://localhost:${PORT}/api/elevenlabs/*`);
  console.log(`   - OpenAI proxy: http://localhost:${PORT}/api/openai/*`);
  console.log(`   - Health check: http://localhost:${PORT}/health`);
  console.log(`   - API info: http://localhost:${PORT}/api/info`);
});

export default app;