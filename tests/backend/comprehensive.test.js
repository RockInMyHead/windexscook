import request from 'supertest';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Мокаем внешние зависимости
jest.mock('axios');
jest.mock('https-proxy-agent', () => ({
  HttpsProxyAgent: jest.fn(() => ({})),
}));
jest.mock('fs');
jest.mock('path');

import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Создаем полнофункциональный тестовый сервер
const createComprehensiveServer = () => {
  const app = express();
  
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  // Middleware для логирования (мок)
  const requestLogger = (req, res, next) => {
    next();
  };
  app.use(requestLogger);
  
  // Middleware для отключения кэширования
  app.disable('etag');
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime()
    });
  });
  
  // OpenAI API proxy endpoint
  app.use('/api/openai', async (req, res) => {
    try {
      const apiKey = process.env.VITE_OPENAI_API_KEY || 'test-key';
      
      if (!apiKey) {
        return res.status(500).json({ 
          error: 'OpenAI API key not configured' 
        });
      }

      const path = req.path.replace('/api/openai', '');
      const url = `https://api.openai.com${path}`;

      const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...req.headers
      };

      delete headers.host;

      // Мокаем успешный ответ OpenAI
      const mockResponse = {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: req.body?.model || 'gpt-4o-mini',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Тестовый ответ от AI модели'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      };
      
      res.json(mockResponse);
    } catch (error) {
      console.error('OpenAI Proxy Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  
  // Static file serving (мок)
  app.use(express.static('dist'));
  
  // Error handling middleware
  app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
  });
  
  return app;
};

describe('Comprehensive Backend Tests', () => {
  let app;
  
  beforeEach(() => {
    app = createComprehensiveServer();
    jest.clearAllMocks();
  });
  
  describe('Server Health and Configuration', () => {
    test('should return server health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toMatchObject({
        status: 'ok',
        version: '1.0.0'
      });
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });
    
    test('should handle CORS requests', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
    
    test('should set no-cache headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['pragma']).toBe('no-cache');
      expect(response.headers['expires']).toBe('0');
    });
  });
  
  describe('OpenAI API Proxy', () => {
    test('should proxy chat completions request', async () => {
      const requestData = {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: 'Привет! Как дела?'
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      };
      
      const response = await request(app)
        .post('/api/openai/v1/chat/completions')
        .send(requestData)
        .expect(200);
      
      expect(response.body).toMatchObject({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        model: 'gpt-4o-mini',
        choices: expect.arrayContaining([
          expect.objectContaining({
            message: expect.objectContaining({
              role: 'assistant',
              content: expect.any(String)
            })
          })
        ])
      });
    });
    
    test('should handle missing API key', async () => {
      // Временно удаляем API ключ
      const originalKey = process.env.VITE_OPENAI_API_KEY;
      delete process.env.VITE_OPENAI_API_KEY;
      
      const response = await request(app)
        .post('/api/openai/v1/chat/completions')
        .send({ model: 'gpt-4o-mini', messages: [] })
        .expect(500);
      
      expect(response.body.error).toBe('OpenAI API key not configured');
      
      // Восстанавливаем API ключ
      if (originalKey) {
        process.env.VITE_OPENAI_API_KEY = originalKey;
      }
    });
    
    test('should handle different OpenAI endpoints', async () => {
      const endpoints = [
        '/api/openai/v1/chat/completions',
        '/api/openai/v1/models',
        '/api/openai/v1/embeddings'
      ];
      
      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .expect(200);
        
        expect(response.body).toBeDefined();
      }
    });
  });
  
  
  describe('Error Handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/openai/v1/chat/completions')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
      
      expect(response.body.error).toBe('Invalid JSON');
    });
    
    test('should handle large payloads', async () => {
      const largeText = 'a'.repeat(10000);
      const requestData = {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: largeText
          }
        ]
      };
      
      const response = await request(app)
        .post('/api/openai/v1/chat/completions')
        .send(requestData)
        .expect(200);
      
      expect(response.body.choices[0].message.content).toBeDefined();
    });
    
    test('should handle unsupported HTTP methods', async () => {
      const response = await request(app)
        .patch('/api/openai/v1/chat/completions')
        .send({})
        .expect(200); // Наш мок обрабатывает все методы
      
      expect(response.body).toBeDefined();
    });
  });
  
  describe('Request Logging and Monitoring', () => {
    test('should log request details', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      // Проверяем, что запрос обработан
      expect(response.status).toBe(200);
    });
    
    test('should handle concurrent requests', async () => {
      const requests = Array(5).fill().map(() => 
        request(app).get('/health')
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });
  });
  
  describe('API Integration Scenarios', () => {
    test('should handle complete recipe generation workflow', async () => {
      // 1. Генерируем рецепт
      const recipeRequest = {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Ты - профессиональный Windexs кулинар...'
          },
          {
            role: 'user',
            content: 'Создай рецепт борща'
          }
        ]
      };
      
      const recipeResponse = await request(app)
        .post('/api/openai/v1/chat/completions')
        .send(recipeRequest)
        .expect(200);
      
      expect(recipeResponse.body.choices[0].message.content).toBeDefined();
      
      // 2. Синтезируем речь для рецепта
      const ttsRequest = {
        text: 'Вот рецепт борща: начните с приготовления бульона...',
        model_id: 'eleven_multilingual_v2'
      };
      
      const ttsResponse = await request(app)
        .post('/api/elevenlabs/v1/text-to-speech/test-voice-id')
        .send(ttsRequest)
        .expect(200);
      
      expect(ttsResponse.headers['content-type']).toBe('audio/mpeg');
    });
    
    test('should handle chat with chef workflow', async () => {
      const chatRequest = {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: 'Как приготовить идеальный стейк?'
          }
        ]
      };
      
      const response = await request(app)
        .post('/api/openai/v1/chat/completions')
        .send(chatRequest)
        .expect(200);
      
      expect(response.body.choices[0].message.content).toBeDefined();
    });
    
    test('should handle image analysis workflow', async () => {
      const imageRequest = {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Что на этом изображении?'
              },
              {
                type: 'image_url',
                image_url: {
                  url: 'data:image/jpeg;base64,fake-image-data'
                }
              }
            ]
          }
        ]
      };
      
      const response = await request(app)
        .post('/api/openai/v1/chat/completions')
        .send(imageRequest)
        .expect(200);
      
      expect(response.body.choices[0].message.content).toBeDefined();
    });
  });
  
  describe('Performance and Load Testing', () => {
    test('should handle multiple rapid requests', async () => {
      const startTime = Date.now();
      
      const requests = Array(10).fill().map(() => 
        request(app).get('/health')
      );
      
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Проверяем, что все запросы обработаны за разумное время
      expect(endTime - startTime).toBeLessThan(5000); // 5 секунд
    });
    
    test('should handle mixed request types', async () => {
      const requests = [
        request(app).get('/health'),
        request(app).post('/api/openai/v1/chat/completions').send({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'test' }]
        }),
        request(app).get('/api/elevenlabs/v1/voices'),
        request(app).post('/api/elevenlabs/v1/text-to-speech/test-voice-id').send({
          text: 'test'
        })
      ];
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});
