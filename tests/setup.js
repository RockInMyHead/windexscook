// Настройка для тестов
import dotenv from 'dotenv';

// Загружаем переменные окружения для тестов
dotenv.config({ path: '.env.test' });

// Устанавливаем тестовые переменные окружения
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'test-key';

// Мокаем прокси для тестов
process.env.PROXY_HOST = 'test-proxy';
process.env.PROXY_PORT = '8000';
process.env.PROXY_USERNAME = 'test-user';
process.env.PROXY_PASSWORD = 'test-pass';

// Увеличиваем таймаут для тестов
jest.setTimeout(30000);
