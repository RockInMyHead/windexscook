import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Загружаем переменные окружения
dotenv.config();

// Настройка прокси
const PROXY_HOST = process.env.PROXY_HOST || '185.68.187.46';
const PROXY_PORT = process.env.PROXY_PORT || '8000';
const PROXY_USERNAME = process.env.PROXY_USERNAME || 'FeCuvT';
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || 'aeUYh';

// Создаем прокси агент для HTTPS
const proxyUrl = `http://${PROXY_USERNAME}:${PROXY_PASSWORD}@${PROXY_HOST}:${PROXY_PORT}`;
const proxyAgent = new HttpsProxyAgent(proxyUrl);

console.log('🔧 Proxy configuration:', {
  proxyUrl: proxyUrl.replace(/:[^@]*@/, ':***@'), // Скрываем пароль в логах
  proxyHost: PROXY_HOST,
  proxyPort: PROXY_PORT,
  proxyUsername: PROXY_USERNAME
});

// Создаем директорию для логов
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Функция для логирования
const logToFile = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  
  let logLine = `${timestamp} [${level}] ${message}`;
  
  if (data) {
    logLine += `\n${JSON.stringify(data, null, 2)}`;
  }
  
  logLine += '\n';
  
  // Логируем в консоль
  console.log(logLine.trim());
  
  // Логируем в файл
  const logFile = path.join(logsDir, `${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logLine);
};

// Middleware для логирования запросов
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logToFile('INFO', `${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  next();
};

const app = express();
const PORT = process.env.PORT || 1041;

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Disable caching for all responses
app.disable('etag');
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Static serve files from dist with no-cache for HTML
app.use(express.static('dist', {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }
  }
}));

// ElevenLabs API роут - используем middleware для обработки всех запросов
app.use('/api/elevenlabs', async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      logToFile('ERROR', 'ElevenLabs API key not configured');
      return res.status(500).json({ 
        error: 'ElevenLabs API key not configured' 
      });
    }

    // Получаем путь после /api/elevenlabs и добавляем /v1
    const path = req.path.replace('/api/elevenlabs', '/v1');
    const url = `https://api.elevenlabs.io${path}`;

    logToFile('INFO', `Proxying ElevenLabs ${req.method} request to: ${url}`, {
      url,
      method: req.method,
      path: req.path,
      body: req.body
    });

    // Создаем заголовки для запроса к ElevenLabs
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...req.headers
    };

    // Удаляем host заголовок, чтобы избежать конфликтов
    delete headers.host;

    const response = await axios({
      method: req.method,
      url: url,
      headers,
      data: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
      httpsAgent: proxyAgent,
      httpAgent: proxyAgent
    });

    const data = JSON.stringify(response.data);
    
    logToFile('INFO', `ElevenLabs response received: ${response.status}`, {
      status: response.status,
      responseSize: `${data.length} bytes`,
      url
    });

    res.status(response.status).send(data);
  } catch (error) {
    logToFile('ERROR', 'ElevenLabs Proxy error', {
      error: error.message,
      stack: error.stack,
      url: `https://api.elevenlabs.io${req.path.replace('/api/elevenlabs', '/v1')}`
    });
    
    // Обрабатываем ошибки axios (включая 4xx/5xx статусы)
    if (error.response) {
      const data = JSON.stringify(error.response.data);
      res.status(error.response.status).send(data);
    } else {
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  }
});

// OpenAI API роут - проксирование для OpenAI
app.use('/api/openai', async (req, res) => {
  try {
    const apiKey = process.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      logToFile('ERROR', 'OpenAI API key not configured');
      return res.status(500).json({ 
        error: 'OpenAI API key not configured' 
      });
    }

    // Получаем путь после /api/openai
    const path = req.path.replace('/api/openai', '');
    const url = `https://api.openai.com${path}`;

    // Создаем заголовки для запроса к OpenAI
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...req.headers
    };

    // Удаляем host заголовок, чтобы избежать конфликтов
    delete headers.host;
  // Логируем запрос вместе с заголовками после их создания
  logToFile('INFO', `Proxying OpenAI ${req.method} request to: ${url}`, {
    url,
    method: req.method,
    path: req.path,
    body: req.body,
    headers: headers
  });

  // Дополнительное логирование для отладки
  console.log('🔍 DEBUG: OpenAI Request Details:', {
    url,
    method: req.method,
    headers: headers,
    body: req.body,
    proxyEnv: {
      HTTP_PROXY: process.env.HTTP_PROXY,
      HTTPS_PROXY: process.env.HTTPS_PROXY
    }
  });

    try {
      console.log('🚀 Sending axios request with proxy agent...');
      const response = await axios({
        method: req.method,
        url: url,
        headers,
        data: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        httpsAgent: proxyAgent,
        httpAgent: proxyAgent
      });

      const data = JSON.stringify(response.data);
      
      console.log('✅ OpenAI response received:', {
        status: response.status,
        responseSize: `${data.length} bytes`,
        url,
        dataPreview: data.substring(0, 200) + '...'
      });
      
      logToFile('INFO', `OpenAI response received: ${response.status}`, {
        status: response.status,
        responseSize: `${data.length} bytes`,
        url
      });

      res.status(response.status).send(data);
    } catch (axiosError) {
      console.log('❌ Axios error occurred:', {
        message: axiosError.message,
        code: axiosError.code,
        status: axiosError.response?.status,
        responseData: axiosError.response?.data,
        url: axiosError.config?.url
      });
      
      // Обрабатываем ошибки axios (включая 4xx/5xx статусы)
      if (axiosError.response) {
        const data = JSON.stringify(axiosError.response.data);
        console.log('📝 Error response data:', data);
        
        logToFile('INFO', `OpenAI response received: ${axiosError.response.status}`, {
          status: axiosError.response.status,
          responseSize: `${data.length} bytes`,
          url
        });
        res.status(axiosError.response.status).send(data);
      } else {
        console.log('🚨 Network error:', axiosError.message);
        throw axiosError;
      }
    }
  } catch (error) {
    logToFile('ERROR', 'OpenAI Proxy error', {
      error: error.message,
      stack: error.stack,
      url: `https://api.openai.com${req.path.replace('/api/openai', '')}`
    });
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Pastel Chef AI API Server'
  });
});

// Fallback для SPA - все остальные запросы возвращают index.html
app.use((req, res) => {
  // Отключаем кэширование для HTML файлов
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile('dist/index.html', { root: '.' });
});

app.listen(PORT, () => {
  logToFile('INFO', `Pastel Chef AI API server started`, {
    port: PORT,
    elevenlabsConfigured: !!process.env.ELEVENLABS_API_KEY,
    openaiConfigured: !!process.env.VITE_OPENAI_API_KEY,
    proxyConfigured: true,
    proxyHost: PROXY_HOST,
    proxyPort: PROXY_PORT,
    proxyUsername: PROXY_USERNAME,
    logsDirectory: logsDir,
    serverUrl: `http://localhost:${PORT}`
  });
  
  console.log(`🚀 Pastel Chef AI API server running on port ${PORT}`);
  console.log(`🔑 ElevenLabs API key configured: ${process.env.ELEVENLABS_API_KEY ? 'Yes' : 'No'}`);
  console.log(`🔑 OpenAI API key configured: ${process.env.VITE_OPENAI_API_KEY ? 'Yes' : 'No'}`);
  console.log(`🌐 Proxy configured: ${PROXY_HOST}:${PROXY_PORT} (${PROXY_USERNAME})`);
  console.log(`📁 Logs directory: ${logsDir}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
});
