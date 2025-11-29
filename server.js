import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';
import crypto from 'crypto';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import multer from 'multer';

// Загружаем переменные окружения
dotenv.config();

// ===== UTILITY FUNCTIONS =====

// Функция для верификации подписи YooKassa webhook
function verifySignature(body, signature, secretKey) {
  try {
    // Создаем HMAC-SHA256 подпись
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(JSON.stringify(body), 'utf8');
    const calculatedSignature = hmac.digest('hex');

    // Сравниваем подписи
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(calculatedSignature, 'hex')
    );
  } catch (error) {
    console.error('❌ [Signature] Verification failed:', error);
    return false;
  }
}

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

// ===== SQLite DATABASE SETUP =====
const dbPath = path.join(process.cwd(), 'data.sqlite');
let db = null;

// Функция для инициализации базы данных
async function initializeDatabase() {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    console.log('🗄️ [Database] Connected to SQLite database:', dbPath);

    // Включаем foreign keys
    await db.exec('PRAGMA foreign_keys = ON');

    // Инициализируем таблицы если их нет
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        ingredients TEXT NOT NULL,
        instructions TEXT NOT NULL,
        cook_time TEXT,
        servings INTEGER,
        difficulty TEXT,
        category TEXT,
        cuisine TEXT,
        tips TEXT,
        image TEXT,
        author_id INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        rating REAL DEFAULT 0,
        likes INTEGER DEFAULT 0,
        favorites INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY (author_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        likes INTEGER DEFAULT 0,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id),
        FOREIGN KEY (author_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS user_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        recipe_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user_id, recipe_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
      );

      CREATE TABLE IF NOT EXISTS user_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        recipe_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user_id, recipe_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
      );
    `);

    // Add health_profile column to users table if it doesn't exist
    try {
      await db.run(`ALTER TABLE users ADD COLUMN health_profile TEXT DEFAULT NULL`);
      console.log('✅ [Database] Added health_profile column to users table');
    } catch (alterError) {
      // Column might already exist, ignore error
      if (alterError.message.includes('duplicate column name')) {
        console.log('ℹ️ [Database] health_profile column already exists');
      } else {
        console.warn('⚠️ [Database] Error adding health_profile column:', alterError.message);
      }
    }

    console.log('✅ [Database] Tables initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ [Database] Failed to initialize database:', error);
    process.exit(1);
  }
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

// Настройка multer для обработки аудио файлов
const upload = multer({
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB максимум для аудио
  },
  fileFilter: (req, file, cb) => {
    // Разрешаем только аудио форматы
    const allowedMimes = [
      'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg',
      'audio/flac', 'audio/aac', 'audio/m4a'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый формат аудио файла'));
    }
  }
});

const app = express();
const PORT = process.env.PORT || 1041;

// Middleware для обработки raw body (нужно для webhook подписи)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Остальные middleware
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

// Static serve files from dist with no-cache for all files to force fresh loading
app.use(express.static('dist', {
  setHeaders: (res, path) => {
    // No-cache for all files to ensure fresh loading
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// ===== DATABASE ROUTES =====

// Получить все рецепты (с фильтрацией по статусу)
app.get('/api/recipes', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { status, moderator } = req.query;
    let query = 'SELECT * FROM recipes';
    let params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const recipes = await db.all(query, params);

    console.log(`📖 [Database] Retrieved ${recipes.length} recipes${status ? ` with status: ${status}` : ''}`);
    res.json(recipes);
  } catch (error) {
    console.error('❌ [Database] Error retrieving recipes:', error);
    res.status(500).json({ error: 'Failed to retrieve recipes' });
  }
});

// Получить рецепты на модерацию (только для администраторов)
app.get('/api/admin/pending-recipes', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const recipes = await db.all(
      'SELECT * FROM recipes WHERE status = ? ORDER BY created_at DESC',
      ['pending']
    );

    console.log(`📋 [Database] Retrieved ${recipes.length} pending recipes for moderation`);
    res.json(recipes);
  } catch (error) {
    console.error('❌ [Database] Error retrieving pending recipes:', error);
    res.status(500).json({ error: 'Failed to retrieve pending recipes' });
  }
});

// Получить опубликованные рецепты (только для администраторов)
app.get('/api/admin/published-recipes', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const recipes = await db.all(
      'SELECT * FROM recipes WHERE status = ? ORDER BY created_at DESC',
      ['approved']
    );

    console.log(`📖 [Database] Retrieved ${recipes.length} published recipes for admin management`);
    res.json(recipes);
  } catch (error) {
    console.error('❌ [Database] Error retrieving published recipes:', error);
    res.status(500).json({ error: 'Failed to retrieve published recipes' });
  }
});

// Одобрить рецепт
app.put('/api/recipes/:id/approve', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { id } = req.params;
    const { moderatorId, reason } = req.body;

    const now = new Date().toISOString();
    const result = await db.run(
      'UPDATE recipes SET status = ?, moderated_by = ?, moderated_at = ?, moderation_reason = ?, updated_at = ? WHERE id = ?',
      ['approved', moderatorId || null, now, reason || 'Одобрен администратором', now, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    console.log(`✅ [Database] Recipe ${id} approved by moderator ${moderatorId}`);
    res.json({ message: 'Recipe approved successfully' });
  } catch (error) {
    console.error('❌ [Database] Error approving recipe:', error);
    res.status(500).json({ error: 'Failed to approve recipe' });
  }
});

// Отклонить рецепт
app.put('/api/recipes/:id/reject', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { id } = req.params;
    const { moderatorId, reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required for rejection' });
    }

    const now = new Date().toISOString();
    const result = await db.run(
      'UPDATE recipes SET status = ?, moderated_by = ?, moderated_at = ?, moderation_reason = ?, updated_at = ? WHERE id = ?',
      ['rejected', moderatorId || null, now, reason, now, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    console.log(`❌ [Database] Recipe ${id} rejected by moderator ${moderatorId}`);
    res.json({ message: 'Recipe rejected successfully' });
  } catch (error) {
    console.error('❌ [Database] Error rejecting recipe:', error);
    res.status(500).json({ error: 'Failed to reject recipe' });
  }
});

// Получить все рецепты пользователя
app.get('/api/recipes/user/:userId', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { userId } = req.params;
    const recipes = await db.all(
      'SELECT * FROM recipes WHERE author_id = ? ORDER BY created_at DESC',
      [userId]
    );

    console.log(`📖 [Database] Retrieved ${recipes.length} recipes for user ${userId}`);
    res.json(recipes);
  } catch (error) {
    console.error('❌ [Database] Error retrieving user recipes:', error);
    res.status(500).json({ error: 'Failed to retrieve recipes' });
  }
});

// Сохранить рецепт
app.post('/api/recipes', async (req, res) => {
  try {
    if (!db) {
      console.error('❌ [Database] Database not initialized');
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { title, description, ingredients, instructions, cookTime, servings, difficulty, cuisine, tips, image, authorId } = req.body;

    console.log('📝 [Database] Received recipe save request:', {
      title: title?.substring(0, 30),
      authorId,
      ingredientsType: Array.isArray(ingredients) ? 'array' : typeof ingredients,
      instructionsType: Array.isArray(instructions) ? 'array' : typeof instructions
    });

    if (!title || !ingredients || !instructions) {
      console.warn('⚠️ [Database] Missing required fields:', { title: !!title, ingredients: !!ingredients, instructions: !!instructions });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const now = new Date().toISOString();
    const result = await db.run(
      `INSERT INTO recipes (title, description, ingredients, instructions, cook_time, servings, difficulty, cuisine, tips, image, author_id, created_at, updated_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description || '',
        JSON.stringify(ingredients),
        JSON.stringify(instructions),
        cookTime || '',
        servings || 0,
        difficulty || 'Medium',
        cuisine || '',
        tips || '',
        image || null,
        authorId || null,
        now,
        now,
        'pending' // Новые рецепты ждут модерации
      ]
    );

    console.log(`✅ [Database] Recipe saved with ID: ${result.lastID}`);
    res.json({ id: result.lastID, message: 'Recipe saved successfully' });
  } catch (error) {
    console.error('❌ [Database] Error saving recipe:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to save recipe', details: error.message });
  }
});

// Получить рецепт по ID
app.get('/api/recipes/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { id } = req.params;
    const recipe = await db.get(
      'SELECT * FROM recipes WHERE id = ?',
      [id]
    );

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Парсим JSON поля
    recipe.ingredients = JSON.parse(recipe.ingredients);
    recipe.instructions = JSON.parse(recipe.instructions);

    res.json(recipe);
  } catch (error) {
    console.error('❌ [Database] Error retrieving recipe:', error);
    res.status(500).json({ error: 'Failed to retrieve recipe' });
  }
});

// Удалить рецепт
app.delete('/api/recipes/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { id } = req.params;
    const result = await db.run(
      'DELETE FROM recipes WHERE id = ?',
      [id]
    );

    if (result.changes > 0) {
      console.log(`✅ [Database] Recipe ${id} deleted successfully`);
      res.json({ message: 'Recipe deleted successfully' });
    } else {
      res.status(404).json({ error: 'Recipe not found' });
    }
  } catch (error) {
    console.error('❌ [Database] Error deleting recipe:', error);
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

// Зарегистрировать пользователя
app.post('/api/auth/register', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { name, email, passwordHash } = req.body;

    if (!name || !email || !passwordHash) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const now = new Date().toISOString();
    const result = await db.run(
      'INSERT INTO users (email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [email, passwordHash, 'user', now, now]
    );

    console.log(`✅ [Database] User registered with ID: ${result.lastID}`);
    res.json({
      id: result.lastID,
      name,
      email,
      role: 'user',
      message: 'User registered successfully'
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      console.warn(`⚠️ [Database] User already exists: ${req.body.email}`);
      return res.status(400).json({ error: 'User already exists' });
    }
    console.error('❌ [Database] Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Health profile endpoints
app.get('/api/health-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get health profile from database
    const profile = await db.get('SELECT health_profile FROM users WHERE id = ?', [userId]);

    if (!profile || !profile.health_profile) {
      return res.json({
        conditions: [],
        dietaryRestrictions: [],
        allergies: [],
        notes: ''
      });
    }

    const healthProfile = JSON.parse(profile.health_profile);
    res.json(healthProfile);
  } catch (error) {
    console.error('❌ [Health Profile API] Error getting profile:', error);
    res.status(500).json({ error: 'Failed to get health profile' });
  }
});

app.post('/api/health-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const healthProfile = req.body;

    // Validate health profile structure
    if (!healthProfile || typeof healthProfile !== 'object') {
      return res.status(400).json({ error: 'Invalid health profile data' });
    }

    // Save health profile to database
    await db.run(
      'UPDATE users SET health_profile = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(healthProfile), new Date().toISOString(), userId]
    );

    console.log('✅ [Health Profile API] Profile saved for user:', userId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [Health Profile API] Error saving profile:', error);
    res.status(500).json({ error: 'Failed to save health profile' });
  }
});

// Войти в аккаунт
app.post('/api/auth/login', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { email, passwordHash } = req.body;

    if (!email || !passwordHash) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await db.get(
      'SELECT id, email, role, created_at, updated_at FROM users WHERE email = ? AND password_hash = ?',
      [email, passwordHash]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log(`✅ [Database] User logged in: ${user.id} (${user.role})`);
    res.json({
      id: user.id,
      name: email.split('@')[0], // Extract name from email as fallback
      email: user.email,
      role: user.role || 'user',
      message: 'Login successful'
    });
  } catch (error) {
    console.error('❌ [Database] Error logging in:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Получить пользователя по email
app.get('/api/auth/user/:email', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { email } = req.params;
    const user = await db.get(
      'SELECT id, email, role, created_at, updated_at FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      name: email.split('@')[0], // Extract name from email as fallback
      email: user.email,
      role: user.role || 'user',
      created_at: user.created_at,
      updated_at: user.updated_at
    });
  } catch (error) {
    console.error('❌ [Database] Error retrieving user:', error);
    res.status(500).json({ error: 'Failed to retrieve user' });
  }
});

// ===== ROUTES =====

// OpenAI TTS endpoint - должен быть ПЕРЕД общим прокси
app.post('/api/openai/tts', async (req, res) => {
  try {
    const { text, voice = 'alloy', model = 'tts-1' } = req.body;

    console.log('🎯 [TTS API] Получен запрос:', {
      textType: typeof text,
      textLength: text ? text.length : 'undefined',
      textPreview: (typeof text === 'string' && text) ? text.substring(0, 100) : 'undefined',
      voice,
      model,
      body: req.body
    });

    if (!text || typeof text !== 'string') {
      console.error('❌ [TTS API] Текст не является строкой:', text);
      return res.status(400).json({ error: 'Text must be a non-empty string' });
    }

    if (!text.trim()) {
      console.error('❌ [TTS API] Получена пустая строка');
      return res.status(400).json({ error: 'Text cannot be empty' });
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
    console.error('❌ [TTS API] Ошибка генерации речи:', {
      error: error.message,
      stack: error.stack,
      text: req.body.text,
      textType: typeof req.body.text,
      fullError: error,
      requestData: {
        text: req.body.text,
        voice: req.body.voice,
        model: req.body.model
      }
    });

    logToFile('ERROR', 'TTS generation error', {
      error: error.message,
      stack: error.stack,
      text: req.body.text,
      textType: typeof req.body.text,
      requestData: req.body
    });

    if (error.response) {
      console.error('❌ [TTS API] OpenAI API error response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });

      // Возвращаем более детальную ошибку для отладки
      res.status(error.response.status).json({
        error: 'TTS generation failed',
        details: error.response.data,
        openai_status: error.response.status,
        request_text: req.body.text ? req.body.text.substring(0, 100) : 'undefined'
      });
    } else {
      console.error('❌ [TTS API] Network or other error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// OpenAI DALL-E 3 endpoint для генерации изображений
app.post('/api/openai/generate-image', async (req, res) => {
  try {
    const { prompt, model = 'dall-e-3', size = '1024x1024', quality = 'standard' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
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
      prompt: prompt,
      model: model,
      size: size,
      quality: quality,
      n: 1
    };

    const axiosConfig = {
      method: 'POST',
      url: 'https://api.openai.com/v1/images/generations',
      headers,
      data: JSON.stringify(requestData),
      proxy: false
    };

    // Добавляем прокси агент только если он настроен
    if (proxyAgent) {
      axiosConfig.httpsAgent = proxyAgent;
      axiosConfig.httpAgent = proxyAgent;
    }

    console.log('🎨 [DALL-E] Generating image with prompt:', prompt.substring(0, 100) + '...');

    const response = await axios(axiosConfig);

    logToFile('INFO', 'DALL-E image generated successfully', {
      prompt: prompt.substring(0, 100),
      model,
      size
    });

    // Возвращаем URL сгенерированного изображения
    if (response.data && response.data.data && response.data.data[0] && response.data.data[0].url) {
      res.json({
        success: true,
        imageUrl: response.data.data[0].url,
        prompt: prompt,
        model: model,
        size: size
      });
    } else {
      throw new Error('Invalid response from DALL-E API');
    }

  } catch (error) {
    logToFile('ERROR', 'DALL-E image generation error', {
      error: error.message,
      stack: error.stack,
      prompt: req.body.prompt
    });

    if (error.response) {
      res.status(error.response.status).json({
        error: 'Image generation failed',
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

// OpenAI Audio API роут - специальная обработка для файлов
app.post('/api/openai/v1/audio/transcriptions', upload.single('file'), async (req, res) => {
  try {
    const apiKey = process.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      logToFile('ERROR', 'OpenAI API key not configured for audio transcription');
      return res.status(500).json({
        error: 'OpenAI API key not configured'
      });
    }

    // Проверяем формат API ключа
    if (!apiKey.startsWith('sk-')) {
      console.error('❌ [OpenAI Audio] Invalid API key format');
      return res.status(500).json({
        error: 'Invalid OpenAI API key format'
      });
    }

    console.log('🎵 [OpenAI Audio] Starting transcription request');

    // Создаем новый FormData для отправки в OpenAI
    const formData = new FormData();

    // Копируем все поля из оригинального запроса
    for (const [key, value] of Object.entries(req.body)) {
      if (key === 'file' && req.file) {
        // Если есть файл, добавляем его
        formData.append('file', req.file.buffer, {
          filename: req.file.originalname,
          contentType: req.file.mimetype
        });
      } else {
        formData.append(key, value);
      }
    }

    // Добавляем файл из multipart/form-data если он есть
    if (req.files && req.files.file) {
      const file = req.files.file;
      formData.append('file', file.data, {
        filename: file.name,
        contentType: file.mimetype
      });
    }

    // Устанавливаем язык на русский по умолчанию
    if (!formData.has('language')) {
      formData.append('language', 'ru');
    }

    const axiosConfig = {
      method: 'POST',
      url: 'https://api.openai.com/v1/audio/transcriptions',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        // Не устанавливаем Content-Type, axios сделает это автоматически для FormData
      },
      data: formData,
      proxy: false,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    };

    // Добавляем прокси агент если настроен
    if (proxyAgent) {
      axiosConfig.httpsAgent = proxyAgent;
      axiosConfig.httpAgent = proxyAgent;
    }

    console.log('🎵 [OpenAI Audio] Sending transcription request to OpenAI');

    const response = await axios(axiosConfig);

    logToFile('INFO', 'Audio transcription successful', {
      responseSize: JSON.stringify(response.data).length
    });

    // Возвращаем результат как есть
    res.status(response.status).send(response.data);

  } catch (error) {
    console.error('❌ [OpenAI Audio] Transcription error:', error.message);

    logToFile('ERROR', 'Audio transcription failed', {
      error: error.message,
      stack: error.stack
    });

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        error: 'Audio transcription failed',
        details: error.message
      });
    }
  }
});

// OpenAI API роут - проксирование для остальных запросов OpenAI
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

// Роут для получения списка моделей OpenAI
app.get('/api/openai/v1/models', async (req, res) => {
  try {
    const apiKey = process.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      logToFile('ERROR', 'OpenAI API key not configured for models');
      return res.status(500).json({
        error: 'OpenAI API key not configured'
      });
    }

    const url = 'https://api.openai.com/v1/models';

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [OpenAI Models] API Error:', response.status, errorText);
      return res.status(response.status).send(errorText);
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('❌ [OpenAI Models] Error:', error);
    logToFile('ERROR', 'OpenAI Models error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Роут для стриминга OpenAI chat completions
app.all('/api/openai/v1/chat/completions', async (req, res) => {
  try {
    const apiKey = process.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      console.error('❌ [OpenAI Streaming] API key not configured!');
      logToFile('ERROR', 'OpenAI API key not configured for streaming');
      return res.status(500).json({
        error: 'OpenAI API key not configured'
      });
    }

    // Проверяем формат API ключа (должен начинаться с sk-)
    if (!apiKey.startsWith('sk-')) {
      console.error('❌ [OpenAI Streaming] Invalid API key format (should start with sk-)');
      return res.status(500).json({
        error: 'Invalid OpenAI API key format'
      });
    }

    console.log('✅ [OpenAI Streaming] API key configured (length:', apiKey.length + ')');

    const url = 'https://api.openai.com/v1/chat/completions';

    // Создаем заголовки для запроса к OpenAI
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...req.headers
    };

    // Удаляем host заголовок
    delete headers.host;

    console.log('🎯 [OpenAI Streaming] Request:', {
      url,
      method: req.method,
      model: req.body?.model,
      messagesCount: req.body?.messages?.length,
      contentLength: req.headers['content-length'],
      bodyPreview: JSON.stringify(req.body).substring(0, 200)
    });

    // Устанавливаем таймаут (5 минут)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

    let response;
    try {
      response = await fetch(url, {
        method: req.method,
        headers,
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        signal: controller.signal,
        ...(proxyAgent && {
          agent: proxyAgent
        })
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('❌ [OpenAI Streaming] Request timed out');
        return res.status(504).json({ error: 'Request timed out' });
      }
      throw fetchError;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [OpenAI Streaming] API Error:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText
      });
      return res.status(response.status).json(JSON.parse(errorText) || { error: errorText });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error('❌ [OpenAI Streaming] Error:', error);
    logToFile('ERROR', `OpenAI Streaming error: ${error.message}`);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.all('/api/openai/v1/chat/completions', async (req, res) => {
  try {
    const apiKey = process.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      console.error('❌ [OpenAI Streaming] API key not configured!');
      logToFile('ERROR', 'OpenAI API key not configured for streaming');
      return res.status(500).json({
        error: 'OpenAI API key not configured'
      });
    }

    // Проверяем формат API ключа (должен начинаться с sk-)
    if (!apiKey.startsWith('sk-')) {
      console.error('❌ [OpenAI Streaming] Invalid API key format (should start with sk-)');
      return res.status(500).json({
        error: 'Invalid OpenAI API key format'
      });
    }

    console.log('✅ [OpenAI Streaming] API key configured (length:', apiKey.length + ')');

    const url = 'https://api.openai.com/v1/chat/completions';

    // Создаем заголовки для запроса к OpenAI
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...req.headers
    };

    // Удаляем host заголовок
    delete headers.host;

    console.log('🎯 [OpenAI Streaming] Starting stream proxy:', {
      url,
      method: req.method,
      hasStream: req.body?.stream,
      model: req.body?.model,
      messageCount: req.body?.messages?.length,
      contentLength: req.headers['content-length'],
      userAgent: req.headers['user-agent']?.substring(0, 100),
      bodyPreview: JSON.stringify(req.body).substring(0, 200)
    });

    // Проверяем содержимое messages
    if (req.body?.messages) {
      console.log('📨 [OpenAI Streaming] Messages preview:', req.body.messages.map((msg, i) => ({
        index: i,
        role: msg.role,
        contentLength: msg.content?.length || 0,
        contentPreview: msg.content?.substring(0, 100)
      })));
    }

    // Устанавливаем таймаут для стриминга (5 минут)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minutes

    let response;
    try {
      // Используем fetch для стриминга вместо axios
      response = await fetch(url, {
        method: req.method,
        headers,
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        signal: controller.signal,
        // Настройка прокси если нужна
        ...(proxyAgent && {
          agent: proxyAgent
        })
      });

      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('❌ [OpenAI Streaming] Request timed out');
        return res.status(504).json({ error: 'Request timed out' });
      }
      throw fetchError;
    }

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Unable to read error response';
      }

      console.error('❌ [OpenAI Streaming] API Error:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
        headers: Object.fromEntries(response.headers.entries())
      });

      // Пытаемся распарсить JSON ошибку для более понятного ответа
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          console.error('❌ [OpenAI Streaming] Parsed error:', errorData.error);
        }
      } catch (parseError) {
        // Игнорируем ошибки парсинга
      }

      return res.status(response.status).send(errorText || `OpenAI API Error: ${response.status}`);
    }

    // Устанавливаем заголовки для стриминга
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Читаем поток от OpenAI и передаем клиенту
    const reader = response.body?.getReader();
    if (!reader) {
      console.error('❌ [OpenAI Streaming] No reader available');
      return res.status(500).json({ error: 'Stream reader not available' });
    }

    const decoder = new TextDecoder();

    try {
      let chunkCount = 0;
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('✅ [OpenAI Streaming] Stream completed, total chunks:', chunkCount);
          res.end();
          break;
        }

        chunkCount++;
        const chunk = decoder.decode(value, { stream: true });
        console.log(`📦 [OpenAI Streaming] Sending chunk ${chunkCount}: ${chunk.length} chars`);

        // Отправляем чанк клиенту сразу
        res.write(chunk);

        // Маленькая задержка для предотвращения перегрузки
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    } catch (streamError) {
      console.error('❌ [OpenAI Streaming] Stream error:', streamError);
      res.end();
    }

  } catch (error) {
    console.error('❌ [OpenAI Streaming] Proxy error:', error);
    logToFile('ERROR', 'OpenAI Streaming Proxy error', {
      error: error.message,
      stack: error.stack
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

// Получить статус платежа
app.get('/api/payments/status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;

    console.log('💰 Server: Checking payment status for:', paymentId);

    // Импортируем YooKassaService
    const { YooKassaService } = await import('./src/services/yookassa.js');

    // Получаем информацию о платеже из YooKassa
    const paymentInfo = await YooKassaService.getPaymentStatus(paymentId);

    if (!paymentInfo) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    console.log('💰 Server: Payment status response:', {
      id: paymentInfo.id,
      status: paymentInfo.status,
      paid: paymentInfo.paid,
      amount: paymentInfo.amount
    });

    res.json({
      success: true,
      paymentId: paymentInfo.id,
      status: paymentInfo.status,
      paid: paymentInfo.paid,
      amount: paymentInfo.amount,
      metadata: paymentInfo.metadata,
      created_at: paymentInfo.created_at
    });

  } catch (error) {
    console.error('❌ Server: Error checking payment status:', error);
    logToFile('ERROR', 'Payment status check failed', {
      paymentId: req.params.paymentId,
      error: error.message
    });
    res.status(500).json({
      error: 'Failed to check payment status',
      details: error.message
    });
  }
});

// Подтвердить платеж и активировать подписку
app.post('/api/payments/confirm', async (req, res) => {
  try {
    const { paymentId, userId } = req.body;

    console.log('💰 Server: Confirming payment:', { paymentId, userId });

    if (!paymentId || !userId) {
      return res.status(400).json({ error: 'PaymentId and userId are required' });
    }

    // Импортируем YooKassaService
    const { YooKassaService } = await import('./src/services/yookassa.js');

    // Проверяем статус платежа еще раз
    const paymentInfo = await YooKassaService.getPaymentStatus(paymentId);

    if (!paymentInfo) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (paymentInfo.status !== 'succeeded' || !paymentInfo.paid) {
      return res.status(400).json({
        error: 'Payment not completed successfully',
        status: paymentInfo.status,
        paid: paymentInfo.paid
      });
    }

    // Активируем подписку для пользователя
    // В реальном приложении здесь должна быть логика активации подписки
    console.log('✅ Server: Activating premium subscription for user:', userId);

    // Сохраняем информацию о подписке в базе данных или файле
    const subscriptionData = {
      userId: userId,
      paymentId: paymentId,
      activatedAt: new Date().toISOString(),
      amount: paymentInfo.amount.value,
      currency: paymentInfo.amount.currency,
      status: 'active'
    };

    // Временное решение - сохраняем в файл (в продакшене должна быть БД)
    try {
      const fs = await import('fs');
      const path = await import('path');

      const subscriptionsDir = path.join(process.cwd(), 'data');
      const subscriptionsFile = path.join(subscriptionsDir, 'subscriptions.json');

      // Создаем директорию если не существует
      if (!fs.existsSync(subscriptionsDir)) {
        fs.mkdirSync(subscriptionsDir, { recursive: true });
      }

      // Читаем существующие подписки
      let subscriptions = [];
      if (fs.existsSync(subscriptionsFile)) {
        const data = fs.readFileSync(subscriptionsFile, 'utf8');
        subscriptions = JSON.parse(data || '[]');
      }

      // Добавляем новую подписку
      subscriptions.push(subscriptionData);

      // Сохраняем обратно
      fs.writeFileSync(subscriptionsFile, JSON.stringify(subscriptions, null, 2));

      console.log('✅ Server: Subscription activated and saved:', subscriptionData);

    } catch (fileError) {
      console.error('❌ Server: Failed to save subscription data:', fileError);
      // Не возвращаем ошибку, так как платеж уже прошел
    }

    logToFile('INFO', 'Premium subscription activated', {
      userId,
      paymentId,
      amount: paymentInfo.amount.value,
      currency: paymentInfo.amount.currency
    });

    res.json({
      success: true,
      message: 'Subscription activated successfully',
      subscription: subscriptionData
    });

  } catch (error) {
    console.error('❌ Server: Error confirming payment:', error);
    logToFile('ERROR', 'Payment confirmation failed', {
      paymentId: req.body.paymentId,
      userId: req.body.userId,
      error: error.message
    });
    res.status(500).json({
      error: 'Failed to confirm payment',
      details: error.message
    });
  }
});

// Получить недавние платежи пользователя (для восстановления в случае потери paymentId)
app.get('/api/payments/user/:userId/recent', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 5 } = req.query;

    console.log('💰 Server: Getting recent payments for user:', userId);

    // В реальном приложении здесь должен быть запрос к БД
    // Временное решение - возвращаем пустой массив
    // Для тестирования можно добавить логику поиска в файле subscriptions.json

    try {
      const fs = await import('fs');
      const path = await import('path');

      const subscriptionsFile = path.join(process.cwd(), 'data', 'subscriptions.json');

      if (fs.existsSync(subscriptionsFile)) {
        const data = fs.readFileSync(subscriptionsFile, 'utf8');
        const subscriptions = JSON.parse(data || '[]');

        // Находим подписки пользователя
        const userSubscriptions = subscriptions
          .filter(sub => sub.userId === userId)
          .sort((a, b) => new Date(b.activatedAt) - new Date(a.activatedAt))
          .slice(0, parseInt(limit));

        console.log('💰 Server: Found user subscriptions:', userSubscriptions.length);

        if (userSubscriptions.length > 0) {
          // Возвращаем самый свежий платеж
          const recentPayment = userSubscriptions[0];
          res.json({
            id: recentPayment.paymentId,
            userId: recentPayment.userId,
            amount: { value: recentPayment.amount, currency: recentPayment.currency },
            status: 'succeeded',
            paid: true,
            activatedAt: recentPayment.activatedAt
          });
          return;
        }
      }
    } catch (fileError) {
      console.error('❌ Server: Error reading subscriptions file:', fileError);
    }

    // Если ничего не найдено, возвращаем null
    res.json(null);

  } catch (error) {
    console.error('❌ Server: Error getting recent payments:', error);
    res.status(500).json({
      error: 'Failed to get recent payments',
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

    // Модифицируем return_url, добавляя paymentId в hash часть URL
    // YooKassa не позволяет менять return_url после создания платежа,
    // поэтому используем hash для передачи данных
    const paymentUrl = payment.confirmation.confirmation_url;

    // Добавляем paymentId в hash часть returnUrl
    const hashSeparator = returnUrl.includes('#') ? '&' : '#';
    const modifiedReturnUrl = `${returnUrl}${hashSeparator}paymentId=${payment.id}&userId=${userId}`;

    console.log('💰 Server: Original returnUrl:', returnUrl);
    console.log('💰 Server: Modified returnUrl with hash:', modifiedReturnUrl);
    console.log('💰 Server: Payment object return_url:', payment.confirmation.return_url);

    console.log('💰 Server: Payment created successfully, sending response:', {
      success: true,
      paymentId: payment.id,
      paymentUrl: paymentUrl,
      returnUrl: modifiedReturnUrl,
      amount: payment.amount.value,
      currency: payment.amount.currency
    });

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

// ===== YOOKASSA WEBHOOK HANDLER =====

// Webhook для обработки уведомлений от YooKassa
app.post('/api/payments/webhook', async (req, res) => {
  try {
    // Парсим raw JSON body для webhook
    const webhookData = JSON.parse(req.body.toString());
    const paymentId = webhookData.object?.id;
    const status = webhookData.object?.status;
    const userId = webhookData.object?.metadata?.userId;

    console.log('🔗 [Webhook] Received YooKassa webhook:', {
      paymentId,
      status,
      userId,
      event: webhookData.event,
      timestamp: new Date().toISOString()
    });

    // Проверяем подпись для безопасности (обязательно для продакшена!)
    const signature = req.headers['x-yookassa-signature'];
    if (signature && YOOKASSA_CONFIG.secretKey) {
      const isValidSignature = verifySignature(req.body, signature, YOOKASSA_CONFIG.secretKey);
      if (!isValidSignature) {
        console.log('❌ [Webhook] Invalid signature received');
        logToFile('ERROR', 'Invalid webhook signature', { paymentId });
        return res.status(401).json({ error: 'Invalid signature' });
      }
      console.log('✅ [Webhook] Signature verified successfully');
    } else {
      console.log('⚠️ [Webhook] Signature verification skipped (no signature or secret key)');
    }

    if (!paymentId || !status) {
      logToFile('ERROR', 'Invalid webhook data', webhookData);
      return res.status(400).json({ error: 'Invalid webhook data' });
    }

    // Логируем событие платежа
    logToFile('INFO', 'Payment webhook received', {
      paymentId,
      status,
      userId,
      event: webhookData.event,
      paid: webhookData.object?.paid,
      amount: webhookData.object?.amount
    });

    // Обрабатываем успешный платеж
    if (status === 'succeeded' && userId) {
      console.log('✅ [Webhook] Payment succeeded for user:', userId);

      // Здесь можно активировать подписку для пользователя
      // Например, сохранить в базу данных информацию о подписке

      logToFile('INFO', 'Premium subscription activated', {
        userId,
        paymentId,
        activatedAt: new Date().toISOString()
      });

      // Можно отправить email уведомление пользователю
      try {
        // Импортируем email сервис для отправки уведомления
        const { CustomEmailService } = await import('./src/services/custom-email.js');
        await CustomEmailService.sendPaymentSuccessNotification(userId, paymentId);
        console.log('📧 [Webhook] Success notification sent to user:', userId);
      } catch (emailError) {
        console.error('📧 [Webhook] Failed to send notification:', emailError);
        // Не возвращаем ошибку, так как платеж уже обработан
      }
    } else if (status === 'canceled' || status === 'failed') {
      console.log('❌ [Webhook] Payment failed/canceled:', { paymentId, status, userId });
      logToFile('WARNING', 'Payment failed or canceled', {
        paymentId,
        status,
        userId
      });
    }

    // Возвращаем 200 OK для подтверждения получения webhook
    res.status(200).json({ received: true });

  } catch (error) {
    console.error('💥 [Webhook] Error processing webhook:', error);
    logToFile('ERROR', 'Webhook processing error', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    // Все равно возвращаем 200, чтобы YooKassa не повторяла отправку
    res.status(200).json({ received: true, error: error.message });
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

// Потоковая выдача токенов для чата с LLM
app.post('/api/chat', async (req, res) => {
  console.log('🔍 [API Chat] Received request:', {
    body: req.body,
    headers: req.headers,
    url: req.url
  });

  try {
    const { messages, model = 'gpt-4-turbo', stream = true } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const apiKey = process.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      console.error('❌ [Chat Streaming] API key not configured!');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Проверяем формат API ключа (должен начинаться с sk-)
    if (!apiKey.startsWith('sk-')) {
      console.error('❌ [Chat Streaming] Invalid API key format (should start with sk-)');
      return res.status(500).json({
        error: 'Invalid OpenAI API key format'
      });
    }

    console.log('✅ [Chat Streaming] API key configured (length:', apiKey.length + ')');

    // Use standard chat/completions endpoint with GPT-5.1 model
    const url = 'https://api.openai.com/v1/chat/completions';
    const requestBody = {
      model,
      messages,
      temperature: 0.8,
      max_completion_tokens: 4000,
      ...(stream && { stream: true })
    };

    if (stream) {
      // Парсим SSE и отдаем чистые токены (не SSE)
      console.log('🎯 [Chat Streaming] Starting stream parsing');

      const openaiResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(5 * 60 * 1000) // 5 минут таймаут
      });

      if (!openaiResponse.ok) {
        let errorText = '';
        try {
          errorText = await openaiResponse.text();
        } catch (e) {
          errorText = 'Unable to read error response';
        }

        console.error('❌ [Chat Streaming] OpenAI API Error:', {
          status: openaiResponse.status,
          statusText: openaiResponse.statusText,
          errorText: errorText,
          headers: Object.fromEntries(openaiResponse.headers.entries())
        });

        return res.status(openaiResponse.status).send(errorText || `OpenAI API Error: ${openaiResponse.status}`);
      }

      // Отдаем чистые токены (не SSE)
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // nginx - антибуферизация
      res.setHeader('Content-Encoding', 'identity');
      res.flushHeaders?.();

      const reader = openaiResponse.body?.getReader();
      if (!reader) {
        console.error('❌ [Chat Streaming] No reader available');
        return res.status(500).json({ error: 'Stream reader not available' });
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      const flushLines = () => {
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          let line = buffer.slice(0, idx);       // не трогаем переносы
          buffer = buffer.slice(idx + 1);

          // SSE-комментарии вида ": keep-alive"
          if (line.startsWith(':')) continue;

          if (!line.startsWith('data:')) continue;

          // Срезаем только префикс и ведущий пробел после него, контент не трогаем
          const payload = line.slice(5).trimStart();

          if (payload === '[DONE]') {
            console.log('✅ [Chat Streaming] Stream completed');
            res.end();
            return true;
          }

          try {
            const evt = JSON.parse(payload);
            const delta = evt?.choices?.[0]?.delta;
            if (delta?.content) {
              console.log('📤 [Server Streaming] Sending token:', JSON.stringify(delta.content));
              res.write(delta.content); // Отправляем только чистый текст
            }
            // Можно обработать function_call / tool_calls если нужно
          } catch (parseError) {
            // Игнорируем полусырые куски, ждем следующую порцию
            console.log('⚠️ [Chat Streaming] Ignoring partial chunk:', payload);
          }
        }
        return false;
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          if (flushLines()) return;
        }

        // Добиваем хвост
        flushLines();
        res.end();
      } catch (streamError) {
        console.error('❌ [Chat Streaming] Stream error:', streamError);
        res.end();
      }
    } else {
      // Обычный запрос без стриминга
      console.log('🔄 [Chat Regular] Making regular request');

      const openaiResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(5 * 60 * 1000)
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('❌ [Chat Regular] OpenAI API Error:', openaiResponse.status, errorText);
        return res.status(openaiResponse.status).send(errorText);
      }

      const data = await openaiResponse.json();
      res.json(data);
    }

  } catch (error) {
    console.error('❌ [Chat API] Error:', error);
    logToFile('ERROR', 'Chat API error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Internal server error',
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

// Инициализируем базу данных и запускаем сервер
async function startServer() {
  try {
    // Инициализируем SQLite базу данных
    await initializeDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      logToFile('INFO', `Pastel Chef AI API server started`, {
        port: PORT,
        databaseConnected: !!db,
        databasePath: dbPath,
        openaiConfigured: !!process.env.VITE_OPENAI_API_KEY,
        proxyConfigured: true,
        proxyHost: PROXY_HOST,
        proxyPort: PROXY_PORT,
        proxyUsername: PROXY_USERNAME,
        logsDirectory: logsDir,
        serverUrl: `http://localhost:${PORT}`
      });

      console.log(`🚀 Pastel Chef AI API server running on port ${PORT}`);
      console.log(`🗄️ SQLite database: ${dbPath}`);
      console.log(`🔑 OpenAI API key configured: ${process.env.VITE_OPENAI_API_KEY ? 'Yes' : 'No'}`);
      console.log(`🌐 Proxy configured: ${PROXY_HOST}:${PROXY_PORT} (${PROXY_USERNAME})`);
      console.log(`📁 Logs directory: ${logsDir}`);
      console.log(`🌐 Server URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ [Server] Failed to start server:', error);
    process.exit(1);
  }
}

// Запускаем сервер
startServer();
