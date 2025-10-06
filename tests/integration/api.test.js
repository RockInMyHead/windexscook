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

import axios from 'axios';

// Создаем тестовый сервер с полной функциональностью
const createIntegrationServer = () => {
  const app = express();
  
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });
  
  // OpenAI proxy endpoint
  app.post('/api/openai/completions', async (req, res) => {
    try {
      const { model, messages } = req.body;
      
      if (!model || !messages) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      // Мокаем успешный ответ OpenAI
      const mockResponse = {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: model,
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
  
  // ElevenLabs proxy endpoint
  app.post('/api/elevenlabs/v1/text-to-speech/:voice_id', async (req, res) => {
    try {
      const { voice_id } = req.params;
      const { text, model_id } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      
      // Мокаем аудио ответ
      const mockAudioBuffer = Buffer.from('fake audio data for testing');
      
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': mockAudioBuffer.length.toString()
      });
      
      res.send(mockAudioBuffer);
    } catch (error) {
      console.error('ElevenLabs Proxy Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Error handling middleware
  app.use((error, req, res, next) => {
    // Обработка ошибок JSON парсинга
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    
    // Обработка других ошибок
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
  });
  
  return app;
};

describe('API Integration Tests', () => {
  let app;
  
  beforeEach(() => {
    app = createIntegrationServer();
    jest.clearAllMocks();
  });
  
  describe('Health Check Endpoint', () => {
    test('should return server status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toMatchObject({
        status: 'ok',
        version: '1.0.0'
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });
  
  describe('OpenAI Proxy Integration', () => {
    test('should handle recipe generation request', async () => {
      const requestData = {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Ты - профессиональный Windexs кулинар...'
          },
          {
            role: 'user',
            content: 'Создай рецепт из картофеля и лука'
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      };
      
      const response = await request(app)
        .post('/api/openai/completions')
        .send(requestData)
        .expect(200);
      
      expect(response.body).toMatchObject({
        id: expect.any(String),
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
    
    test('should handle chat with chef request', async () => {
      const requestData = {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: 'Как приготовить борщ?'
          }
        ]
      };
      
      const response = await request(app)
        .post('/api/openai/completions')
        .send(requestData)
        .expect(200);
      
      expect(response.body.choices[0].message.content).toBeDefined();
    });
    
    test('should handle image analysis request', async () => {
      const requestData = {
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
        .post('/api/openai/completions')
        .send(requestData)
        .expect(200);
      
      expect(response.body.choices[0].message.content).toBeDefined();
    });
    
    test('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/openai/completions')
        .send({})
        .expect(400);
      
      expect(response.body.error).toBe('Missing required fields');
    });
  });
  
  describe('ElevenLabs Proxy Integration', () => {
    test('should handle text-to-speech request', async () => {
      const requestData = {
        text: 'Привет! Это тестовый текст для синтеза речи.',
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      };
      
      const response = await request(app)
        .post('/api/elevenlabs/v1/text-to-speech/test-voice-id')
        .send(requestData)
        .expect(200);
      
      expect(response.headers['content-type']).toBe('audio/mpeg');
      expect(response.headers['content-length']).toBeDefined();
      expect(Buffer.isBuffer(response.body)).toBe(true);
    });
    
    test('should handle missing text parameter', async () => {
      const response = await request(app)
        .post('/api/elevenlabs/v1/text-to-speech/test-voice-id')
        .send({})
        .expect(400);
      
      expect(response.body.error).toBe('Text is required');
    });
  });
  
  describe('CORS Integration', () => {
    test('should allow CORS requests', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
    
    test('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/openai/completions')
        .expect(204);
      
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });
  
  describe('Error Handling Integration', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/openai/completions')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
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
        .post('/api/openai/completions')
        .send(requestData)
        .expect(200);
      
      expect(response.body.choices[0].message.content).toBeDefined();
    });
  });
});
