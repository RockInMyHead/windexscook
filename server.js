import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Загружаем переменные окружения
dotenv.config();

// Настройка прокси - используем только env переменные, без fallback
const PROXY_HOST = process.env.PROXY_HOST;
const PROXY_PORT = process.env.PROXY_PORT;
const PROXY_USERNAME = process.env.PROXY_USERNAME;
const PROXY_PASSWORD = process.env.PROXY_PASSWORD;

// Создаем прокси агент для HTTPS только если все данные прокси указаны
const proxyUrl = PROXY_HOST && PROXY_PORT && PROXY_USERNAME && PROXY_PASSWORD 
  ? `http://${PROXY_USERNAME}:${PROXY_PASSWORD}@${PROXY_HOST}:${PROXY_PORT}`
  : null;

const proxyAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : null;

console.log('🔧 Proxy configuration:', {
  proxyUrl: proxyUrl ? proxyUrl.replace(/:[^@]*@/, ':***@') : 'disabled', // Скрываем пароль в логах
  proxyHost: PROXY_HOST,
  proxyPort: PROXY_PORT,
  proxyUsername: PROXY_USERNAME,
  proxyEnabled: !!proxyAgent
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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

    const axiosConfig = {
      method: req.method,
      url: url,
      headers,
      data: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
      proxy: false // Отключаем автоопределение прокси из env переменных
    };
    
    // Добавляем прокси агент только если он настроен
    if (proxyAgent) {
      axiosConfig.httpsAgent = proxyAgent;
      axiosConfig.httpAgent = proxyAgent;
    }
    
    const response = await axios(axiosConfig);

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
      console.log(`🚀 Sending axios request ${proxyAgent ? 'with proxy agent' : 'WITHOUT proxy'}...`);
      
      const axiosConfig = {
        method: req.method,
        url: url,
        headers,
        data: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        proxy: false // Отключаем автоопределение прокси из env переменных
      };
      
      // Добавляем прокси агент только если он настроен
      if (proxyAgent) {
        axiosConfig.httpsAgent = proxyAgent;
        axiosConfig.httpAgent = proxyAgent;
      }
      
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

// Image generation endpoint
app.post('/api/generate-nb-image', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ 
        error: 'Prompt is required' 
      });
    }

    const apiKey = process.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      logToFile('ERROR', 'OpenAI API key not configured for image generation');
      return res.status(500).json({ 
        error: 'OpenAI API key not configured' 
      });
    }

    logToFile('INFO', `Generating image for prompt: ${prompt}`);

    // Создаем заголовки для запроса к OpenAI
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    const imageRequest = {
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "b64_json"
    };

    const axiosConfig = {
      method: 'POST',
      url: 'https://api.openai.com/v1/images/generations',
      headers,
      data: JSON.stringify(imageRequest),
      proxy: false
    };
    
    // Добавляем прокси агент только если он настроен
    if (proxyAgent) {
      axiosConfig.httpsAgent = proxyAgent;
      axiosConfig.httpAgent = proxyAgent;
    }
    
    const response = await axios(axiosConfig);

    if (response.data && response.data.data && response.data.data[0] && response.data.data[0].b64_json) {
      const imageBase64 = response.data.data[0].b64_json;
      
      logToFile('INFO', `Image generated successfully for prompt: ${prompt}`);
      
      res.json({ 
        image_base64: imageBase64 
      });
    } else {
      logToFile('ERROR', 'Invalid response format from OpenAI image generation');
      res.status(500).json({ 
        error: 'Invalid response from image generation service' 
      });
    }

  } catch (error) {
    logToFile('ERROR', 'Image generation error', {
      error: error.message,
      stack: error.stack,
      prompt: req.body.prompt
    });
    
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
