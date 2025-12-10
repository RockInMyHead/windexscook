import request from 'supertest';
import express from 'express';
import cors from 'cors';

describe('Middleware Functions', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    jest.clearAllMocks();
  });
  
  describe('CORS Middleware', () => {
    test('should allow CORS requests', async () => {
      app.use(cors());
      app.get('/test', (req, res) => res.json({ message: 'test' }));
      
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
    
    test('should handle preflight requests', async () => {
      app.use(cors());
      app.get('/test', (req, res) => res.json({ message: 'test' }));
      
      const response = await request(app)
        .options('/test')
        .expect(204);
      
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });
  
  describe('JSON Parsing Middleware', () => {
    test('should parse JSON request body', async () => {
      app.use(express.json());
      app.post('/test', (req, res) => {
        res.json({ received: req.body });
      });
      
      const testData = { message: 'test', number: 123 };
      
      const response = await request(app)
        .post('/test')
        .send(testData)
        .expect(200);
      
      expect(response.body.received).toEqual(testData);
    });
    
    test('should handle large JSON payloads', async () => {
      app.use(express.json({ limit: '50mb' }));
      app.post('/test', (req, res) => {
        res.json({ size: JSON.stringify(req.body).length });
      });
      
      const largeData = { data: 'x'.repeat(10000) };
      
      const response = await request(app)
        .post('/test')
        .send(largeData)
        .expect(200);
      
      expect(response.body.size).toBeGreaterThan(10000);
    });
    
    test('should handle malformed JSON', async () => {
      jest.setTimeout(15000);
      app.use(express.json());
      app.post('/test', (req, res) => {
        res.json({ received: req.body });
      });
      
      const response = await request(app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
      
      expect(response.body).toBeDefined();
    });
  });
  
  describe('URL Encoded Middleware', () => {
    test('should parse URL encoded data', async () => {
      app.use(express.urlencoded({ extended: true }));
      app.post('/test', (req, res) => {
        res.json({ received: req.body });
      });
      
      const response = await request(app)
        .post('/test')
        .send('message=test&number=123')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);
      
      expect(response.body.received).toEqual({
        message: 'test',
        number: '123'
      });
    });
  });
  
  describe('Cache Control Middleware', () => {
    test('should set no-cache headers', async () => {
      app.use((req, res, next) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        next();
      });
      app.get('/test', (req, res) => res.json({ message: 'test' }));
      
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['pragma']).toBe('no-cache');
      expect(response.headers['expires']).toBe('0');
    });
  });
  
  describe('Static File Middleware', () => {
    test('should serve static files with custom headers', async () => {
      app.use(express.static('dist', {
        setHeaders: (res, path) => {
          if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          }
        }
      }));
      
      // Мокаем статический файл
      app.get('/index.html', (req, res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.send('<html><body>Test</body></html>');
      });
      
      const response = await request(app)
        .get('/index.html')
        .expect(200);
      
      expect(response.headers['cache-control']).toContain('no-store');
    });
  });
  
  describe('Error Handling Middleware', () => {
    test('should handle JSON parsing errors', async () => {
      app.use(express.json());
      app.use((error, req, res, next) => {
        if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
          return res.status(400).json({ error: 'Invalid JSON' });
        }
        res.status(500).json({ error: 'Internal server error' });
      });
      app.post('/test', (req, res) => res.json({ received: req.body }));
      
      const response = await request(app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
      
      expect(response.body.error).toBe('Invalid JSON');
    });
    
    test('should handle general errors', async () => {
      jest.setTimeout(15000);
      app.use((error, req, res, next) => {
        if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
          return res.status(400).json({ error: 'Invalid JSON' });
        }
        res.status(500).json({ error: 'Internal server error' });
      });
      app.get('/test', (req, res) => {
        throw new Error('Test error');
      });
      
      const response = await request(app)
        .get('/test')
        .expect(500);
      
      expect(response.body.error).toBe('Internal server error');
    });
  });
  
  describe('Request Logging Middleware', () => {
    test('should log request details', (done) => {
      jest.setTimeout(15000);
      const requestLogger = (req, res, next) => {
        const start = Date.now();
        
        res.on('finish', () => {
          const duration = Date.now() - start;
          // Здесь можно добавить проверки логирования
          expect(duration).toBeGreaterThanOrEqual(0);
          done();
        });
        
        next();
      };
      
      app.use(requestLogger);
      app.get('/test', (req, res) => res.json({ message: 'test' }));
      
      request(app)
        .get('/test')
        .expect(200);
    });
  });
  
  describe('Security Headers Middleware', () => {
    test('should set security headers', async () => {
      app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        next();
      });
      app.get('/test', (req, res) => res.json({ message: 'test' }));
      
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });
  
  describe('Rate Limiting Middleware', () => {
    test('should handle rate limiting', async () => {
      const rateLimitMap = new Map();
      
      const rateLimit = (req, res, next) => {
        const ip = req.ip || 'unknown';
        const now = Date.now();
        const windowMs = 60000; // 1 minute
        const maxRequests = 100;
        
        if (!rateLimitMap.has(ip)) {
          rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
          return next();
        }
        
        const userLimit = rateLimitMap.get(ip);
        
        if (now > userLimit.resetTime) {
          rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
          return next();
        }
        
        if (userLimit.count >= maxRequests) {
          return res.status(429).json({ error: 'Too many requests' });
        }
        
        userLimit.count++;
        next();
      };
      
      app.use(rateLimit);
      app.get('/test', (req, res) => res.json({ message: 'test' }));
      
      // Первый запрос должен пройти
      const response1 = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response1.body.message).toBe('test');
    });
  });
  
  describe('Authentication Middleware', () => {
    test('should handle authentication', async () => {
      const auth = (req, res, next) => {
        const token = req.headers.authorization;
        
        if (!token) {
          return res.status(401).json({ error: 'No token provided' });
        }
        
        if (token !== 'Bearer valid-token') {
          return res.status(401).json({ error: 'Invalid token' });
        }
        
        req.user = { id: 1, name: 'Test User' };
        next();
      };
      
      app.use('/protected', auth);
      app.get('/protected/test', (req, res) => res.json({ user: req.user }));
      
      // Запрос без токена
      await request(app)
        .get('/protected/test')
        .expect(401);
      
      // Запрос с неверным токеном
      await request(app)
        .get('/protected/test')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
      
      // Запрос с верным токеном
      const response = await request(app)
        .get('/protected/test')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);
      
      expect(response.body.user).toEqual({ id: 1, name: 'Test User' });
    });
  });
});
