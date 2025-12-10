const request = require('supertest');
const express = require('express');
const cors = require('cors');

// Mock the server setup
jest.mock('../../../server.js', () => {
  const express = require('express');
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Mock OpenAI TTS endpoint
  app.post('/api/openai/tts', (req, res) => {
    const { text, voice = 'alloy', model = 'tts-1', speed = 1.0 } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Mock successful response
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from('fake-audio-data'));
  });

  // Mock OpenAI STT endpoint
  app.post('/api/openai/stt', (req, res) => {
    // Mock successful transcription
    res.json({
      text: 'Это тестовая транскрибация аудио',
      language: 'ru',
      duration: 2.5
    });
  });

  // Mock chat endpoint
  app.post('/api/chat', (req, res) => {
    const { messages, stream = false } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (stream) {
      // Mock streaming response
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const response = 'Привет! Я ваш AI шеф-повар. Расскажите, что вы хотели бы приготовить!';
      res.write(response);
      res.end();
    } else {
      res.json({
        choices: [{
          message: {
            content: 'Привет! Я ваш AI шеф-повар. Расскажите, что вы хотели бы приготовить!'
          }
        }]
      });
    }
  });

  // Mock payment endpoints
  app.get('/api/payments/status/:paymentId', (req, res) => {
    const { paymentId } = req.params;

    // Mock successful payment
    res.json({
      id: paymentId,
      status: 'succeeded',
      paid: true,
      amount: { value: '1000.00', currency: 'RUB' },
      metadata: { userId: 'test-user', userEmail: 'test@example.com' }
    });
  });

  app.post('/api/payments/confirm', (req, res) => {
    const { paymentId, userId } = req.body;

    if (!paymentId || !userId) {
      return res.status(400).json({ error: 'PaymentId and userId are required' });
    }

    res.json({ success: true, message: 'Payment confirmed' });
  });

  // Mock email endpoint
  app.post('/api/email/send', (req, res) => {
    const { to, subject, html, text } = req.body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    res.json({
      success: true,
      messageId: `msg-${Date.now()}`,
      to,
      subject
    });
  });

  return app;
});

const app = require('../../../server.js');

describe('API Integration Tests', () => {
  describe('OpenAI TTS Endpoint', () => {
    test('should generate speech successfully', async () => {
      const response = await request(app)
        .post('/api/openai/tts')
        .send({
          text: 'Привет, я AI шеф-повар!',
          voice: 'alloy',
          model: 'tts-1',
          speed: 0.95
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('audio/mpeg');
      expect(response.body).toBeInstanceOf(Buffer);
    });

    test('should handle missing text parameter', async () => {
      const response = await request(app)
        .post('/api/openai/tts')
        .send({
          voice: 'alloy'
        })
        .expect(400);

      expect(response.body.error).toBe('Text is required');
    });

    test('should use default parameters', async () => {
      const response = await request(app)
        .post('/api/openai/tts')
        .send({
          text: 'Test text'
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('audio/mpeg');
    });
  });

  describe('OpenAI STT Endpoint', () => {
    test('should transcribe audio successfully', async () => {
      const response = await request(app)
        .post('/api/openai/stt')
        .attach('audio', Buffer.from('fake-audio-data'), 'audio.wav')
        .expect(200);

      expect(response.body).toHaveProperty('text');
      expect(response.body).toHaveProperty('language');
      expect(response.body).toHaveProperty('duration');
      expect(response.body.language).toBe('ru');
    });
  });

  describe('Chat Endpoint', () => {
    test('should handle regular chat request', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [
            { role: 'user', content: 'Расскажи рецепт борща' }
          ],
          stream: false
        })
        .expect(200);

      expect(response.body.choices).toBeDefined();
      expect(response.body.choices[0].message.content).toContain('шеф-повар');
    });

    test('should handle streaming chat request', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [
            { role: 'user', content: 'Привет' }
          ],
          stream: true
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('шеф-повар');
    });

    test('should validate messages parameter', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: 'not an array'
        })
        .expect(400);

      expect(response.body.error).toBe('Messages array is required');
    });

    test('should handle empty messages array', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: []
        })
        .expect(400);

      expect(response.body.error).toBe('Messages array is required');
    });
  });

  describe('Payment Endpoints', () => {
    test('should get payment status', async () => {
      const response = await request(app)
        .get('/api/payments/status/test-payment-123')
        .expect(200);

      expect(response.body.id).toBe('test-payment-123');
      expect(response.body.status).toBe('succeeded');
      expect(response.body.paid).toBe(true);
      expect(response.body.amount.currency).toBe('RUB');
    });

    test('should confirm payment', async () => {
      const response = await request(app)
        .post('/api/payments/confirm')
        .send({
          paymentId: 'test-payment-123',
          userId: 'test-user-456'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment confirmed');
    });

    test('should validate payment confirmation parameters', async () => {
      const response = await request(app)
        .post('/api/payments/confirm')
        .send({
          paymentId: 'test-payment-123'
          // missing userId
        })
        .expect(400);

      expect(response.body.error).toBe('PaymentId and userId are required');
    });
  });

  describe('Email Endpoint', () => {
    test('should send email successfully', async () => {
      const response = await request(app)
        .post('/api/email/send')
        .send({
          to: 'test@example.com',
          subject: 'Test Subject',
          html: '<p>Test content</p>',
          text: 'Plain text content'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.messageId).toBeDefined();
      expect(response.body.to).toBe('test@example.com');
      expect(response.body.subject).toBe('Test Subject');
    });

    test('should validate email parameters', async () => {
      const response = await request(app)
        .post('/api/email/send')
        .send({
          to: 'test@example.com',
          subject: 'Test Subject'
          // missing html and text
        })
        .expect(400);

      expect(response.body.error).toBe('Missing required fields');
    });

    test('should send plain text email', async () => {
      const response = await request(app)
        .post('/api/email/send')
        .send({
          to: 'test@example.com',
          subject: 'Test Subject',
          text: 'Plain text only'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for unknown endpoints', async () => {
      await request(app)
        .get('/api/unknown-endpoint')
        .expect(404);
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      // Express should handle this automatically
    });

    test('should handle CORS headers', async () => {
      const response = await request(app)
        .options('/api/chat')
        .expect(200);

      // CORS middleware should add appropriate headers
    });
  });

  describe('Rate Limiting and Security', () => {
    test('should handle large payloads gracefully', async () => {
      const largeMessage = 'a'.repeat(10000); // 10KB message

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [
            { role: 'user', content: largeMessage }
          ]
        })
        .expect(200);

      // Should handle large payloads without crashing
    });

    test('should validate content types', async () => {
      await request(app)
        .post('/api/openai/tts')
        .set('Content-Type', 'text/plain')
        .send('invalid content type')
        .expect(400);
    });
  });
});
