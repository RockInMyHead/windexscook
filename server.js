import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Загружаем переменные окружения
dotenv.config();

// Настройка прокси: без значений в .env прокси отключён
const PROXY_HOST = process.env.PROXY_HOST;
const PROXY_PORT = process.env.PROXY_PORT;
const PROXY_USERNAME = process.env.PROXY_USERNAME;
const PROXY_PASSWORD = process.env.PROXY_PASSWORD;
// Создаем прокси агент для HTTPS только при указанных настройках
let proxyAgent;
if (PROXY_HOST && PROXY_PORT && PROXY_USERNAME && PROXY_PASSWORD) {
  const proxyUrl = `http://${PROXY_USERNAME}:${PROXY_PASSWORD}@${PROXY_HOST}:${PROXY_PORT}`;
  proxyAgent = new HttpsProxyAgent(proxyUrl);
  console.log('🔧 Proxy configuration:', { proxyHost: PROXY_HOST, proxyPort: PROXY_PORT, proxyUsername: PROXY_USERNAME });
} else {
  console.log('🔧 Proxy disabled');
}

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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(requestLogger);

// ElevenLabs API роут - используем middleware для обработки всех запросов
app.use('/api/elevenlabs', async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey || apiKey === 'your_elevenlabs_api_key_here') {
      logToFile('WARN', 'ElevenLabs API key not configured, using demo mode');
      
      // Демо-ответ для ElevenLabs
      if (path.includes('/text-to-speech')) {
        return res.status(200).send('Demo audio response - ElevenLabs API key not configured');
      }
      
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
      agent: proxyAgent,
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
    // Получаем путь до OpenAI
    const path = req.path.replace('/api/openai', '');
    
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      logToFile('WARN', 'OpenAI API key not configured, using demo mode');
      
      // Демо-ответ для чата
      if (path === '/v1/chat/completions') {
        const demoResponse = {
          choices: [{
            message: {
              content: "Привет! Я ваш Windex кулинар 👨‍🍳 В демо-режиме я могу давать базовые советы по готовке. Для полной функциональности настройте OpenAI API ключ в .env файле.\n\nПопробуйте спросить о простых рецептах или кулинарных техниках!"
            }
          }]
        };
        return res.json(demoResponse);
      }
      
      // Демо-ответ для генерации рецептов
      if (path === '/v1/chat/completions' && req.body.messages && req.body.messages.some(msg => msg.content.includes('ингредиенты'))) {
        const demoRecipe = {
          choices: [{
            message: {
              content: JSON.stringify({
                title: "Демо-рецепт",
                description: "Вкусное блюдо из ваших ингредиентов",
                cookTime: "30 мин",
                servings: 4,
                difficulty: "Easy",
                ingredients: ["Ваши ингредиенты", "Соль", "Перец", "Масло"],
                instructions: [
                  "1. Подготовьте все ингредиенты",
                  "2. Обжарьте на сковороде",
                  "3. Добавьте специи",
                  "4. Подавайте горячим"
                ],
                tips: "Для полной функциональности настройте OpenAI API ключ"
              })
            }
          }]
        };
        return res.json(demoRecipe);
      }
      
      return res.status(500).json({ 
        error: 'OpenAI API key not configured' 
      });
    }

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
      console.log('🚀 Sending request to OpenAI:', url);
      const axiosConfig = { method: req.method, url, headers };
      if (req.method !== 'GET') axiosConfig.data = JSON.stringify(req.body);
      // Прокси агент, если настроен
      if (proxyAgent) { axiosConfig.httpsAgent = proxyAgent; axiosConfig.httpAgent = proxyAgent; }
      const response = await axios(axiosConfig);

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
    proxyConfigured: !!proxyAgent,
    proxyHost: PROXY_HOST,
    proxyPort: PROXY_PORT,
    proxyUsername: PROXY_USERNAME,
    logsDirectory: logsDir,
    serverUrl: `http://localhost:${PORT}`
  });
  
  console.log(`🚀 Pastel Chef AI API server running on port ${PORT}`);
  console.log(`🔑 ElevenLabs API key configured: ${process.env.ELEVENLABS_API_KEY ? 'Yes' : 'No'}`);
  console.log(`🔑 OpenAI API key configured: ${process.env.VITE_OPENAI_API_KEY ? 'Yes' : 'No'}`);
  console.log(`🌐 Proxy configured: ${PROXY_HOST ? `${PROXY_HOST}:${PROXY_PORT}` : 'Disabled'}`);
  console.log(`📁 Logs directory: ${logsDir}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
});
