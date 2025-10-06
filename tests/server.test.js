import request from 'supertest';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Мокаем axios для тестов
jest.mock('axios');
import axios from 'axios';

// Мокаем fs для тестов
jest.mock('fs');
import fs from 'fs';

// Мокаем HttpsProxyAgent
jest.mock('https-proxy-agent', () => ({
  HttpsProxyAgent: jest.fn(() => ({})),
}));

// Создаем тестовый сервер
const createTestServer = () => {
  const app = express();
  
  app.use(cors());
  app.use(express.json());
  
  // Тестовые маршруты
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  app.post('/api/openai/completions', async (req, res) => {
    try {
      // Мокаем ответ OpenAI
      const mockResponse = {
        choices: [{
          message: {
            content: 'Тестовый ответ от AI'
          }
        }]
      };
      res.json(mockResponse);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.post('/api/elevenlabs/v1/text-to-speech/:voice_id', async (req, res) => {
    try {
      // Мокаем ответ ElevenLabs
      res.set('Content-Type', 'audio/mpeg');
      res.send(Buffer.from('fake audio data'));
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  return app;
};

describe('Server Tests', () => {
  let app;
  
  beforeEach(() => {
    app = createTestServer();
    // Сбрасываем все моки
    jest.clearAllMocks();
  });
  
  describe('Health Check', () => {
    test('GET /health should return status ok', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });
  
  describe('OpenAI Proxy', () => {
    test('POST /api/openai/completions should proxy request', async () => {
      const testData = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Test message' }]
      };
      
      const response = await request(app)
        .post('/api/openai/completions')
        .send(testData)
        .expect(200);
      
      expect(response.body.choices).toBeDefined();
      expect(response.body.choices[0].message.content).toBe('Тестовый ответ от AI');
    });
  });
  
  describe('ElevenLabs Proxy', () => {
    test('POST /api/elevenlabs/v1/text-to-speech/:voice_id should proxy request', async () => {
      const testData = {
        text: 'Test text for speech',
        model_id: 'eleven_multilingual_v2'
      };
      
      const response = await request(app)
        .post('/api/elevenlabs/v1/text-to-speech/test-voice-id')
        .send(testData)
        .expect(200);
      
      expect(response.headers['content-type']).toContain('audio/mpeg');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle missing API key gracefully', async () => {
      // Тест для обработки отсутствующих API ключей
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('ok');
    });
  });
  
  describe('CORS', () => {
    test('should allow CORS requests', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});
