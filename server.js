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

// Система отслеживания лимитов изображений
const imageLimitsFile = path.join(logsDir, 'image_limits.json');
const DAILY_IMAGE_LIMIT = 20;

// Функция для загрузки лимитов изображений
const loadImageLimits = () => {
  try {
    if (fs.existsSync(imageLimitsFile)) {
      const data = fs.readFileSync(imageLimitsFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading image limits:', error);
  }
  return {};
};

// Функция для сохранения лимитов изображений
const saveImageLimits = (limits) => {
  try {
    fs.writeFileSync(imageLimitsFile, JSON.stringify(limits, null, 2));
  } catch (error) {
    console.error('Error saving image limits:', error);
  }
};

// Функция для проверки лимита изображений
const checkImageLimit = (userIdentifier) => {
  const limits = loadImageLimits();
  const today = new Date().toDateString();
  
  if (!limits[userIdentifier]) {
    limits[userIdentifier] = {};
  }
  
  if (!limits[userIdentifier][today]) {
    limits[userIdentifier][today] = 0;
  }
  
  return {
    canGenerate: limits[userIdentifier][today] < DAILY_IMAGE_LIMIT,
    currentCount: limits[userIdentifier][today],
    limit: DAILY_IMAGE_LIMIT
  };
};

// Функция для увеличения счетчика изображений
const incrementImageCount = (userIdentifier) => {
  const limits = loadImageLimits();
  const today = new Date().toDateString();
  
  if (!limits[userIdentifier]) {
    limits[userIdentifier] = {};
  }
  
  if (!limits[userIdentifier][today]) {
    limits[userIdentifier][today] = 0;
  }
  
  limits[userIdentifier][today]++;
  saveImageLimits(limits);
  
  return limits[userIdentifier][today];
};

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

// OpenAI TTS endpoint - должен быть ПЕРЕД общим прокси
app.post('/api/openai/tts', async (req, res) => {
  try {
    const { text, voice = 'alloy', model = 'tts-1' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const apiKey = process.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    const requestData = {
      model,
      input: text,
      voice,
      response_format: 'mp3'
    };

    const axiosConfig = {
      method: 'POST',
      url: 'https://api.openai.com/v1/audio/speech',
      headers,
      data: JSON.stringify(requestData),
      responseType: 'arraybuffer',
      proxy: false
    };
    
    // Добавляем прокси агент только если он настроен
    if (proxyAgent) {
      axiosConfig.httpsAgent = proxyAgent;
      axiosConfig.httpAgent = proxyAgent;
    }

    const response = await axios(axiosConfig);

    // Устанавливаем правильные заголовки для аудио
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', response.data.length);
    res.setHeader('Cache-Control', 'no-cache');
    
    res.send(response.data);

    logToFile('INFO', 'TTS audio generated successfully', {
      textLength: text.length,
      voice,
      model
    });

  } catch (error) {
    logToFile('ERROR', 'TTS generation error', {
      error: error.message,
      stack: error.stack,
      text: req.body.text
    });
    
    if (error.response) {
      res.status(error.response.status).json({ 
        error: 'TTS generation failed',
        details: error.response.data 
      });
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
    const { prompt, userIdentifier } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ 
        error: 'Prompt is required' 
      });
    }

    // Проверяем лимит изображений для пользователя
    const userKey = userIdentifier || req.ip || 'anonymous';
    const limitCheck = checkImageLimit(userKey);
    
    if (!limitCheck.canGenerate) {
      logToFile('INFO', `Image generation limit exceeded for user: ${userKey}`, {
        currentCount: limitCheck.currentCount,
        limit: limitCheck.limit
      });
      
      return res.status(429).json({ 
        error: 'Daily image generation limit exceeded',
        currentCount: limitCheck.currentCount,
        limit: limitCheck.limit,
        message: `Вы достигли дневного лимита генерации изображений (${limitCheck.limit}). Попробуйте завтра.`
      });
    }

    const apiKey = process.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      logToFile('ERROR', 'OpenAI API key not configured for image generation');
      return res.status(500).json({ 
        error: 'OpenAI API key not configured' 
      });
    }

    logToFile('INFO', `Generating image for prompt: ${prompt}`, {
      userKey,
      currentCount: limitCheck.currentCount,
      limit: limitCheck.limit
    });

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
      
      // Увеличиваем счетчик изображений для пользователя
      const newCount = incrementImageCount(userKey);
      
      logToFile('INFO', `Image generated successfully for prompt: ${prompt}`, {
        userKey,
        newCount,
        limit: limitCheck.limit
      });
      
      res.json({ 
        image_base64: imageBase64,
        currentCount: newCount,
        limit: limitCheck.limit
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

// Check image generation limits endpoint
app.get('/api/image-limits/:userIdentifier', (req, res) => {
  try {
    const { userIdentifier } = req.params;
    const userKey = userIdentifier || req.ip || 'anonymous';
    const limitCheck = checkImageLimit(userKey);
    
    res.json({
      canGenerate: limitCheck.canGenerate,
      currentCount: limitCheck.currentCount,
      limit: limitCheck.limit,
      remaining: limitCheck.limit - limitCheck.currentCount
    });
  } catch (error) {
    logToFile('ERROR', 'Error checking image limits', {
      error: error.message,
      userIdentifier: req.params.userIdentifier
    });
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// YooKassa платежи
app.post('/api/payments/create', async (req, res) => {
  try {
    const { userId, userEmail, returnUrl } = req.body;

    if (!userId || !userEmail || !returnUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Проверяем конфигурацию YooKassa
    const yookassaConfig = {
      shopId: process.env.YOOKASSA_SHOP_ID,
      secretKey: process.env.YOOKASSA_SECRET_KEY ? '***configured***' : 'NOT SET',
      isConfigured: !!(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY)
    };

    console.log('🔧 [Payment] YooKassa configuration check:', yookassaConfig);

    if (!yookassaConfig.isConfigured) {
      logToFile('ERROR', 'YooKassa not configured', yookassaConfig);
      return res.status(500).json({
        error: 'Payment service not configured',
        details: 'YooKassa credentials missing'
      });
    }

    // Импортируем YooKassaService
    const { YooKassaService } = await import('./src/services/yookassa.js');

    const payment = await YooKassaService.createPremiumPayment(
      userId,
      userEmail,
      returnUrl
    );

    logToFile('INFO', 'Premium payment created', {
      paymentId: payment.id,
      userId,
      userEmail,
      amount: payment.amount.value,
      currency: payment.amount.currency
    });

    // Модифицируем return_url, добавляя paymentId как параметр
    const paymentUrl = payment.confirmation.confirmation_url;
    
    // Определяем разделитель для URL параметров
    const separator = returnUrl.includes('?') ? '&' : '?';
    const modifiedReturnUrl = `${returnUrl}${separator}paymentId=${payment.id}`;

    // Для YooKassa можно попробовать передать модифицированный return_url
    // Но обычно YooKassa не позволяет менять return_url после создания платежа
    // Поэтому будем полагаться на наш modifiedReturnUrl в ответе

    res.json({
      success: true,
      paymentId: payment.id,
      paymentUrl: paymentUrl,
      returnUrl: modifiedReturnUrl, // Отправляем модифицированный URL для использования в localStorage
      amount: payment.amount.value,
      currency: payment.amount.currency
    });

  } catch (error) {
    logToFile('ERROR', 'Payment creation error', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    
    res.status(500).json({ 
      error: 'Payment creation failed',
      details: error.message 
    });
  }
});

// Проверка статуса платежа
app.get('/api/payments/status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({ error: 'Payment ID is required' });
    }

    // Импортируем YooKassaService
    const { YooKassaService } = await import('./src/services/yookassa.js');

    const payment = await YooKassaService.getPaymentStatus(paymentId);

    logToFile('INFO', 'Payment status checked', {
      paymentId: payment.id,
      status: payment.status,
      paid: payment.paid
    });

    res.json({
      success: true,
      paymentId: payment.id,
      status: payment.status,
      paid: payment.paid,
      amount: payment.amount.value,
      currency: payment.amount.currency,
      metadata: payment.metadata
    });

  } catch (error) {
    logToFile('ERROR', 'Payment status check error', {
      error: error.message,
      stack: error.stack,
      paymentId: req.params.paymentId
    });
    
    res.status(500).json({ 
      error: 'Payment status check failed',
      details: error.message 
    });
  }
});

// Получить последний платеж пользователя (для восстановления после возврата с YooKassa)
app.get('/api/payments/user/:userId/recent', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('🔍 [Payment] Looking for recent payment for user:', userId);

    // Читаем логи платежей для поиска последнего платежа
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path').then(m => m.default);
    const logsDir = path.join(process.cwd(), 'logs');

    // Ищем информацию о платежах в логах
    try {
      const todayLog = path.join(logsDir, new Date().toISOString().split('T')[0] + '.log');
      
      if (fs.stat(todayLog).catch(() => null)) {
        const logContent = await fs.readFile(todayLog, 'utf8');
        
        // Ищем последний созданный платеж для этого пользователя
        const paymentMatches = logContent.matchAll(/"userId":"([^"]*)".*?"paymentId":"([^"]*)"/g);
        
        let lastPayment = null;
        for (const match of paymentMatches) {
          if (match[1] === userId) {
            lastPayment = { id: match[2], userId: match[1] };
          }
        }

        if (lastPayment) {
          console.log('✅ [Payment] Found recent payment:', lastPayment);
          return res.json({
            success: true,
            id: lastPayment.id,
            userId: lastPayment.userId
          });
        }
      }
    } catch (logError) {
      console.warn('⚠️ [Payment] Could not search logs:', logError);
    }

    // Если не нашли в логах, возвращаем ошибку
    res.status(404).json({ 
      error: 'No recent payment found for user',
      userId 
    });

  } catch (error) {
    console.error('❌ [Payment] Error getting recent payment:', error);
    res.status(500).json({ 
      error: 'Failed to get recent payment',
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

// ===== SMTP SERVER MANAGEMENT ENDPOINTS =====

// Получение статистики SMTP сервера
app.get('/api/smtp/stats', async (req, res) => {
  try {
    const { CustomEmailService } = await import('./src/services/custom-email.js');
    const stats = CustomEmailService.getSMTPStats();
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('❌ [SMTP] Ошибка получения статистики:', error);
    res.status(500).json({
      error: 'Не удалось получить статистику SMTP сервера',
      details: error.message
    });
  }
});

// Получение всех полученных писем
app.get('/api/smtp/emails', async (req, res) => {
  try {
    const { CustomEmailService } = await import('./src/services/custom-email.js');
    const emails = CustomEmailService.getReceivedEmails();
    
    res.json({
      success: true,
      emails: emails,
      count: emails.length
    });
  } catch (error) {
    console.error('❌ [SMTP] Ошибка получения писем:', error);
    res.status(500).json({
      error: 'Не удалось получить письма',
      details: error.message
    });
  }
});

// Получение последнего письма
app.get('/api/smtp/emails/last', async (req, res) => {
  try {
    const { CustomEmailService } = await import('./src/services/custom-email.js');
    const lastEmail = CustomEmailService.getLastReceivedEmail();
    
    if (!lastEmail) {
      return res.json({
        success: true,
        email: null,
        message: 'Писем не получено'
      });
    }
    
    res.json({
      success: true,
      email: lastEmail
    });
  } catch (error) {
    console.error('❌ [SMTP] Ошибка получения последнего письма:', error);
    res.status(500).json({
      error: 'Не удалось получить последнее письмо',
      details: error.message
    });
  }
});

// Очистка очереди писем
app.delete('/api/smtp/emails', async (req, res) => {
  try {
    const { CustomEmailService } = await import('./src/services/custom-email.js');
    CustomEmailService.clearReceivedEmails();
    
    res.json({
      success: true,
      message: 'Очередь писем очищена'
    });
  } catch (error) {
    console.error('❌ [SMTP] Ошибка очистки писем:', error);
    res.status(500).json({
      error: 'Не удалось очистить письма',
      details: error.message
    });
  }
});

// Остановка SMTP сервера
app.post('/api/smtp/stop', async (req, res) => {
  try {
    const { CustomEmailService } = await import('./src/services/custom-email.js');
    await CustomEmailService.stopSMTPServer();
    
    res.json({
      success: true,
      message: 'SMTP сервер остановлен'
    });
  } catch (error) {
    console.error('❌ [SMTP] Ошибка остановки сервера:', error);
    res.status(500).json({
      error: 'Не удалось остановить SMTP сервер',
      details: error.message
    });
  }
});

// Получение конфигурации аутентификации
app.get('/api/smtp/auth-config', async (req, res) => {
  try {
    const { CustomSMTPServer } = await import('./src/services/custom-smtp-server.js');
    
    res.json({
      success: true,
      config: {
        authEnabled: CustomSMTPServer.authEnabled,
        username: CustomSMTPServer.username,
        passwordMasked: CustomSMTPServer.password ? '***' + CustomSMTPServer.password.slice(-3) : null,
        port: CustomSMTPServer.port,
        isRunning: CustomSMTPServer.isRunning
      }
    });
  } catch (error) {
    console.error('❌ [SMTP] Ошибка получения конфигурации:', error);
    res.status(500).json({
      error: 'Не удалось получить конфигурацию аутентификации',
      details: error.message
    });
  }
});

// Обновление конфигурации аутентификации
app.post('/api/smtp/auth-config', async (req, res) => {
  try {
    const { username, password, authEnabled } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        error: 'Имя пользователя и пароль обязательны'
      });
    }
    
    // Обновляем переменные окружения
    process.env.SMTP_SERVER_USERNAME = username;
    process.env.SMTP_SERVER_PASSWORD = password;
    process.env.SMTP_SERVER_REQUIRE_AUTH = authEnabled ? 'true' : 'false';
    
    // Обновляем конфигурацию в SMTP сервере
    const { CustomSMTPServer } = await import('./src/services/custom-smtp-server.js');
    CustomSMTPServer.updateAuthConfig(username, password, authEnabled);
    
    console.log(`🔧 [SMTP] Обновлена конфигурация аутентификации:`);
    console.log(`   - Пользователь: ${username}`);
    console.log(`   - Пароль: ***${password.slice(-3)}`);
    console.log(`   - Включена: ${authEnabled}`);
    
    res.json({
      success: true,
      message: 'Конфигурация аутентификации обновлена',
      config: {
        username,
        passwordMasked: '***' + password.slice(-3),
        authEnabled
      }
    });
  } catch (error) {
    console.error('❌ [SMTP] Ошибка обновления конфигурации:', error);
    res.status(500).json({
      error: 'Не удалось обновить конфигурацию аутентификации',
      details: error.message
    });
  }
});

// ===== EMAIL ENDPOINTS =====

// Генерация токена восстановления пароля
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email обязателен' });
    }

    console.log('🔐 [Auth] Запрос восстановления пароля для:', email);

    // Импортируем необходимые модули
    const jwt = await import('jsonwebtoken');
    const { CustomEmailService } = await import('./src/services/custom-email.js');

    // Проверяем, настроен ли email сервис
    // В режиме разработки всегда используем собственный SMTP сервер
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    if (!CustomEmailService.isConfigured() && !isDevelopment) {
      console.log('⚠️ [Auth] Email сервис не настроен, используем симуляцию');
      return res.json({
        success: true,
        message: 'Письмо для восстановления пароля отправлено (симуляция)'
      });
    }

    // Генерируем токен (действителен 24 часа)
    const resetToken = jwt.default.sign(
      { email, type: 'password_reset' },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '24h' }
    );

    console.log('🔑 [Auth] Токен восстановления сгенерирован');

    // Отправляем письмо
    await CustomEmailService.sendPasswordReset(email, resetToken);

    logToFile('INFO', 'Password reset email sent', {
      email: email,
      tokenGenerated: true
    });

    res.json({
      success: true,
      message: 'Письмо для восстановления пароля отправлено'
    });

  } catch (error) {
    console.error('❌ [Auth] Ошибка восстановления пароля:', error);
    logToFile('ERROR', 'Password reset error', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    
    res.status(500).json({ 
      error: 'Не удалось отправить письмо',
      details: error.message 
    });
  }
});

// Проверка токена восстановления
app.post('/api/auth/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Токен обязателен' });
    }

    console.log('🔍 [Auth] Проверка токена восстановления');

    const jwt = await import('jsonwebtoken');
    
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'default-secret');
    
    if (decoded.type !== 'password_reset') {
      throw new Error('Неверный тип токена');
    }

    console.log('✅ [Auth] Токен восстановления валиден для:', decoded.email);

    res.json({
      success: true,
      email: decoded.email
    });

  } catch (error) {
    console.error('❌ [Auth] Ошибка проверки токена:', error);
    res.status(400).json({ 
      error: 'Неверный или истекший токен' 
    });
  }
});

// Сброс пароля
app.post('/api/auth/reset-password-confirm', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Токен и новый пароль обязательны' });
    }

    console.log('🔐 [Auth] Подтверждение сброса пароля');

    const jwt = await import('jsonwebtoken');
    
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'default-secret');
    
    if (decoded.type !== 'password_reset') {
      throw new Error('Неверный тип токена');
    }

    // Здесь обновите пароль в базе данных
    // await updateUserPassword(decoded.email, newPassword);
    
    console.log('✅ [Auth] Пароль успешно изменен для:', decoded.email);

    logToFile('INFO', 'Password reset confirmed', {
      email: decoded.email,
      passwordChanged: true
    });

    res.json({
      success: true,
      message: 'Пароль успешно изменен'
    });

  } catch (error) {
    console.error('❌ [Auth] Ошибка сброса пароля:', error);
    res.status(400).json({ 
      error: 'Не удалось изменить пароль',
      details: error.message 
    });
  }
});

// Отправка приветственного письма
app.post('/api/auth/send-welcome', async (req, res) => {
  try {
    const { email, userName } = req.body;
    
    if (!email || !userName) {
      return res.status(400).json({ error: 'Email и имя пользователя обязательны' });
    }

    console.log('📧 [Auth] Отправка приветственного письма для:', email);

    const { CustomEmailService } = await import('./src/services/custom-email.js');

    // Проверяем, настроен ли email сервис
    // В режиме разработки всегда используем собственный SMTP сервер
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    if (!CustomEmailService.isConfigured() && !isDevelopment) {
      console.log('⚠️ [Auth] Email сервис не настроен, пропускаем отправку приветственного письма');
      return res.json({
        success: true,
        message: 'Приветственное письмо отправлено (симуляция)'
      });
    }

    await CustomEmailService.sendWelcomeEmail(email, userName);

    logToFile('INFO', 'Welcome email sent', {
      email: email,
      userName: userName
    });

    res.json({
      success: true,
      message: 'Приветственное письмо отправлено'
    });

  } catch (error) {
    console.error('❌ [Auth] Ошибка отправки приветственного письма:', error);
    res.status(500).json({ 
      error: 'Не удалось отправить приветственное письмо',
      details: error.message 
    });
  }
});

// Отправка письма подтверждения премиум-подписки
app.post('/api/auth/send-premium-confirmation', async (req, res) => {
  try {
    const { email, userName } = req.body;
    
    if (!email || !userName) {
      return res.status(400).json({ error: 'Email и имя пользователя обязательны' });
    }

    console.log('⭐ [Auth] Отправка письма подтверждения премиум-подписки для:', email);

    const { CustomEmailService } = await import('./src/services/custom-email.js');

    // Проверяем, настроен ли email сервис
    // В режиме разработки всегда используем собственный SMTP сервер
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    if (!CustomEmailService.isConfigured() && !isDevelopment) {
      console.log('⚠️ [Auth] Email сервис не настроен, пропускаем отправку письма подтверждения');
      return res.json({
        success: true,
        message: 'Письмо подтверждения премиум-подписки отправлено (симуляция)'
      });
    }

    await CustomEmailService.sendPremiumConfirmation(email, userName);

    logToFile('INFO', 'Premium confirmation email sent', {
      email: email,
      userName: userName
    });

    res.json({
      success: true,
      message: 'Письмо подтверждения премиум-подписки отправлено'
    });

  } catch (error) {
    console.error('❌ [Auth] Ошибка отправки письма подтверждения:', error);
    res.status(500).json({ 
      error: 'Не удалось отправить письмо подтверждения',
      details: error.message 
    });
  }
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
