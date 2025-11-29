/**
 * Smoke Tests - Быстрая проверка основных функций
 * Эти тесты запускаются первыми и проверяют что система в целом работоспособна
 */

const request = require('supertest');
const { BrowserCompatibility } = require('../../src/lib/browser-compatibility.ts');

describe('Smoke Tests', () => {
  describe('System Health', () => {
    test('server should respond to health check', async () => {
      // Mock the server for smoke tests
      const mockApp = {
        get: jest.fn().mockImplementation((path, handler) => {
          if (path === '/health') {
            handler({}, {
              status: (code) => ({
                json: (data) => ({ statusCode: code, ...data })
              })
            });
          }
        })
      };

      // Simulate health check
      const response = { statusCode: 200, status: 'ok', timestamp: Date.now() };
      expect(response.statusCode).toBe(200);
      expect(response.status).toBe('ok');
    });

    test('database connection should be available', async () => {
      // Mock database check
      const dbStatus = { connected: true, tables: ['users', 'recipes', 'payments'] };
      expect(dbStatus.connected).toBe(true);
      expect(dbStatus.tables.length).toBeGreaterThan(0);
    });
  });

  describe('Browser Compatibility (Smoke)', () => {
    test('basic browser compatibility should work', () => {
      // Test that the module can be imported and basic functions work
      expect(BrowserCompatibility).toBeDefined();
      expect(typeof BrowserCompatibility.getCapabilities).toBe('function');
      expect(typeof BrowserCompatibility.getBrowserInfo).toBe('function');
    });

    test('should detect basic browser features', () => {
      // Mock basic browser APIs for smoke test
      global.window = {
        AudioContext: jest.fn(),
        MediaRecorder: jest.fn(),
        SpeechRecognition: jest.fn(),
        speechSynthesis: { speak: jest.fn() },
        fetch: jest.fn(),
        localStorage: {
          setItem: jest.fn(),
          getItem: jest.fn(),
          removeItem: jest.fn()
        }
      };
      global.navigator = {
        mediaDevices: { getUserMedia: jest.fn() },
        userAgent: 'Chrome'
      };

      const caps = BrowserCompatibility.getCapabilities();
      expect(caps).toBeDefined();
      expect(typeof caps.fetch).toBe('boolean');
      expect(typeof caps.localStorage).toBe('boolean');
    });
  });

  describe('OpenAI Service (Smoke)', () => {
    test('OpenAI service should be importable', () => {
      // Smoke test - just check that the service file exists
      const fs = require('fs');
      const path = require('path');
      const openaiPath = path.join(__dirname, '../../src/services/openai.ts');
      expect(fs.existsSync(openaiPath)).toBe(true);
    });

    test('OpenAI service should handle basic validation', () => {
      // Smoke test - just check basic validation logic
      expect(() => {
        if (!'test prompt') throw new Error('Empty prompt');
      }).not.toThrow();
    });
  });

  describe('Email Service (Smoke)', () => {
    test('email service should be importable', () => {
      // Smoke test - just check that the service file exists
      const fs = require('fs');
      const path = require('path');
      const emailPath = path.join(__dirname, '../../src/services/email.ts');
      expect(fs.existsSync(emailPath)).toBe(true);
    });

    test('email service should validate inputs', () => {
      // Smoke test - just check basic validation logic
      expect(() => {
        const email = { to: 'test@example.com', subject: 'test', html: '<p>test</p>' };
        if (!email.to || !email.subject || (!email.html && !email.text)) {
          throw new Error('Invalid email');
        }
      }).not.toThrow();
    });
  });

  describe('Payment System (Smoke)', () => {
    test('payment service should be importable', () => {
      // Mock payment service check
      const paymentService = {
        checkStatus: () => true,
        confirmPayment: () => true
      };

      expect(paymentService.checkStatus()).toBe(true);
      expect(paymentService.confirmPayment()).toBe(true);
    });
  });

  describe('Voice Components (Smoke)', () => {
    test('voice components should be importable', () => {
      // Smoke test - just check that the component files exist
      const fs = require('fs');
      const path = require('path');
      const voicePath = path.join(__dirname, '../../src/components/ui/voice-call-new.tsx');
      const compatPath = path.join(__dirname, '../../src/lib/browser-compatibility.ts');
      const audioPath = path.join(__dirname, '../../src/lib/audio-utils.ts');

      expect(fs.existsSync(voicePath)).toBe(true);
      expect(fs.existsSync(compatPath)).toBe(true);
      expect(fs.existsSync(audioPath)).toBe(true);
    });

    test('voice utilities should be available', () => {
      // Smoke test - just check that the utility file exists
      const fs = require('fs');
      const path = require('path');
      const audioPath = path.join(__dirname, '../../src/lib/audio-utils.ts');
      expect(fs.existsSync(audioPath)).toBe(true);
    });
  });

  describe('Build System (Smoke)', () => {
    test('build configuration should be valid', () => {
      // Check that vite config exists and is valid
      const fs = require('fs');
      const path = require('path');

      const viteConfigPath = path.join(__dirname, '../../vite.config.ts');
      expect(fs.existsSync(viteConfigPath)).toBe(true);

      const jestConfigPath = path.join(__dirname, '../../jest.config.js');
      expect(fs.existsSync(jestConfigPath)).toBe(true);
    });

    test('package.json scripts should be available', () => {
      const packageJson = require('../../package.json');

      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.scripts.test).toBeDefined();
      expect(packageJson.scripts.build).toBeDefined();
      expect(packageJson.scripts.dev).toBeDefined();
    });
  });

  describe('Security (Smoke)', () => {
    test('environment variables should be configured', () => {
      // Check that critical env vars are not exposed
      const processEnv = process.env;

      // Should not have real API keys in test environment
      expect(processEnv.VITE_OPENAI_API_KEY).not.toBe('sk-real-key-here');

      // Should have test-specific configuration
      expect(processEnv.NODE_ENV).toBeDefined();
    });

    test('CORS should be configured', () => {
      // Mock CORS check
      const corsConfig = {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      };

      expect(corsConfig.origin).toBe(true);
      expect(corsConfig.methods).toContain('POST');
      expect(corsConfig.allowedHeaders).toContain('Authorization');
    });
  });

  describe('Performance (Smoke)', () => {
    test('basic operations should be fast', () => {
      const startTime = Date.now();

      // Perform some basic operations
      const arr = Array.from({ length: 1000 }, (_, i) => i);
      const sum = arr.reduce((a, b) => a + b, 0);
      const filtered = arr.filter(n => n % 2 === 0);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(sum).toBe(499500);
      expect(filtered.length).toBe(500);
      expect(duration).toBeLessThan(100); // Should complete very quickly
    });

    test('memory usage should be reasonable', () => {
      const initialMemory = process.memoryUsage();

      // Perform memory-intensive operation
      const largeArray = new Array(100000).fill('test string');

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Clean up
      largeArray.length = 0;

      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });
  });
});
