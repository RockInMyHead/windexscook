import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

// Загружаем переменные окружения
dotenv.config();

// Настройка прокси
const PROXY_HOST = process.env.PROXY_HOST || '185.68.187.46';
const PROXY_PORT = process.env.PROXY_PORT || '8000';
const PROXY_USERNAME = process.env.PROXY_USERNAME || 'FeCuvT';
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || 'aeUYh';

// Создаем прокси агенты
const proxyUrl = `http://${PROXY_USERNAME}:${PROXY_PASSWORD}@${PROXY_HOST}:${PROXY_PORT}`;
const httpProxyAgent = new HttpProxyAgent(proxyUrl);
const httpsProxyAgent = new HttpsProxyAgent(proxyUrl);

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

    const response = await fetch(url, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
      agent: url.startsWith('https:') ? httpsProxyAgent : httpProxyAgent,
    });

    const data = await response.text();
    
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
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
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

    logToFile('INFO', `Proxying OpenAI ${req.method} request to: ${url}`, {
      url,
      method: req.method,
      path: req.path,
      body: req.body
    });

    // Создаем заголовки для запроса к OpenAI
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...req.headers
    };

    // Удаляем host заголовок, чтобы избежать конфликтов
    delete headers.host;

    const response = await fetch(url, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
      agent: url.startsWith('https:') ? httpsProxyAgent : httpProxyAgent,
    });

    const data = await response.text();
    
    logToFile('INFO', `OpenAI response received: ${response.status}`, {
      status: response.status,
      responseSize: `${data.length} bytes`,
      url
    });

    res.status(response.status).send(data);
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

// Статическая раздача файлов из dist
app.use(express.static('dist'));

// Fallback для SPA - все остальные запросы возвращают index.html
app.use((req, res) => {
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
