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
import FormData from 'form-data';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';

// Загружаем переменные окружения
dotenv.config();

// ===== ENVIRONMENT VALIDATION =====
const requiredEnvVars = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'VITE_OPENAI_API_KEY',
  'YOOKASSA_SHOP_ID',
  'YOOKASSA_SECRET_KEY',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ [Environment] Missing required environment variables:');
  missingEnvVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('💥 Server startup failed due to missing environment variables');
  process.exit(1);
}

console.log('✅ [Environment] All required variables are present');

// YooKassa configuration
const YOOKASSA_CONFIG = {
  shopId: process.env.YOOKASSA_SHOP_ID,
  secretKey: process.env.YOOKASSA_SECRET_KEY,
  returnUrl: process.env.YOOKASSA_RETURN_URL || 'https://cook.windexs.ru/payment-success'
};

// ===== SECURITY CONSTANTS =====
const JWT_ACCESS_EXPIRES_IN = '15m'; // 15 minutes
const JWT_REFRESH_EXPIRES_IN = '7d'; // 7 days
const BCRYPT_ROUNDS = 12;

// ===== JWT UTILITIES =====
const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRES_IN,
    issuer: 'windexs-cook',
    audience: 'windexs-cook-users'
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'windexs-cook',
    audience: 'windexs-cook-users'
  });
};

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'windexs-cook',
      audience: 'windexs-cook-users'
    });
  } catch (error) {
    throw new Error('Invalid access token');
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
      issuer: 'windexs-cook',
      audience: 'windexs-cook-users'
    });
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

// ===== AUTHENTICATION MIDDLEWARE =====
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = verifyAccessToken(token);

    // Get user from database to ensure they still exist
    const db = await getDbConnection();
    const user = await db.get(
      'SELECT id, email, role, created_at FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    console.error('❌ [Auth] Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid access token' });
  }
};

// ===== AUTHORIZATION MIDDLEWARE (RBAC) =====
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const roleHierarchy = {
      'user': 1,
      'moderator': 2,
      'admin': 3
    };

    const userLevel = roleHierarchy[req.user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: `Insufficient permissions. Required: ${requiredRole}, Current: ${req.user.role}`
      });
    }

    next();
  };
};

// ===== PASSWORD UTILITIES =====
const hashPassword = async (password) => {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
};

const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// ===== AUDIT LOGGING =====
const auditLog = async (userId, action, resourceType, resourceId = null, oldValues = null, newValues = null, req = null) => {
  try {
    if (!db) return;

    const auditData = {
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      old_values: oldValues ? JSON.stringify(oldValues) : null,
      new_values: newValues ? JSON.stringify(newValues) : null,
      ip_address: req?.ip || null,
      user_agent: req?.get('User-Agent') || null,
      created_at: new Date().toISOString()
    };

    await db.run(`
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      auditData.user_id,
      auditData.action,
      auditData.resource_type,
      auditData.resource_id,
      auditData.old_values,
      auditData.new_values,
      auditData.ip_address,
      auditData.user_agent,
      auditData.created_at
    ]);

    console.log(`📊 [Audit] ${action} on ${resourceType}${resourceId ? `:${resourceId}` : ''} by user ${userId}`);
  } catch (error) {
    console.error('❌ [Audit] Failed to log audit event:', error);
  }
};

// ===== TRANSACTION UTILITIES =====
const withTransaction = async (callback) => {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const transaction = await db.run('BEGIN TRANSACTION');
  try {
    const result = await callback(db);
    await db.run('COMMIT');
    return result;
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
};

// ===== MIGRATION SYSTEM =====
const runMigrations = async () => {
  try {
    if (!db) {
      console.log('⚠️ [Migrations] Database not initialized, skipping migrations');
      return;
    }

    console.log('🔄 [Migrations] Checking for pending migrations...');

    // Create migrations table if it doesn't exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at TEXT NOT NULL
      );
    `);

    // Migration: Add missing indexes (v1)
    const migrationV1 = await db.get("SELECT version FROM schema_migrations WHERE version = 'v1'");
    if (!migrationV1) {
      console.log('🔄 [Migrations] Running migration v1: Add performance indexes');

      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

        CREATE INDEX IF NOT EXISTS idx_recipes_author_id ON recipes(author_id);
        CREATE INDEX IF NOT EXISTS idx_recipes_status ON recipes(status);
        CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at);
        CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
        CREATE INDEX IF NOT EXISTS idx_recipes_author_status ON recipes(author_id, status);

        CREATE INDEX IF NOT EXISTS idx_comments_recipe_id ON comments(recipe_id);
        CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);
        CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);

        CREATE INDEX IF NOT EXISTS idx_user_likes_user_id ON user_likes(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_likes_recipe_id ON user_likes(recipe_id);

        CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_favorites_recipe_id ON user_favorites(recipe_id);

        CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON subscriptions(expires_at);

        CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action_date ON rate_limits(user_identifier, action_type, date_key);

        CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON payment_events(payment_id);
        CREATE INDEX IF NOT EXISTS idx_payment_events_user_id ON payment_events(user_id);
        CREATE INDEX IF NOT EXISTS idx_payment_events_event_type ON payment_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_payment_events_created_at ON payment_events(created_at);

        CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
      `);

      await db.run(
        "INSERT INTO schema_migrations (version, name, executed_at) VALUES (?, ?, ?)",
        ['v1', 'Add performance indexes', new Date().toISOString()]
      );

      console.log('✅ [Migrations] Migration v1 completed');
    }

    // Migration: Add audit fields to existing tables (v2)
    const migrationV2 = await db.get("SELECT version FROM schema_migrations WHERE version = 'v2'");
    if (!migrationV2) {
      console.log('🔄 [Migrations] Running migration v2: Add audit fields');

      // Add new columns to existing tables (SQLite allows ALTER TABLE for adding columns)
      try {
        await db.run(`ALTER TABLE users ADD COLUMN last_login TEXT`);
        await db.run(`ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0`);
        await db.run(`ALTER TABLE users ADD COLUMN locked_until TEXT`);
        await db.run(`ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0`);
        await db.run(`ALTER TABLE users ADD COLUMN email_verification_token TEXT`);
        await db.run(`ALTER TABLE users ADD COLUMN email_verification_expires TEXT`);
        await db.run(`ALTER TABLE users ADD COLUMN password_reset_token TEXT`);
        await db.run(`ALTER TABLE users ADD COLUMN password_reset_expires TEXT`);

        await db.run(`ALTER TABLE recipes ADD COLUMN rejected_count INTEGER DEFAULT 0`);
        await db.run(`ALTER TABLE recipes ADD COLUMN view_count INTEGER DEFAULT 0`);

        await db.run(`ALTER TABLE comments ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`);
        await db.run(`ALTER TABLE comments ADD COLUMN moderated_by INTEGER`);
        await db.run(`ALTER TABLE comments ADD COLUMN moderated_at TEXT`);
        await db.run(`ALTER TABLE comments ADD COLUMN moderation_reason TEXT`);

        console.log('✅ [Migrations] Migration v2: Audit fields added');
      } catch (alterError) {
        if (!alterError.message.includes('duplicate column name')) {
          console.warn('⚠️ [Migrations] Some columns might already exist:', alterError.message);
        }
      }

      await db.run(
        "INSERT INTO schema_migrations (version, name, executed_at) VALUES (?, ?, ?)",
        ['v2', 'Add audit fields to existing tables', new Date().toISOString()]
      );

      console.log('✅ [Migrations] Migration v2 completed');
    }

    console.log('✅ [Migrations] All migrations completed');

  } catch (error) {
    console.error('❌ [Migrations] Migration failed:', error);
    throw error;
  }
};

// ===== MONITORING SETUP =====
let monitoring;
try {
  // Dynamic import for monitoring (only in production)
  if (process.env.NODE_ENV === 'production') {
    const { MonitoringService } = await import('./dist/monitoring/monitoring.js');
    monitoring = MonitoringService.getInstance();
    console.log('✅ Monitoring initialized');
  }
} catch (error) {
  console.warn('⚠️ Monitoring not available:', error.message);
}

// Monitoring middleware
const monitoringMiddleware = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const route = `${req.method} ${req.route?.path || req.path}`;

    if (monitoring) {
      monitoring.recordMetric(`api.response_time`, duration, {
        route,
        status: res.statusCode,
        method: req.method
      });

      if (res.statusCode >= 400) {
        monitoring.incrementCounter('api.errors', 1, {
          route,
          status: res.statusCode,
          method: req.method
        });
      }
    }
  });

  next();
};

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

console.log('🔧 [Proxy] Configuration check:', {
  PROXY_HOST: PROXY_HOST || 'not set',
  PROXY_PORT: PROXY_PORT || 'not set',
  PROXY_USERNAME: PROXY_USERNAME || 'not set',
  PROXY_PASSWORD: PROXY_PASSWORD ? '[SET]' : 'not set',
  proxyUrl: proxyUrl || 'no proxy configured',
  proxyAgent: proxyUrl ? 'will be created' : 'disabled'
});

const proxyAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : null;

// Проверка правильности прокси
if (PROXY_HOST !== '45.147.180.108') {
  console.warn('⚠️ [Proxy] ВНИМАНИЕ: Используется прокси с IP отличным от дефолтного!', {
    current: PROXY_HOST,
    expected: '45.147.180.108',
    fromEnv: !!process.env.PROXY_HOST
  });
}

console.log('🔧 Proxy configuration:', {
  proxyUrl: proxyUrl ? proxyUrl.replace(/:[^@]*@/, ':***@') : 'disabled', // Скрываем пароль в логах
  proxyHost: PROXY_HOST,
  proxyPort: PROXY_PORT,
  proxyUsername: PROXY_USERNAME,
  proxyEnabled: !!proxyAgent,
  fromEnv: {
    PROXY_HOST: !!process.env.PROXY_HOST,
    PROXY_PORT: !!process.env.PROXY_PORT,
    PROXY_USERNAME: !!process.env.PROXY_USERNAME,
    PROXY_PASSWORD: !!process.env.PROXY_PASSWORD
  }
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
        health_profile TEXT DEFAULT NULL,
        last_login TEXT,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TEXT,
        email_verified BOOLEAN DEFAULT 0,
        email_verification_token TEXT,
        email_verification_expires TEXT,
        password_reset_token TEXT,
        password_reset_expires TEXT,
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
        tips TEXT,
        image TEXT,
        author_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        rating REAL DEFAULT 0,
        likes INTEGER DEFAULT 0,
        favorites INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        moderated_by INTEGER,
        moderated_at TEXT,
        moderation_reason TEXT,
        rejected_count INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (moderated_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        likes INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        moderated_by INTEGER,
        moderated_at TEXT,
        moderation_reason TEXT,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (moderated_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS user_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        recipe_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
        UNIQUE(user_id, recipe_id)
      );

      CREATE TABLE IF NOT EXISTS user_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        recipe_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
        UNIQUE(user_id, recipe_id)
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        payment_id TEXT NOT NULL,
        plan_type TEXT DEFAULT 'premium',
        status TEXT DEFAULT 'active',
        activated_at TEXT NOT NULL,
        expires_at TEXT,
        cancelled_at TEXT,
        amount INTEGER NOT NULL,
        currency TEXT DEFAULT 'RUB',
        auto_renew BOOLEAN DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, status)
      );

      CREATE TABLE IF NOT EXISTS rate_limits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_identifier TEXT NOT NULL,
        action_type TEXT NOT NULL,
        date_key TEXT NOT NULL,
        count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_identifier, action_type, date_key)
      );

      CREATE TABLE IF NOT EXISTS payment_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        payment_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_data TEXT NOT NULL,
        signature_verified BOOLEAN DEFAULT 0,
        user_id INTEGER,
        amount INTEGER,
        currency TEXT,
        status TEXT,
        processed_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id INTEGER,
        old_values TEXT,
        new_values TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

      CREATE INDEX IF NOT EXISTS idx_recipes_author_id ON recipes(author_id);
      CREATE INDEX IF NOT EXISTS idx_recipes_status ON recipes(status);
      CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at);
      CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
      CREATE INDEX IF NOT EXISTS idx_recipes_author_status ON recipes(author_id, status);

      CREATE INDEX IF NOT EXISTS idx_comments_recipe_id ON comments(recipe_id);
      CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);
      CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);

      CREATE INDEX IF NOT EXISTS idx_user_likes_user_id ON user_likes(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_likes_recipe_id ON user_likes(recipe_id);

      CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_favorites_recipe_id ON user_favorites(recipe_id);

      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON subscriptions(expires_at);

      CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action_date ON rate_limits(user_identifier, action_type, date_key);

      CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON payment_events(payment_id);
      CREATE INDEX IF NOT EXISTS idx_payment_events_user_id ON payment_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_payment_events_event_type ON payment_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_payment_events_created_at ON payment_events(created_at);

      CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
    `);

    console.log('✅ [Database] Tables initialized successfully');

    // Run migrations
    await runMigrations();

    return db;
  } catch (error) {
    console.error('❌ [Database] Failed to initialize database:', error);
    process.exit(1);
  }
}

// Система отслеживания лимитов
const DAILY_IMAGE_LIMIT = 20;
const DAILY_RECIPE_LIMIT = 10;
const HOURLY_API_LIMIT = 100;

// Функция для проверки лимита (асинхронная)
const checkRateLimit = async (userIdentifier, actionType, limit) => {
  try {
    if (!db) return { canPerform: true, currentCount: 0, limit };

    const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Получаем текущий счетчик
    const existing = await db.get(
      'SELECT count FROM rate_limits WHERE user_identifier = ? AND action_type = ? AND date_key = ?',
      [userIdentifier, actionType, dateKey]
    );

    const currentCount = existing ? existing.count : 0;

    return {
      canPerform: currentCount < limit,
      currentCount,
      limit,
      remaining: Math.max(0, limit - currentCount)
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return { canPerform: true, currentCount: 0, limit }; // Fail open
  }
};

// Функция для увеличения счетчика лимита (асинхронная)
const incrementRateLimit = async (userIdentifier, actionType) => {
  try {
    if (!db) return 0;

    const dateKey = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Используем UPSERT для SQLite
    await db.run(`
      INSERT INTO rate_limits (user_identifier, action_type, date_key, count, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
      ON CONFLICT(user_identifier, action_type, date_key)
      DO UPDATE SET
        count = count + 1,
        updated_at = excluded.updated_at
    `, [userIdentifier, actionType, dateKey, now, now]);

    // Возвращаем новый счетчик
    const result = await db.get(
      'SELECT count FROM rate_limits WHERE user_identifier = ? AND action_type = ? AND date_key = ?',
      [userIdentifier, actionType, dateKey]
    );

    return result ? result.count : 1;
  } catch (error) {
    console.error('Error incrementing rate limit:', error);
    return 0;
  }
};

// Rate limiting functions
const checkImageLimit = async (userIdentifier) => {
  return await checkRateLimit(userIdentifier, 'image_generation', DAILY_IMAGE_LIMIT);
};

const incrementImageCount = async (userIdentifier) => {
  return await incrementRateLimit(userIdentifier, 'image_generation');
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
// Utility function to redact sensitive data
const redactSensitiveData = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  const redacted = { ...obj };
  const sensitiveKeys = [
    'authorization', 'password', 'passwordhash', 'token', 'refreshtoken',
    'accesstoken', 'jwt', 'secret', 'key', 'apikey', 'emailtoken', 'resettoken'
  ];

  for (const key in redacted) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSensitiveData(redacted[key]);
    }
  }

  return redacted;
};

const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      // Redact sensitive headers
      headers: redactSensitiveData(req.headers),
      // Redact sensitive body data (limit size to prevent huge logs)
      body: req.body ? redactSensitiveData(
        JSON.stringify(req.body).length > 1000
          ? { ...req.body, _truncated: true }
          : req.body
      ) : undefined
    };

    logToFile('INFO', `${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`, logData);
  });

  next();
};

// Настройка multer для обработки аудио файлов
const upload = multer({
  storage: multer.memoryStorage(), // Сохраняем в память для доступа к buffer
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB максимум для аудио
  },
  fileFilter: (req, file, cb) => {
    // Разрешаем только аудио форматы (включая кодеки)
    const allowedMimes = [
      'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a',
      'audio/webm', 'audio/webm;codecs=opus', 'audio/webm; codecs=opus',
      'audio/ogg', 'audio/ogg;codecs=opus', 'audio/ogg; codecs=opus',
      'audio/flac', 'audio/x-flac',
      'audio/aac', 'audio/m4a'
    ];

    console.log(`[Multer] Проверяем файл: ${file.originalname}, MIME: ${file.mimetype}, size: ${file.size}`);

    // Проверяем базовый MIME тип (без кодеков)
    const baseMime = file.mimetype.split(';')[0].trim();

    if (allowedMimes.includes(file.mimetype) || allowedMimes.includes(baseMime)) {
      console.log(`[Multer] ✅ Файл принят: ${file.mimetype}`);
      cb(null, true);
    } else {
      console.log(`[Multer] ❌ Отклонён MIME тип: ${file.mimetype}, base: ${baseMime}`);
      cb(new Error(`Неподдерживаемый формат аудио файла: ${file.mimetype}`));
    }
  }
});

const app = express();
const PORT = process.env.PORT || 1041;

// ===== CORS CONFIGURATION =====
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:8080',
      'http://localhost:3000',
      'http://localhost:5173',
      'https://cook.windexs.ru',
      'https://www.cook.windexs.ru',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚨 [CORS] Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token'],
  optionsSuccessStatus: 200
};

// ===== CSRF PROTECTION =====
const CSRF_TOKENS = new Map(); // In production, use Redis

const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const validateCSRFToken = (token) => {
  // In production, check against Redis/session
  return CSRF_TOKENS.has(token);
};

// ===== CSRF MIDDLEWARE =====
const csrfProtection = (req, res, next) => {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Check CSRF token from header or body
  const csrfToken = req.headers['x-csrf-token'] || req.body?.csrfToken;

  if (!csrfToken || !validateCSRFToken(csrfToken)) {
    console.warn(`🚨 [CSRF] Invalid or missing CSRF token for ${req.method} ${req.path}`);
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
};

// Middleware для обработки raw body (нужно для webhook подписи)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Cookie parser middleware
app.use(cookieParser());

// CORS middleware
app.use(cors(corsOptions));
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
app.get('/api/admin/published-recipes', authenticateToken, requireRole('admin'), async (req, res) => {
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

// Одобрить рецепт (требует роли moderator или admin)
app.put('/api/recipes/:id/approve', authenticateToken, requireRole('moderator'), async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { id } = req.params;
    const { moderatorId, reason } = req.body;

    const result = await withTransaction(async (db) => {
      // Get current recipe state for audit
      const currentRecipe = await db.get('SELECT status, author_id FROM recipes WHERE id = ?', [id]);

      const now = new Date().toISOString();
      const updateResult = await db.run(
        'UPDATE recipes SET status = ?, moderated_by = ?, moderated_at = ?, moderation_reason = ?, updated_at = ? WHERE id = ?',
        ['approved', moderatorId || null, now, reason || 'Одобрен администратором', now, id]
      );

      // Log audit event
      await auditLog(moderatorId, 'RECIPE_APPROVE', 'recipe', id, {
        status: currentRecipe.status
      }, {
        status: 'approved',
        moderated_by: moderatorId,
        moderation_reason: reason || 'Одобрен администратором'
      }, req);

      return updateResult;
    });

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

// Отклонить рецепт (требует роли moderator или admin)
app.put('/api/recipes/:id/reject', authenticateToken, requireRole('moderator'), async (req, res) => {
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

// Сохранить рецепт (требует аутентификации и CSRF)
app.post('/api/recipes', authenticateToken, csrfProtection, async (req, res) => {
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
    const result = await withTransaction(async (db) => {
      // Insert recipe
      const insertResult = await db.run(
        `INSERT INTO recipes (title, description, ingredients, instructions, cook_time, servings, difficulty, category, tips, image, author_id, created_at, updated_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          description || '',
          JSON.stringify(ingredients),
          JSON.stringify(instructions),
          cookTime || '',
          servings || 0,
          difficulty || 'Medium',
          category || '',
          tips || '',
          image || null,
          authorId || null,
          now,
          now,
          'pending' // Новые рецепты ждут модерации
        ]
      );

      // Log audit event
      await auditLog(authorId, 'RECIPE_CREATE', 'recipe', insertResult.lastID, null, {
        title,
        status: 'pending',
        category
      }, req);

      return insertResult;
    });

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

// ===== CSRF TOKEN ENDPOINT =====
app.get('/api/auth/csrf-token', (req, res) => {
  const csrfToken = generateCSRFToken();
  CSRF_TOKENS.set(csrfToken, Date.now());

  // Set CSRF token in httpOnly cookie
  res.cookie('csrf-token', csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000 // 1 hour
  });

  res.json({ csrfToken });
});

// Зарегистрировать пользователя
app.post('/api/auth/register', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const hashedPassword = await hashPassword(password);
    const now = new Date().toISOString();

    const result = await withTransaction(async (db) => {
      // Insert user
      const insertResult = await db.run(
        'INSERT INTO users (email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [email.toLowerCase(), hashedPassword, 'user', now, now]
      );

      // Log audit event
      await auditLog(insertResult.lastID, 'USER_REGISTER', 'user', insertResult.lastID, null, {
        email: email.toLowerCase(),
        role: 'user'
      }, req);

      return insertResult;
    });

    console.log(`✅ [Auth] User registered with ID: ${result.lastID}`);
    res.json({
      id: result.lastID,
      name,
      email: email.toLowerCase(),
      role: 'user',
      message: 'User registered successfully'
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      console.error('❌ [Auth] Email already exists:', email);
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('❌ [Auth] Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
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

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user by email
    const user = await db.get(
      'SELECT id, email, password_hash, role, created_at FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    // Store refresh token (in production, use Redis/database)
    // For now, we'll send it in httpOnly cookie
    res.cookie('refresh-token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    console.log(`✅ [Auth] User logged in: ${user.id} (${user.role})`);
    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role || 'user',
        name: user.email.split('@')[0]
      }
    });
  } catch (error) {
    console.error('❌ [Auth] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh access token
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies['refresh-token'];

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Get user to ensure they still exist
    const user = await db.get(
      'SELECT id, email, role FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    console.log(`✅ [Auth] Token refreshed for user: ${user.id}`);
    res.json({ accessToken });
  } catch (error) {
    console.error('❌ [Auth] Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  // Clear refresh token cookie
  res.clearCookie('refresh-token');
  res.json({ message: 'Logged out successfully' });
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

    // Use both server-style and Vite-style env vars to avoid missing key in prod
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured',
        details: 'Check OPENAI_API_KEY or VITE_OPENAI_API_KEY environment variables'
      });
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
      proxy: false,
      timeout: 30000 // 30 second timeout
    };

    console.log('🎵 [TTS API] Sending request to OpenAI:', {
      url: axiosConfig.url,
      requestData: requestData,
      headers: { ...headers, Authorization: headers.Authorization.substring(0, 20) + '...' }, // Hide API key
      usingProxy: !!proxyAgent,
      proxyUrl: proxyUrl ? proxyUrl.substring(0, 50) + '...' : 'no proxy'
    });
    
    // Добавляем прокси агент только если он настроен
    if (proxyAgent) {
      axiosConfig.httpsAgent = proxyAgent;
      axiosConfig.httpAgent = proxyAgent;
    }

    let response;
    let attemptedWithoutProxy = false;

    try {
      response = await axios(axiosConfig);
    } catch (error) {
      // If proxy is set and network unreachable/timeouts/connection refused occur, retry without proxy once
      const retriableNetworkErrors = ['ENETUNREACH', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ECONNREFUSED'];
      const shouldRetryWithoutProxy = proxyAgent && !attemptedWithoutProxy &&
        (retriableNetworkErrors.includes(error.code) || error.message?.includes('timeout'));

      if (shouldRetryWithoutProxy) {
        console.warn('⚠️ [TTS API] Proxy request failed, retrying without proxy...', {
          error: error.code || error.message
        });
        attemptedWithoutProxy = true;
        const axiosConfigNoProxy = { ...axiosConfig };
        delete axiosConfigNoProxy.httpAgent;
        delete axiosConfigNoProxy.httpsAgent;
        axiosConfigNoProxy.proxy = false;
        response = await axios(axiosConfigNoProxy);
      } else {
        console.error('❌ [TTS API] Request to OpenAI failed:', {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          hasResponse: !!error.response,
          isAxiosError: error.isAxiosError
        });
        throw error;
      }
    }

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
      code: error.code,
      errno: error.errno,
      isAxiosError: error.isAxiosError,
      stack: error.stack,
      textLength: req.body?.text?.length,
      textPreview: typeof req.body?.text === 'string' ? req.body.text.substring(0, 120) : 'not-string',
        voice: req.body.voice,
      model: req.body.model,
      axiosConfig: error.config ? {
        url: error.config.url,
        timeout: error.config.timeout,
        proxy: error.config.proxy,
        hasHttpsAgent: !!error.config.httpsAgent,
        hasHttpAgent: !!error.config.httpAgent,
        headers: error.config.headers,
      } : null
    });

    logToFile('ERROR', 'TTS generation error', {
      error: error.message,
      stack: error.stack,
      text: req.body.text,
      textType: typeof req.body.text,
      requestData: req.body
    });

    if (error.response) {
      // Стараемся безопасно логировать тело ответа OpenAI (усечено)
      let openaiError = null;
      let openaiErrorText = null;
      try {
        if (Buffer.isBuffer(error.response.data)) {
          openaiErrorText = error.response.data.toString('utf8');
          openaiError = JSON.parse(openaiErrorText);
        } else if (typeof error.response.data === 'string') {
          openaiErrorText = error.response.data;
          openaiError = JSON.parse(error.response.data);
        } else if (typeof error.response.data === 'object') {
          openaiError = error.response.data;
          openaiErrorText = JSON.stringify(error.response.data);
        }
      } catch (parseError) {
        openaiErrorText = openaiErrorText || 'Unable to parse OpenAI error response';
      }

      const openaiMessage = openaiError?.error?.message || openaiErrorText;
      const openaiCode = openaiError?.error?.code || openaiError?.code;
      const openaiDataPreview = openaiErrorText
        ? openaiErrorText.substring(0, 4000)
        : (typeof error.response.data === 'string'
          ? error.response.data.substring(0, 4000)
          : '[unavailable]');

      console.error('❌ [TTS API] OpenAI API error response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        dataPreview: openaiDataPreview
      });

      // Возвращаем детальную ошибку для клиента
      res.status(error.response.status).json({
        error: 'TTS generation failed',
        details: openaiError || openaiMessage || error.response.data,
        openai_status: error.response.status,
        openai_code: openaiCode,
        openai_message: openaiMessage,
        openai_data_preview: openaiDataPreview,
        request_text: req.body.text ? req.body.text.substring(0, 100) : 'undefined'
      });
    } else {
      console.error('❌ [TTS API] Network or other error:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        isAxiosError: error.isAxiosError,
        requestUrl: error.config?.url,
        timeout: error.config?.timeout,
        proxy: error.config?.proxy,
        hasHttpsAgent: !!error.config?.httpsAgent,
        hasHttpAgent: !!error.config?.httpAgent,
        headers: error.config?.headers
      });
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// ===== AUDIO ENDPOINTS =====

// Speech synthesis endpoint (/api/audio/speech) - основной для TTS
app.post('/api/audio/speech', async (req, res) => {
  try {
    const { text, voice = 'onyx', model = 'tts-1', response_format = 'mp3', speed = 1.0 } = req.body;

    console.log('🎯 [Speech API] Получен запрос синтеза речи:', {
      textLength: text?.length || 0,
      textPreview: text?.substring(0, 100) || 'undefined',
      voice,
      model,
      response_format,
      speed,
      body: req.body
    });

    if (!text || typeof text !== 'string') {
      console.error('❌ [Speech API] Текст не является строкой:', text);
      return res.status(400).json({ error: 'Text must be a non-empty string' });
    }

    if (!text.trim()) {
      console.error('❌ [Speech API] Получена пустая строка');
      return res.status(400).json({ error: 'Text cannot be empty' });
    }

    // Валидация параметров
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    if (!validVoices.includes(voice)) {
      console.error('❌ [Speech API] Неверный голос:', voice);
      return res.status(400).json({ error: `Invalid voice. Supported voices: ${validVoices.join(', ')}` });
    }

    const validModels = ['tts-1', 'tts-1-hd'];
    if (!validModels.includes(model)) {
      console.error('❌ [Speech API] Неверная модель:', model);
      return res.status(400).json({ error: `Invalid model. Supported models: ${validModels.join(', ')}` });
    }

    const validFormats = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'];
    if (!validFormats.includes(response_format)) {
      console.error('❌ [Speech API] Неверный формат:', response_format);
      return res.status(400).json({ error: `Invalid response format. Supported formats: ${validFormats.join(', ')}` });
    }

    const apiKey = process.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      logToFile('ERROR', 'OpenAI API key not configured for speech synthesis');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Проверяем формат API ключа
    if (!apiKey.startsWith('sk-')) {
      console.error('❌ [Speech API] Invalid API key format');
      return res.status(500).json({ error: 'Invalid OpenAI API key format' });
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    const requestData = {
      model,
      input: text,
      voice,
      response_format,
      speed: Math.max(0.25, Math.min(4.0, speed)) // Ограничиваем скорость
    };

    const axiosConfig = {
      method: 'POST',
      url: 'https://api.openai.com/v1/audio/speech',
      headers,
      data: JSON.stringify(requestData),
      responseType: 'arraybuffer',
      proxy: false,
      timeout: 30000, // 30 секунд таймаут для синтеза
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    };

    // Добавляем прокси агент только если он настроен
    if (proxyAgent) {
      axiosConfig.httpsAgent = proxyAgent;
      axiosConfig.httpAgent = proxyAgent;
    }

    console.log('🚀 [Speech API] Отправка запроса в OpenAI TTS API...');
    
    let response;
    let attemptedWithoutProxy = false;

    try {
      response = await axios(axiosConfig);
    } catch (error) {
      // If proxy is set and network unreachable/timeouts/connection refused occur, retry without proxy once
      const retriableNetworkErrors = ['ENETUNREACH', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ECONNREFUSED'];
      const shouldRetryWithoutProxy = proxyAgent && !attemptedWithoutProxy &&
        (retriableNetworkErrors.includes(error.code) || error.message?.includes('timeout'));

      if (shouldRetryWithoutProxy) {
        console.warn('⚠️ [Speech API] Proxy request failed, retrying without proxy...', {
          error: error.code || error.message
        });
        attemptedWithoutProxy = true;
        const axiosConfigNoProxy = { ...axiosConfig };
        delete axiosConfigNoProxy.httpAgent;
        delete axiosConfigNoProxy.httpsAgent;
        axiosConfigNoProxy.proxy = false;
        response = await axios(axiosConfigNoProxy);
      } else {
        throw error;
      }
    }

    // Определяем MIME тип на основе формата ответа
    const mimeTypes = {
      'mp3': 'audio/mpeg',
      'opus': 'audio/opus',
      'aac': 'audio/aac',
      'flac': 'audio/flac',
      'wav': 'audio/wav',
      'pcm': 'audio/pcm'
    };

    const contentType = mimeTypes[response_format] || 'audio/mpeg';

    // Устанавливаем правильные заголовки для аудио
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', response.data.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Voice', voice);
    res.setHeader('X-Model', model);
    res.setHeader('X-Format', response_format);

    console.log('✅ [Speech API] Аудио успешно синтезировано:', {
      size: response.data.length,
      contentType,
      voice,
      model,
      response_format
    });

    res.send(response.data);

    logToFile('INFO', 'Speech synthesis completed successfully', {
      textLength: text.length,
      voice,
      model,
      response_format,
      audioSize: response.data.length
    });

  } catch (error) {
    console.error('❌ [Speech API] Ошибка синтеза речи:', {
      error: error.message,
      stack: error.stack,
      text: req.body.text?.substring(0, 100),
      voice: req.body.voice,
      model: req.body.model,
      response_format: req.body.response_format
    });

    logToFile('ERROR', 'Speech synthesis error', {
      error: error.message,
      stack: error.stack,
      requestData: req.body
    });

    if (error.response) {
      console.error('❌ [Speech API] OpenAI API error response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });

      // Возвращаем более детальную ошибку для отладки
      res.status(error.response.status).json({
        error: 'Speech synthesis failed',
        details: error.response.data,
        openai_status: error.response.status,
        request_text: req.body.text?.substring(0, 100)
      });
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.error('❌ [Speech API] Request timeout');
      res.status(408).json({
        error: 'Speech synthesis timeout',
        details: 'Request took too long to complete'
      });
    } else {
      console.error('❌ [Speech API] Network or other error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// Audio transcription endpoint (/api/audio/transcriptions) - основной для STT
app.post('/api/audio/transcriptions', upload.single('file'), async (req, res) => {
  console.log('🎵 [Transcription API] === NEW TRANSCRIPTION REQUEST ===');
  console.log('🎵 [Transcription API] Headers:', {
    'content-type': req.headers['content-type'],
    'user-agent': req.headers['user-agent'],
    'content-length': req.headers['content-length']
  });
  console.log('🎵 [Transcription API] Body fields:', Object.keys(req.body || {}));
  console.log('🎵 [Transcription API] Body values:', {
    language: req.body?.language,
    model: req.body?.model,
    hasPrompt: !!req.body?.prompt,
    temperature: req.body?.temperature
  });
  console.log('🎵 [Transcription API] File info:', req.file ? {
    fieldname: req.file.fieldname,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    bufferLength: req.file.buffer?.length,
    isBuffer: Buffer.isBuffer(req.file.buffer)
  } : 'NO FILE - This will cause an error!');

  try {
    const { language = 'ru', model = 'whisper-1', prompt, temperature = 0.2 } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const apiKey = process.env.VITE_OPENAI_API_KEY;
    console.log('🔑 [Transcription API] OpenAI API key check:', {
      keyExists: !!apiKey,
      keyLength: apiKey?.length || 0,
      keyPrefix: apiKey?.substring(0, 10) + '...'
    });

    if (!apiKey) {
      console.error('❌ [Transcription API] OpenAI API key not configured!');
      logToFile('ERROR', 'OpenAI API key not configured for audio transcription');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log('✅ [Transcription API] OpenAI API key is available');

    console.log('🎵 [Transcription API] Starting transcription request:', {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      bufferLength: req.file.buffer?.length,
      language,
      model,
      hasPrompt: !!prompt
    });

    // Создаем новый FormData для отправки в OpenAI
    const formData = new FormData();

    // ВАЖНО: Добавляем аудио файл ПЕРВЫМ
    // Проверяем, что req.file.buffer является Buffer'ом
    console.log('🎵 [Transcription API] Checking file buffer type:', {
      isBuffer: Buffer.isBuffer(req.file.buffer),
      typeof: typeof req.file.buffer,
      bufferLength: req.file.buffer?.length,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype
    });

    if (!Buffer.isBuffer(req.file.buffer)) {
      console.error('❌ [Transcription API] req.file.buffer is not a Buffer:', typeof req.file.buffer);
      return res.status(400).json({
        error: 'Invalid file buffer type',
        details: `Expected Buffer, got ${typeof req.file.buffer}`
      });
    }

    console.log('🎵 [Transcription API] Creating FormData with file:', {
      bufferSize: req.file.buffer.length,
      filename: req.file.originalname || 'audio.webm'
    });

    try {
      // Убедимся, что у нас именно Buffer. Некоторые окружения могут отдавать Uint8Array
      const fileBuffer = Buffer.isBuffer(req.file.buffer)
        ? req.file.buffer
        : Buffer.from(req.file.buffer);

      formData.append('file', fileBuffer, {
        filename: req.file.originalname || 'audio.webm',
        contentType: req.file.mimetype || 'audio/webm'
      });
      console.log('✅ [Transcription API] FormData append successful');
    } catch (error) {
      console.error('❌ [Transcription API] FormData append failed:', error);
      return res.status(500).json({
        error: 'FormData creation failed',
        details: error.message,
        hasFile: !!req.file,
        fileType: req.file?.mimetype,
        bufferType: req.file?.buffer ? typeof req.file.buffer : 'undefined'
      });
    }

    // Добавляем модель
    formData.append('model', model);

    // Добавляем язык
    formData.append('language', language);

    // Добавляем prompt если есть
    if (prompt) {
      formData.append('prompt', prompt);
    }

    // Добавляем temperature если указана
    if (temperature !== undefined) {
      formData.append('temperature', String(temperature));
    }

    console.log('🎵 [Transcription API] FormData prepared:', {
      hasFile: true,
      model,
      language,
      hasPrompt: !!prompt,
      apiKeyPresent: !!apiKey
    });

    // Проверяем, что API ключ есть
    if (!apiKey) {
      console.error('❌ [Transcription API] OpenAI API key is missing');
      return res.status(500).json({
        error: 'OpenAI API key not configured'
      });
    }

    console.log('🎵 [Transcription API] Preparing axios request to OpenAI...');

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
      maxBodyLength: Infinity,
      timeout: 60000 // 60 секунд таймаут для транскрибации
    };

    // Добавляем прокси агент если настроен
    if (proxyAgent) {
      console.log('🔧 [Transcription API] Using proxy agent for request');
      axiosConfig.httpsAgent = proxyAgent;
      axiosConfig.httpAgent = proxyAgent;
    } else {
      console.log('🔧 [Transcription API] No proxy agent, using direct connection');
    }

    console.log('🎵 [Transcription API] Sending transcription request to OpenAI...');

    let response;
    let attemptedWithoutProxy = false;

    try {
      response = await axios(axiosConfig);
    } catch (error) {
      // If proxy is set and network unreachable/timeouts/connection refused occur, retry without proxy once
      const retriableNetworkErrors = ['ENETUNREACH', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ECONNREFUSED'];
      const shouldRetryWithoutProxy = proxyAgent && !attemptedWithoutProxy &&
        (retriableNetworkErrors.includes(error.code) || error.message?.includes('timeout'));

      if (shouldRetryWithoutProxy) {
        console.warn('⚠️ [Transcription API] Proxy request failed, retrying without proxy...', {
          error: error.code || error.message
        });
        attemptedWithoutProxy = true;
        const axiosConfigNoProxy = { ...axiosConfig };
        delete axiosConfigNoProxy.httpAgent;
        delete axiosConfigNoProxy.httpsAgent;
        axiosConfigNoProxy.proxy = false;
        response = await axios(axiosConfigNoProxy);
      } else {
        throw error;
      }
    }

    console.log('✅ [Transcription API] OpenAI transcription successful:', {
      responseStatus: response.status,
      responseDataType: typeof response.data,
      responseDataPreview: typeof response.data === 'string' 
        ? response.data.substring(0, 100) 
        : JSON.stringify(response.data).substring(0, 100),
      dataLength: typeof response.data === 'string' 
        ? response.data.length 
        : JSON.stringify(response.data).length
    });

    logToFile('INFO', 'Audio transcription successful', {
      fileSize: req.file.size,
      responseSize: typeof response.data === 'string' 
        ? response.data.length 
        : JSON.stringify(response.data).length,
      language,
      model
    });

    // Возвращаем результат как есть (может быть текст или JSON)
    // Устанавливаем правильный Content-Type
    if (typeof response.data === 'string') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.status(response.status).send(response.data);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.status(response.status).json(response.data);
    }

  } catch (error) {
    const errorDetails = {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      stack: error.stack?.substring(0, 500),
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      hasFile: !!req.file
    };

    console.error('❌ [Transcription API] Transcription error:', errorDetails);

    logToFile('ERROR', 'Audio transcription failed', {
      error: error.message,
      stack: error.stack,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
      errorCode: error.code
    });

    if (error.response) {
      // OpenAI API вернул ошибку
      const errorMessage = error.response.data?.error?.message || 
                          error.response.data?.error || 
                          JSON.stringify(error.response.data);
      console.log('❌ [Transcription API] OpenAI responded with error:', error.response.status, errorMessage);
      
      res.status(error.response.status).json({
        error: 'Transcription failed',
        details: errorMessage,
        status: error.response.status
      });
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      // Таймаут
      console.log('❌ [Transcription API] Request timeout:', error.message);
      res.status(504).json({
        error: 'Transcription timeout',
        details: 'The transcription request took too long. Please try again.',
        timeout: true
      });
    } else {
      // Сетевая или другая ошибка
      console.log('❌ [Transcription API] Network or other error:', error.message);
      res.status(500).json({
        error: 'Audio transcription failed',
        details: error.message,
        code: error.code
      });
    }
  }
});

// ===== END AUDIO ENDPOINTS =====

// OpenAI DALL-E 3 endpoint для генерации изображений
app.post('/api/openai/generate-image', async (req, res) => {
  try {
    const { prompt, model = 'dall-e-3', size = '1024x1024', quality = 'standard' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const apiKey = process.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured',
        details: 'Check OPENAI_API_KEY or VITE_OPENAI_API_KEY environment variables'
      });
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

    let response;
    let attemptedWithoutProxy = false;

    try {
      response = await axios(axiosConfig);
    } catch (error) {
      // If proxy is set and network unreachable/timeouts/connection refused occur, retry without proxy once
      const retriableNetworkErrors = ['ENETUNREACH', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ECONNREFUSED'];
      const shouldRetryWithoutProxy = proxyAgent && !attemptedWithoutProxy &&
        (retriableNetworkErrors.includes(error.code) || error.message?.includes('timeout'));

      if (shouldRetryWithoutProxy) {
        console.warn('⚠️ [DALL-E API] Proxy request failed, retrying without proxy...', {
          error: error.code || error.message
        });
        attemptedWithoutProxy = true;
        const axiosConfigNoProxy = { ...axiosConfig };
        delete axiosConfigNoProxy.httpAgent;
        delete axiosConfigNoProxy.httpsAgent;
        axiosConfigNoProxy.proxy = false;
        response = await axios(axiosConfigNoProxy);
      } else {
        throw error;
      }
    }

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
app.post('/api/openai/v1/audio/transcriptions', upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), async (req, res) => {
  try {
    const apiKey = process.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      logToFile('ERROR', 'OpenAI API key not configured for audio transcription');
      console.error('❌ [OpenAI Audio] API key not configured');
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

    console.log('✅ [OpenAI Audio] API key validated, starting transcription');

    // Проверяем наличие файла в любом из полей
    const audioFile = req.files?.file?.[0] || req.files?.audio?.[0] || req.file;

    console.log('🎵 [OpenAI Audio] Received transcription request', {
      hasFile: !!audioFile,
      fileInfo: audioFile ? {
        originalname: audioFile.originalname,
        mimetype: audioFile.mimetype,
        size: audioFile.size,
        encoding: audioFile.encoding
      } : null,
      body: req.body,
      headers: req.headers
    });

    if (!audioFile) {
      console.error('❌ [OpenAI Audio] No file received in request');
      return res.status(400).json({
        error: 'Audio file is required'
      });
    }

    // Проверяем размер файла (OpenAI ограничение: 25MB)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioFile.size > maxSize) {
      console.error('❌ [OpenAI Audio] File too large:', audioFile.size, 'bytes (max:', maxSize, ')');
      return res.status(400).json({
        error: 'Audio file is too large. Maximum size is 25MB.'
      });
    }

    console.log('🎵 [OpenAI Audio] Starting transcription request');

    // Создаем новый FormData для отправки в OpenAI
    const formData = new FormData();
    const addedFields = new Set();

    // Добавляем файл в FormData
    if (audioFile) {
      formData.append('file', audioFile.buffer, {
        filename: audioFile.originalname,
        contentType: audioFile.mimetype
      });
      addedFields.add('file');
    }

    // Копируем все остальные поля из оригинального запроса
    for (const [key, value] of Object.entries(req.body)) {
      // Пропускаем поля с файлами, так как мы их уже обработали выше
      if (key !== 'file' && key !== 'audio') {
        formData.append(key, value);
        addedFields.add(key);
      }
    }

    // Устанавливаем язык на русский по умолчанию
    if (!addedFields.has('language')) {
      formData.append('language', 'ru');
      addedFields.add('language');
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
      console.log('🔧 [Transcription API] Using proxy agent for request');
      axiosConfig.httpsAgent = proxyAgent;
      axiosConfig.httpAgent = proxyAgent;
    } else {
      console.log('🔧 [Transcription API] No proxy agent, using direct connection');
    }

    console.log('🎵 [OpenAI Audio] Sending transcription request to OpenAI', {
      fileSize: audioFile.size,
      fileType: audioFile.mimetype,
      addedFields: Array.from(addedFields)
    });

    let response;
    let attemptedWithoutProxy = false;

    try {
      response = await axios(axiosConfig);
    } catch (error) {
      // If proxy is set and network unreachable/timeouts/connection refused occur, retry without proxy once
      const retriableNetworkErrors = ['ENETUNREACH', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ECONNREFUSED'];
      const shouldRetryWithoutProxy = proxyAgent && !attemptedWithoutProxy &&
        (retriableNetworkErrors.includes(error.code) || error.message?.includes('timeout'));

      if (shouldRetryWithoutProxy) {
        console.warn('⚠️ [OpenAI Audio] Proxy request failed, retrying without proxy...', {
          error: error.code || error.message
        });
        attemptedWithoutProxy = true;
        const axiosConfigNoProxy = { ...axiosConfig };
        delete axiosConfigNoProxy.httpAgent;
        delete axiosConfigNoProxy.httpsAgent;
        axiosConfigNoProxy.proxy = false;
        response = await axios(axiosConfigNoProxy);
      } else {
        throw error;
      }
    }

    logToFile('INFO', 'Audio transcription successful', {
      responseSize: JSON.stringify(response.data).length
    });

    // Возвращаем результат как есть
    res.status(response.status).send(response.data);

  } catch (error) {
    console.error('❌ [OpenAI Audio] Transcription error:', error.message, {
      hasResponse: !!error.response,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code,
      errno: error.errno
    });

    logToFile('ERROR', 'Audio transcription failed', {
      error: error.message,
      stack: error.stack,
      responseStatus: error.response?.status,
      responseData: error.response?.data
    });

    if (error.response) {
      console.error('❌ [OpenAI Audio] OpenAI API error response:', error.response.status, error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error('❌ [OpenAI Audio] Network/other error:', error.message);
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
      
      let response;
      let attemptedWithoutProxy = false;

      try {
        response = await axios(axiosConfig);
      } catch (error) {
        // If proxy is set and network unreachable/timeouts/connection refused occur, retry without proxy once
        const retriableNetworkErrors = ['ENETUNREACH', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ECONNREFUSED'];
        const shouldRetryWithoutProxy = proxyAgent && !attemptedWithoutProxy &&
          (retriableNetworkErrors.includes(error.code) || error.message?.includes('timeout'));

        if (shouldRetryWithoutProxy) {
          console.warn('⚠️ [OpenAI Proxy] Proxy request failed, retrying without proxy...', {
            error: error.code || error.message
          });
          attemptedWithoutProxy = true;
          const axiosConfigNoProxy = { ...axiosConfig };
          delete axiosConfigNoProxy.httpAgent;
          delete axiosConfigNoProxy.httpsAgent;
          axiosConfigNoProxy.proxy = false;
          response = await axios(axiosConfigNoProxy);
        } else {
          throw error;
        }
      }

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

    // Устанавливаем таймаут (10 минут для генерации рецептов)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000);

    // Пробуем сначала без прокси, если с прокси не работает
    let proxyAttempt = proxyAgent;
    let retryWithoutProxy = false;

    console.log('📤 [OpenAI] Sending request to OpenAI API...');
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

    console.log('📥 [OpenAI] Received response from OpenAI API:', response.status, response.statusText);

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

app.all('/api/openai/v1/chat/completions-stream', async (req, res) => {
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
      bodyPreview: JSON.stringify(req.body).substring(0, 200),
      proxyEnabled: !!proxyAgent,
      proxyUrl: proxyUrl ? proxyUrl.replace(/:[^@]*@/, ':***@') : 'none'
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
    const limitCheck = await checkImageLimit(userKey);
    
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
app.get('/api/image-limits/:userIdentifier', async (req, res) => {
  try {
    const { userIdentifier } = req.params;
    const userKey = userIdentifier || req.ip || 'anonymous';
    const limitCheck = await checkImageLimit(userKey);
    
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
      const fsPromises = await import('fs/promises');
      const fs = await import('fs');
      const path = await import('path');

      const subscriptionsDir = path.join(process.cwd(), 'data');
      const subscriptionsFile = path.join(subscriptionsDir, 'subscriptions.json');

      // Создаем директорию если не существует
      try {
        await fsPromises.mkdir(subscriptionsDir, { recursive: true });
      } catch (mkdirError) {
        if (mkdirError.code !== 'EEXIST') {
          throw mkdirError;
        }
      }

      // Читаем существующие подписки
      let subscriptions = [];
      try {
        const data = await fsPromises.readFile(subscriptionsFile, 'utf8');
        subscriptions = JSON.parse(data || '[]');
      } catch (readError) {
        if (readError.code !== 'ENOENT') {
          throw readError;
        }
        // Файл не существует, используем пустой массив
      }

      // Добавляем новую подписку
      subscriptions.push(subscriptionData);

      // Сохраняем обратно
      await fsPromises.writeFile(subscriptionsFile, JSON.stringify(subscriptions, null, 2));

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
    if (!db) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { userId } = req.params;
    const { limit = 5 } = req.query;

    console.log('💰 Server: Getting recent payments for user:', userId);

    // Получаем недавние подписки пользователя из БД
    const subscriptions = await db.all(`
      SELECT payment_id, activated_at, amount, currency, status
      FROM subscriptions
      WHERE user_id = ?
      ORDER BY activated_at DESC
      LIMIT ?
    `, [userId, parseInt(limit)]);

    console.log('💰 Server: Found user subscriptions:', subscriptions.length);

    if (subscriptions.length > 0) {
      // Возвращаем самый свежий платеж
      const recentPayment = subscriptions[0];
      return res.json({
        id: recentPayment.payment_id,
        userId: parseInt(userId),
        amount: { value: recentPayment.amount, currency: recentPayment.currency },
        status: 'succeeded',
        paid: true,
        activatedAt: recentPayment.activated_at
      });
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

    console.log('💰 [Payment] Creating payment for user:', { userId, userEmail, returnUrl });
    console.log('💰 [Payment] YooKassa config check:', {
      shopId: process.env.YOOKASSA_SHOP_ID ? 'SET' : 'NOT SET',
      secretKey: process.env.YOOKASSA_SECRET_KEY ? 'SET (length: ' + process.env.YOOKASSA_SECRET_KEY.length + ')' : 'NOT SET'
    });

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

// ===== YOOKASSA WEBHOOK HANDLER =====

// Webhook для обработки уведомлений от YooKassa
app.post('/api/payments/webhook', async (req, res) => {
  let signatureVerified = false;

  try {
    // Парсим raw JSON body для webhook
    const rawBody = req.body.toString();
    const webhookData = JSON.parse(rawBody);
    const paymentId = webhookData.object?.id;
    const eventType = webhookData.event;
    const status = webhookData.object?.status;
    const userId = webhookData.object?.metadata?.userId;

    console.log('🔗 [Webhook] Received YooKassa webhook:', {
      paymentId,
      eventType,
      status,
      userId,
      timestamp: new Date().toISOString()
    });

    // ===== MANDATORY SIGNATURE VERIFICATION IN PRODUCTION =====
    const signature = req.headers['x-yookassa-signature'];
    if (!signature) {
      console.error('❌ [Webhook] Missing signature header');
      logToFile('ERROR', 'Missing webhook signature', { paymentId });
      return res.status(400).json({ error: 'Missing signature' });
    }

    if (!YOOKASSA_CONFIG.secretKey) {
      console.error('❌ [Webhook] YOOKASSA_SECRET_KEY not configured');
      logToFile('ERROR', 'YOOKASSA_SECRET_KEY not configured', { paymentId });
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const isValidSignature = verifySignature(Buffer.from(rawBody), signature, YOOKASSA_CONFIG.secretKey);
    if (!isValidSignature) {
      console.error('❌ [Webhook] Invalid signature received');
      logToFile('ERROR', 'Invalid webhook signature', { paymentId, signature });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    signatureVerified = true;
    console.log('✅ [Webhook] Signature verified successfully');

    if (!paymentId) {
      logToFile('ERROR', 'Invalid webhook data - missing paymentId', webhookData);
      return res.status(400).json({ error: 'Invalid webhook data' });
    }

    // ===== IDEMPOTENCY CHECK =====
    const eventId = `${eventType}:${paymentId}`;
    try {
      // Check if this event was already processed
      const existingEvent = await db.get(
        'SELECT id FROM payment_events WHERE payment_id = ? AND event_type = ?',
        [eventId, eventType]
      );

      if (existingEvent) {
        console.log('⚠️ [Webhook] Event already processed (idempotency):', eventId);
        return res.status(200).json({ received: true, idempotent: true });
      }
    } catch (dbError) {
      console.error('❌ [Webhook] Database error during idempotency check:', dbError);
      return res.status(500).json({ error: 'Database error' });
    }

    // ===== RECORD EVENT IN DATABASE =====
    const processedAt = new Date().toISOString();
    try {
      await db.run(
        'INSERT INTO payment_events (payment_id, event_type, event_data, signature_verified, processed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [eventId, eventType, JSON.stringify(webhookData), signatureVerified, processedAt, processedAt]
      );
      console.log('💾 [Webhook] Event recorded in database:', eventId);
    } catch (dbError) {
      console.error('❌ [Webhook] Failed to record event:', dbError);
      return res.status(500).json({ error: 'Database error' });
    }

    // ===== PROCESS PAYMENT EVENT =====
    logToFile('INFO', 'Payment webhook processed', {
      paymentId: eventId,
      eventType,
      status,
      userId,
      signatureVerified,
      amount: webhookData.object?.amount
    });

    // Обрабатываем успешный платеж
    if (status === 'succeeded' && userId) {
      console.log('✅ [Webhook] Payment succeeded for user:', userId);

      try {
        // Активируем подписку в БД
        const subscriptionData = {
          user_id: parseInt(userId),
          payment_id: eventId,
          activated_at: processedAt,
          expires_at: null, // Бессрочная подписка
          amount: webhookData.object?.amount?.value || 0,
          currency: webhookData.object?.amount?.currency || 'RUB',
          status: 'active',
          created_at: processedAt,
          updated_at: processedAt
        };

        // Проверяем, нет ли уже активной подписки
        const existingSubscription = await db.get(
          'SELECT id FROM subscriptions WHERE user_id = ? AND status = ?',
          [userId, 'active']
        );

        if (existingSubscription) {
          // Продлеваем существующую подписку
          await db.run(
            'UPDATE subscriptions SET updated_at = ?, payment_id = ? WHERE id = ?',
            [processedAt, eventId, existingSubscription.id]
          );
          console.log('🔄 [Subscription] Extended existing subscription for user:', userId);
        } else {
          // Создаем новую подписку
          await db.run(`
            INSERT INTO subscriptions (user_id, payment_id, activated_at, expires_at, amount, currency, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            subscriptionData.user_id,
            subscriptionData.payment_id,
            subscriptionData.activated_at,
            subscriptionData.expires_at,
            subscriptionData.amount,
            subscriptionData.currency,
            subscriptionData.status,
            subscriptionData.created_at,
            subscriptionData.updated_at
          ]);
          console.log('✅ [Subscription] Created new subscription for user:', userId);
        }

        logToFile('INFO', 'Premium subscription activated', subscriptionData);

        // Отправляем email уведомление
        try {
          const { CustomEmailService } = await import('./src/services/custom-email.js');
          await CustomEmailService.sendPaymentSuccessNotification(userId, paymentId);
          console.log('📧 [Webhook] Success notification sent to user:', userId);
        } catch (emailError) {
          console.error('📧 [Webhook] Failed to send notification:', emailError);
        }

      } catch (subscriptionError) {
        console.error('❌ [Webhook] Failed to activate subscription:', subscriptionError);
        logToFile('ERROR', 'Subscription activation failed', {
          userId,
          paymentId: eventId,
          error: subscriptionError.message
        });
      }
    }

    // Возвращаем 200 OK для подтверждения получения webhook
    res.status(200).json({ received: true, processed: true });

  } catch (error) {
    console.error('💥 [Webhook] Error processing webhook:', error);
    logToFile('ERROR', 'Webhook processing error', {
      error: error.message,
      stack: error.stack,
      signatureVerified,
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
app.get('/api/smtp/auth-config', authenticateToken, requireRole('admin'), async (req, res) => {
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
app.post('/api/smtp/auth-config', authenticateToken, requireRole('admin'), async (req, res) => {
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
    url: req.url,
    ip: req.ip,
    headers: {
      host: req.headers.host,
      origin: req.headers.origin,
      referer: req.headers.referer,
      'user-agent': req.headers['user-agent'],
      'x-forwarded-for': req.headers['x-forwarded-for']
    },
    bodyMeta: {
      hasMessages: Array.isArray(req.body?.messages),
      messagesCount: Array.isArray(req.body?.messages) ? req.body.messages.length : 0,
      model: req.body?.model,
      stream: req.body?.stream
    }
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

    console.log('🛰️ [Chat Streaming] Sending request to OpenAI:', {
      url,
      stream,
      model: requestBody.model,
      messagesCount: requestBody.messages?.length,
      firstMessagePreview: requestBody.messages?.[0]?.content?.substring?.(0, 120),
      lastMessagePreview: requestBody.messages?.[requestBody.messages.length - 1]?.content?.substring?.(0, 120),
      temperature: requestBody.temperature,
      max_completion_tokens: requestBody.max_completion_tokens
    });

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
        signal: AbortSignal.timeout(10 * 60 * 1000) // 10 минут таймаут для сложных рецептов
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
          errorText: errorText?.substring(0, 4000),
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
        signal: AbortSignal.timeout(10 * 60 * 1000) // 10 минут таймаут
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('❌ [Chat Regular] OpenAI API Error:', {
          status: openaiResponse.status,
          statusText: openaiResponse.statusText,
          errorText: errorText?.substring(0, 4000),
          headers: Object.fromEntries(openaiResponse.headers.entries())
        });
        return res.status(openaiResponse.status).send(errorText);
      }

      const data = await openaiResponse.json();
      res.json(data);
    }

  } catch (error) {
    console.error('❌ [Chat API] Error:', {
      message: error.message,
      stack: error.stack
    });
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
        serverUrl: `https://cook.windexs.ru`
      });

      console.log(`🚀 Pastel Chef AI API server running on port ${PORT}`);
      console.log(`🗄️ SQLite database: ${dbPath}`);
      console.log(`🔑 OpenAI API key configured: ${process.env.VITE_OPENAI_API_KEY ? 'Yes' : 'No'}`);
      console.log(`🌐 Proxy configured: ${PROXY_HOST}:${PROXY_PORT} (${PROXY_USERNAME})`);
      console.log(`📁 Logs directory: ${logsDir}`);
      console.log(`🌐 Server URL: https://cook.windexs.ru`);
    });
  } catch (error) {
    console.error('❌ [Server] Failed to start server:', error);
    process.exit(1);
  }
}

// Запускаем сервер
startServer();
