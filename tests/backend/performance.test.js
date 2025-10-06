import request from 'supertest';
import express from 'express';
import cors from 'cors';

// Мокаем внешние зависимости
jest.mock('axios');
jest.mock('https-proxy-agent', () => ({
  HttpsProxyAgent: jest.fn(() => ({})),
}));

import axios from 'axios';

describe('Performance and Load Testing', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(cors());
    app.use(express.json());
    jest.clearAllMocks();
  });
  
  describe('Concurrent Request Handling', () => {
    test('should handle multiple simultaneous health checks', async () => {
      app.get('/health', (req, res) => {
        res.json({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          uptime: process.uptime()
        });
      });
      
      const concurrentRequests = 10;
      const requests = Array(concurrentRequests).fill().map(() => 
        request(app).get('/health')
      );
      
      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      // Все запросы должны быть успешными
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
      
      // Проверяем, что все запросы обработаны за разумное время
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(5000); // 5 секунд
      
      console.log(`Обработано ${concurrentRequests} одновременных запросов за ${totalTime}ms`);
    });
    
    test('should handle mixed concurrent API requests', async () => {
      // Мокаем успешные ответы
      axios.mockResolvedValue({
        status: 200,
        data: {
          id: 'test',
          choices: [{ message: { content: 'test response' } }]
        }
      });
      
      app.use('/api/openai', async (req, res) => {
        res.json({
          id: 'test',
          choices: [{ message: { content: 'test response' } }]
        });
      });
      
      app.use('/api/elevenlabs', async (req, res) => {
        if (req.path.includes('/text-to-speech/')) {
          res.set('Content-Type', 'audio/mpeg');
          res.send(Buffer.from('fake audio'));
        } else {
          res.json({ voices: [] });
        }
      });
      
      const requests = [
        request(app).get('/health'),
        request(app).post('/api/openai/v1/chat/completions').send({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'test' }]
        }),
        request(app).get('/api/elevenlabs/v1/voices'),
        request(app).post('/api/elevenlabs/v1/text-to-speech/test').send({
          text: 'test'
        }),
        request(app).get('/health'),
        request(app).post('/api/openai/v1/chat/completions').send({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'test2' }]
        })
      ];
      
      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(10000); // 10 секунд
      
      console.log(`Обработано ${requests.length} смешанных запросов за ${totalTime}ms`);
    });
  });
  
  describe('Memory Usage', () => {
    test('should handle large payloads without memory issues', async () => {
      app.post('/test-large', (req, res) => {
        const payloadSize = JSON.stringify(req.body).length;
        res.json({ 
          receivedSize: payloadSize,
          memoryUsage: process.memoryUsage()
        });
      });
      
      // Создаем большой payload
      const largeData = {
        text: 'x'.repeat(100000), // 100KB текста
        array: Array(1000).fill('test data'),
        nested: {
          level1: {
            level2: {
              level3: Array(100).fill('nested data')
            }
          }
        }
      };
      
      const response = await request(app)
        .post('/test-large')
        .send(largeData)
        .expect(200);
      
      expect(response.body.receivedSize).toBeGreaterThan(100000);
      expect(response.body.memoryUsage).toBeDefined();
      expect(response.body.memoryUsage.heapUsed).toBeDefined();
    });
    
    test('should handle multiple large requests', async () => {
      app.post('/test-memory', (req, res) => {
        const memoryBefore = process.memoryUsage();
        
        // Симулируем обработку данных
        const processed = JSON.stringify(req.body).toUpperCase();
        
        const memoryAfter = process.memoryUsage();
        
        res.json({
          processedSize: processed.length,
          memoryBefore,
          memoryAfter,
          memoryDiff: memoryAfter.heapUsed - memoryBefore.heapUsed
        });
      });
      
      const largeRequests = Array(5).fill().map((_, index) => {
        const largeData = {
          id: index,
          content: 'x'.repeat(50000),
          metadata: Array(100).fill(`item-${index}`)
        };
        
        return request(app)
          .post('/test-memory')
          .send(largeData);
      });
      
      const responses = await Promise.all(largeRequests);
      
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.processedSize).toBeGreaterThan(50000);
        expect(response.body.memoryDiff).toBeDefined();
      });
    });
  });
  
  describe('Response Time Analysis', () => {
    test('should measure response times for different endpoints', async () => {
      app.get('/fast', (req, res) => {
        res.json({ message: 'fast response' });
      });
      
      app.get('/medium', (req, res) => {
        // Симулируем среднюю обработку
        setTimeout(() => {
          res.json({ message: 'medium response' });
        }, 50);
      });
      
      app.get('/slow', (req, res) => {
        // Симулируем медленную обработку
        setTimeout(() => {
          res.json({ message: 'slow response' });
        }, 200);
      });
      
      const endpoints = [
        { path: '/fast', expectedMaxTime: 100 },
        { path: '/medium', expectedMaxTime: 200 },
        { path: '/slow', expectedMaxTime: 500 }
      ];
      
      for (const endpoint of endpoints) {
        const startTime = Date.now();
        const response = await request(app)
          .get(endpoint.path)
          .expect(200);
        const endTime = Date.now();
        
        const responseTime = endTime - startTime;
        expect(responseTime).toBeLessThan(endpoint.expectedMaxTime);
        
        console.log(`${endpoint.path}: ${responseTime}ms`);
      }
    });
    
    test('should handle timeout scenarios', async () => {
      app.get('/timeout-test', (req, res) => {
        // Симулируем очень долгую обработку
        setTimeout(() => {
          res.json({ message: 'delayed response' });
        }, 1000);
      });
      
      const startTime = Date.now();
      
      try {
        await request(app)
          .get('/timeout-test')
          .timeout(500) // 500ms timeout
          .expect(200);
      } catch (error) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Проверяем, что timeout сработал примерно в ожидаемое время
        expect(responseTime).toBeLessThan(1000);
        expect(responseTime).toBeGreaterThan(400);
      }
    });
  });
  
  describe('Error Recovery', () => {
    test('should recover from temporary failures', async () => {
      let requestCount = 0;
      
      app.get('/unreliable', (req, res) => {
        requestCount++;
        
        // Первые 3 запроса возвращают ошибку, затем успех
        if (requestCount <= 3) {
          return res.status(500).json({ error: 'Temporary failure' });
        }
        
        res.json({ message: 'Success after retries', attempt: requestCount });
      });
      
      // Делаем несколько запросов для проверки восстановления
      const requests = Array(5).fill().map(() => 
        request(app).get('/unreliable')
      );
      
      const responses = await Promise.all(requests);
      
      // Проверяем, что некоторые запросы успешны
      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(0);
      
      // Проверяем, что некоторые запросы завершились ошибкой
      const failedResponses = responses.filter(r => r.status === 500);
      expect(failedResponses.length).toBeGreaterThan(0);
    });
    
    test('should handle partial failures gracefully', async () => {
      app.post('/batch-process', (req, res) => {
        const { items } = req.body;
        
        const results = items.map((item, index) => {
          // Симулируем, что каждый 3-й элемент обрабатывается с ошибкой
          if (index % 3 === 0) {
            return { id: item.id, status: 'error', message: 'Processing failed' };
          }
          return { id: item.id, status: 'success', processed: true };
        });
        
        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;
        
        res.json({
          results,
          summary: {
            total: items.length,
            successful: successCount,
            failed: errorCount
          }
        });
      });
      
      const batchData = {
        items: Array(10).fill().map((_, index) => ({
          id: `item-${index}`,
          data: `test-data-${index}`
        }))
      };
      
      const response = await request(app)
        .post('/batch-process')
        .send(batchData)
        .expect(200);
      
      expect(response.body.summary.total).toBe(10);
      expect(response.body.summary.successful).toBeGreaterThan(0);
      expect(response.body.summary.failed).toBeGreaterThan(0);
      expect(response.body.results).toHaveLength(10);
    });
  });
  
  describe('Resource Cleanup', () => {
    test('should clean up resources after requests', async () => {
      const activeConnections = new Set();
      
      app.get('/connection-test', (req, res) => {
        const connectionId = Math.random().toString(36);
        activeConnections.add(connectionId);
        
        res.json({ 
          connectionId,
          activeConnections: activeConnections.size
        });
        
        // Симулируем очистку ресурсов
        setTimeout(() => {
          activeConnections.delete(connectionId);
        }, 100);
      });
      
      const requests = Array(5).fill().map(() => 
        request(app).get('/connection-test')
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.connectionId).toBeDefined();
      });
      
      // Ждем очистки ресурсов
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Проверяем, что ресурсы очищены
      expect(activeConnections.size).toBe(0);
    });
  });
  
  describe('Scalability Tests', () => {
    test('should handle increasing load', async () => {
      app.get('/load-test', (req, res) => {
        const startTime = Date.now();
        
        // Симулируем обработку
        const result = Array(1000).fill().map((_, i) => i * 2);
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        res.json({
          processedItems: result.length,
          processingTime,
          timestamp: new Date().toISOString()
        });
      });
      
      const loadLevels = [1, 5, 10, 20];
      const results = [];
      
      for (const load of loadLevels) {
        const startTime = Date.now();
        
        const requests = Array(load).fill().map(() => 
          request(app).get('/load-test')
        );
        
        const responses = await Promise.all(requests);
        const endTime = Date.now();
        
        const totalTime = endTime - startTime;
        const avgTimePerRequest = totalTime / load;
        
        results.push({
          load,
          totalTime,
          avgTimePerRequest,
          successRate: responses.filter(r => r.status === 200).length / load
        });
        
        // Все запросы должны быть успешными
        responses.forEach(response => {
          expect(response.status).toBe(200);
        });
      }
      
      // Проверяем, что производительность не деградирует критически
      const firstResult = results[0];
      const lastResult = results[results.length - 1];
      
      // Время на запрос не должно увеличиваться более чем в 3 раза
      expect(lastResult.avgTimePerRequest).toBeLessThan(firstResult.avgTimePerRequest * 3);
      
      console.log('Load test results:', results);
    });
  });
});
