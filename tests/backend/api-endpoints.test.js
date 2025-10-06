import request from 'supertest';
import express from 'express';
import cors from 'cors';

// Мокаем внешние зависимости
jest.mock('axios');
jest.mock('https-proxy-agent', () => ({
  HttpsProxyAgent: jest.fn(() => ({})),
}));

import axios from 'axios';

describe('API Endpoints', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(cors());
    app.use(express.json());
    jest.clearAllMocks();
  });
  
  describe('Health Check Endpoint', () => {
    test('should return server status', async () => {
      app.get('/health', (req, res) => {
        res.json({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          uptime: process.uptime()
        });
      });
      
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
  });
  
  describe('OpenAI API Endpoints', () => {
    beforeEach(() => {
      // Мокаем успешный ответ OpenAI
      axios.mockResolvedValue({
        status: 200,
        data: {
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4o-mini',
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
        }
      });
    });
    
    test('should handle chat completions', async () => {
      app.use('/api/openai', async (req, res) => {
        const apiKey = process.env.VITE_OPENAI_API_KEY || 'test-key';
        
        if (!apiKey) {
          return res.status(500).json({ error: 'OpenAI API key not configured' });
        }

        const path = req.path.replace('/api/openai', '');
        const url = `https://api.openai.com${path}`;

        const headers = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...req.headers
        };

        delete headers.host;

        try {
          const response = await axios({
            method: req.method,
            url: url,
            headers,
            data: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
          });

          res.status(response.status).json(response.data);
        } catch (error) {
          res.status(500).json({ error: 'Internal server error' });
        }
      });
      
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
    
    test('should handle models endpoint', async () => {
      axios.mockResolvedValue({
        status: 200,
        data: {
          object: 'list',
          data: [
            {
              id: 'gpt-4o-mini',
              object: 'model',
              created: Date.now(),
              owned_by: 'openai'
            }
          ]
        }
      });
      
      app.use('/api/openai', async (req, res) => {
        const response = await axios({
          method: req.method,
          url: `https://api.openai.com${req.path.replace('/api/openai', '')}`,
          headers: {
            'Authorization': `Bearer ${process.env.VITE_OPENAI_API_KEY || 'test-key'}`,
            'Content-Type': 'application/json'
          }
        });
        
        res.status(response.status).json(response.data);
      });
      
      const response = await request(app)
        .get('/api/openai/v1/models')
        .expect(200);
      
      expect(response.body.object).toBe('list');
      expect(response.body.data).toBeInstanceOf(Array);
    });
    
    test('should handle embeddings endpoint', async () => {
      axios.mockResolvedValue({
        status: 200,
        data: {
          object: 'list',
          data: [
            {
              object: 'embedding',
              index: 0,
              embedding: Array(1536).fill(0.1)
            }
          ],
          model: 'text-embedding-ada-002',
          usage: {
            prompt_tokens: 5,
            total_tokens: 5
          }
        }
      });
      
      app.use('/api/openai', async (req, res) => {
        const response = await axios({
          method: req.method,
          url: `https://api.openai.com${req.path.replace('/api/openai', '')}`,
          headers: {
            'Authorization': `Bearer ${process.env.VITE_OPENAI_API_KEY || 'test-key'}`,
            'Content-Type': 'application/json'
          },
          data: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });
        
        res.status(response.status).json(response.data);
      });
      
      const requestData = {
        model: 'text-embedding-ada-002',
        input: 'Тестовый текст для эмбеддинга'
      };
      
      const response = await request(app)
        .post('/api/openai/v1/embeddings')
        .send(requestData)
        .expect(200);
      
      expect(response.body.object).toBe('list');
      expect(response.body.data[0].embedding).toBeInstanceOf(Array);
    });
  });
  
  describe('ElevenLabs API Endpoints', () => {
    test('should handle text-to-speech', async () => {
      const mockAudioBuffer = Buffer.from('fake audio data for testing');
      
      axios.mockResolvedValue({
        status: 200,
        data: mockAudioBuffer,
        headers: {
          'content-type': 'audio/mpeg',
          'content-length': mockAudioBuffer.length.toString()
        }
      });
      
      app.use('/api/elevenlabs', async (req, res) => {
        const apiKey = process.env.ELEVENLABS_API_KEY || 'test-key';
        
        if (!apiKey) {
          return res.status(500).json({ error: 'ElevenLabs API key not configured' });
        }

        const path = req.path.replace('/api/elevenlabs', '/v1');
        const url = `https://api.elevenlabs.io${path}`;

        const headers = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...req.headers
        };

        delete headers.host;

        try {
          const response = await axios({
            method: req.method,
            url: url,
            headers,
            data: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
            responseType: 'arraybuffer'
          });

          res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': response.data.length.toString()
          });
          res.send(response.data);
        } catch (error) {
          res.status(500).json({ error: 'Internal server error' });
        }
      });
      
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
    
    test('should handle voices list', async () => {
      axios.mockResolvedValue({
        status: 200,
        data: {
          voices: [
            {
              voice_id: 'test-voice-1',
              name: 'Test Voice 1',
              category: 'premade',
              description: 'A test voice',
              labels: {
                gender: 'male',
                age: 'young'
              }
            },
            {
              voice_id: 'test-voice-2',
              name: 'Test Voice 2',
              category: 'premade',
              description: 'Another test voice',
              labels: {
                gender: 'female',
                age: 'middle'
              }
            }
          ]
        }
      });
      
      app.use('/api/elevenlabs', async (req, res) => {
        const response = await axios({
          method: req.method,
          url: `https://api.elevenlabs.io${req.path.replace('/api/elevenlabs', '/v1')}`,
          headers: {
            'Authorization': `Bearer ${process.env.ELEVENLABS_API_KEY || 'test-key'}`,
            'Content-Type': 'application/json'
          }
        });
        
        res.status(response.status).json(response.data);
      });
      
      const response = await request(app)
        .get('/api/elevenlabs/v1/voices')
        .expect(200);
      
      expect(response.body.voices).toBeInstanceOf(Array);
      expect(response.body.voices.length).toBeGreaterThan(0);
      expect(response.body.voices[0]).toMatchObject({
        voice_id: expect.any(String),
        name: expect.any(String),
        category: expect.any(String)
      });
    });
    
    test('should handle voice settings', async () => {
      axios.mockResolvedValue({
        status: 200,
        data: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      });
      
      app.use('/api/elevenlabs', async (req, res) => {
        const response = await axios({
          method: req.method,
          url: `https://api.elevenlabs.io${req.path.replace('/api/elevenlabs', '/v1')}`,
          headers: {
            'Authorization': `Bearer ${process.env.ELEVENLABS_API_KEY || 'test-key'}`,
            'Content-Type': 'application/json'
          }
        });
        
        res.status(response.status).json(response.data);
      });
      
      const response = await request(app)
        .get('/api/elevenlabs/v1/voices/test-voice-id/settings')
        .expect(200);
      
      expect(response.body).toMatchObject({
        stability: expect.any(Number),
        similarity_boost: expect.any(Number)
      });
    });
  });
  
  describe('Error Handling in API Endpoints', () => {
    test('should handle OpenAI API errors', async () => {
      axios.mockRejectedValue({
        response: {
          status: 401,
          data: {
            error: {
              message: 'Invalid API key',
              type: 'invalid_request_error'
            }
          }
        }
      });
      
      app.use('/api/openai', async (req, res) => {
        try {
          const response = await axios({
            method: req.method,
            url: `https://api.openai.com${req.path.replace('/api/openai', '')}`,
            headers: {
              'Authorization': `Bearer invalid-key`,
              'Content-Type': 'application/json'
            }
          });
          
          res.status(response.status).json(response.data);
        } catch (error) {
          if (error.response) {
            res.status(error.response.status).json(error.response.data);
          } else {
            res.status(500).json({ error: 'Internal server error' });
          }
        }
      });
      
      const response = await request(app)
        .post('/api/openai/v1/chat/completions')
        .send({ model: 'gpt-4o-mini', messages: [] })
        .expect(401);
      
      expect(response.body.error.message).toBe('Invalid API key');
    });
    
    test('should handle ElevenLabs API errors', async () => {
      axios.mockRejectedValue({
        response: {
          status: 400,
          data: {
            detail: {
              status: 'invalid_voice_id',
              message: 'The voice_id provided is invalid'
            }
          }
        }
      });
      
      app.use('/api/elevenlabs', async (req, res) => {
        try {
          const response = await axios({
            method: req.method,
            url: `https://api.elevenlabs.io${req.path.replace('/api/elevenlabs', '/v1')}`,
            headers: {
              'Authorization': `Bearer test-key`,
              'Content-Type': 'application/json'
            }
          });
          
          res.status(response.status).json(response.data);
        } catch (error) {
          if (error.response) {
            res.status(error.response.status).json(error.response.data);
          } else {
            res.status(500).json({ error: 'Internal server error' });
          }
        }
      });
      
      const response = await request(app)
        .post('/api/elevenlabs/v1/text-to-speech/invalid-voice-id')
        .send({ text: 'test' })
        .expect(400);
      
      expect(response.body.detail.status).toBe('invalid_voice_id');
    });
    
    test('should handle network errors', async () => {
      axios.mockRejectedValue(new Error('Network error'));
      
      app.use('/api/openai', async (req, res) => {
        try {
          const response = await axios({
            method: req.method,
            url: `https://api.openai.com${req.path.replace('/api/openai', '')}`,
            headers: {
              'Authorization': `Bearer test-key`,
              'Content-Type': 'application/json'
            }
          });
          
          res.status(response.status).json(response.data);
        } catch (error) {
          if (error.response) {
            res.status(error.response.status).json(error.response.data);
          } else {
            res.status(500).json({ error: 'Internal server error' });
          }
        }
      });
      
      const response = await request(app)
        .post('/api/openai/v1/chat/completions')
        .send({ model: 'gpt-4o-mini', messages: [] })
        .expect(500);
      
      expect(response.body.error).toBe('Internal server error');
    });
  });
  
  describe('Request Validation', () => {
    test('should validate required fields for OpenAI requests', async () => {
      app.use('/api/openai', async (req, res) => {
        if (req.method === 'POST' && req.path.includes('/chat/completions')) {
          if (!req.body.model || !req.body.messages) {
            return res.status(400).json({ 
              error: 'Missing required fields: model and messages' 
            });
          }
        }
        
        res.json({ success: true });
      });
      
      // Запрос без обязательных полей
      await request(app)
        .post('/api/openai/v1/chat/completions')
        .send({})
        .expect(400);
      
      // Запрос с обязательными полями
      await request(app)
        .post('/api/openai/v1/chat/completions')
        .send({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'test' }]
        })
        .expect(200);
    });
    
    test('should validate required fields for ElevenLabs requests', async () => {
      app.use('/api/elevenlabs', async (req, res) => {
        if (req.method === 'POST' && req.path.includes('/text-to-speech/')) {
          if (!req.body.text) {
            return res.status(400).json({ 
              error: 'Missing required field: text' 
            });
          }
        }
        
        res.json({ success: true });
      });
      
      // Запрос без обязательных полей
      await request(app)
        .post('/api/elevenlabs/v1/text-to-speech/test-voice-id')
        .send({})
        .expect(400);
      
      // Запрос с обязательными полями
      await request(app)
        .post('/api/elevenlabs/v1/text-to-speech/test-voice-id')
        .send({ text: 'test text' })
        .expect(200);
    });
  });
});
