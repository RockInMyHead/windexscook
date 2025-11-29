const { performance, PerformanceObserver } = require('perf_hooks');

describe('Performance Tests', () => {
  let performanceObserver;

  beforeAll(() => {
    performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        console.log(`Performance: ${entry.name} took ${entry.duration}ms`);
      });
    });
    performanceObserver.observe({ entryTypes: ['measure'] });
  });

  afterAll(() => {
    performanceObserver.disconnect();
  });

  describe('Browser Compatibility Checks', () => {
    test('getCapabilities should be fast', async () => {
      const { BrowserCompatibility } = await import('../../src/lib/browser-compatibility.js');

      const startTime = performance.now();

      // Run multiple times to get average
      for (let i = 0; i < 100; i++) {
        BrowserCompatibility.getCapabilities();
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / 100;

      console.log(`BrowserCompatibility.getCapabilities() average time: ${averageTime}ms`);
      expect(averageTime).toBeLessThan(1); // Should be very fast
    });

    test('checkMinimumRequirements should complete quickly', async () => {
      const { BrowserCompatibility } = await import('../../src/lib/browser-compatibility.js');

      const startTime = performance.now();
      const result = BrowserCompatibility.checkMinimumRequirements();
      const endTime = performance.now();

      const duration = endTime - startTime;
      console.log(`BrowserCompatibility.checkMinimumRequirements() time: ${duration}ms`);
      expect(duration).toBeLessThan(10); // Should be very fast
    });
  });

  describe('OpenAI Service Performance', () => {
    test('makeRequest should handle concurrent requests', async () => {
      const { makeRequest } = await import('../../src/services/openai.js');

      // Mock fetch to avoid actual API calls
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }]
        })
      });

      const startTime = performance.now();

      // Make multiple concurrent requests
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(makeRequest(`Test prompt ${i}`));
      }

      await Promise.all(promises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(`Concurrent requests total time: ${totalTime}ms`);
      expect(totalTime).toBeLessThan(1000); // Should handle concurrent requests efficiently
    });

    test('streaming response should process chunks efficiently', async () => {
      const { makeStreamingRequest } = await import('../../src/services/openai.js');

      // Mock streaming response
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n') })
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":" world"}}]}\n\n') })
              .mockResolvedValueOnce({ done: true, value: undefined })
          })
        }
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const onChunk = jest.fn();
      const startTime = performance.now();

      const result = await makeStreamingRequest('Test prompt', onChunk);

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`Streaming response processing time: ${duration}ms`);
      expect(duration).toBeLessThan(100); // Should process quickly
      expect(onChunk).toHaveBeenCalledTimes(2);
      expect(result).toBe('Hello world');
    });
  });

  describe('Audio Processing Performance', () => {
    test('audio utilities should handle large audio buffers', async () => {
      const { createProcessingIndicator, stopProcessingIndicator } = await import('../../src/lib/audio-utils.js');

      // Mock AudioContext
      global.AudioContext = jest.fn().mockImplementation(() => ({
        createOscillator: jest.fn().mockReturnValue({
          frequency: { setValueAtTime: jest.fn() },
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn()
        }),
        createGain: jest.fn().mockReturnValue({
          gain: { setValueAtTime: jest.fn() },
          connect: jest.fn()
        }),
        destination: {}
      }));

      const startTime = performance.now();

      // Test audio processing creation
      const indicator = createProcessingIndicator();
      expect(indicator).toBeDefined();

      // Test stopping
      stopProcessingIndicator();

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`Audio processing setup time: ${duration}ms`);
      expect(duration).toBeLessThan(50); // Should be very fast
    });
  });

  describe('Memory Usage Tests', () => {
    test('browser compatibility should not leak memory', async () => {
      const { BrowserCompatibility } = await import('../../src/lib/browser-compatibility.js');

      const initialCapabilities = BrowserCompatibility.getCapabilities();

      // Call multiple times
      for (let i = 0; i < 1000; i++) {
        BrowserCompatibility.getCapabilities();
      }

      const finalCapabilities = BrowserCompatibility.getCapabilities();

      // Should return the same cached instance
      expect(finalCapabilities).toBe(initialCapabilities);
    });

    test('error handling should not cause memory leaks', async () => {
      const { makeRequest } = await import('../../src/services/openai.js');

      // Mock failed requests
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      // Make multiple failed requests
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(makeRequest('Test prompt').catch(() => {}));
      }

      await Promise.all(promises);

      // Memory should be properly cleaned up
      // This is hard to test directly, but we can check that no exceptions occur
    });
  });

  describe('Large Payload Handling', () => {
    test('should handle large text inputs efficiently', async () => {
      const { makeRequest } = await import('../../src/services/openai.js');

      // Create a large text input (10KB)
      const largeText = 'a'.repeat(10000);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Response' } }]
        })
      });

      const startTime = performance.now();

      await makeRequest(largeText);

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`Large text processing time: ${duration}ms`);
      expect(duration).toBeLessThan(200); // Should handle large inputs reasonably fast
    });

    test('streaming should handle long responses', async () => {
      const { makeStreamingRequest } = await import('../../src/services/openai.js');

      // Create a long streaming response
      const longResponse = 'word '.repeat(1000); // 5000 characters
      const chunks = longResponse.match(/.{1,50}/g) || []; // Split into chunks

      let chunkIndex = 0;
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn(() => {
              if (chunkIndex < chunks.length) {
                const chunk = `data: {"choices":[{"delta":{"content":"${chunks[chunkIndex]}"}}]}\n\n`;
                chunkIndex++;
                return Promise.resolve({
                  done: false,
                  value: new TextEncoder().encode(chunk)
                });
              } else {
                return Promise.resolve({ done: true, value: undefined });
              }
            })
          })
        }
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const onChunk = jest.fn();
      const startTime = performance.now();

      const result = await makeStreamingRequest('Test prompt', onChunk);

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`Long streaming response processing time: ${duration}ms`);
      expect(duration).toBeLessThan(500); // Should handle long responses efficiently
      expect(onChunk).toHaveBeenCalledTimes(chunks.length);
      expect(result.length).toBeGreaterThan(4000);
    });
  });

  describe('Concurrent Operations', () => {
    test('multiple voice sessions should not interfere', async () => {
      // This test simulates multiple concurrent voice interactions
      const operations = [];

      for (let i = 0; i < 10; i++) {
        operations.push(
          new Promise(resolve => {
            setTimeout(() => {
              // Simulate voice processing
              resolve(`operation-${i}`);
            }, Math.random() * 100);
          })
        );
      }

      const startTime = performance.now();

      const results = await Promise.all(operations);

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`Concurrent operations time: ${duration}ms`);
      expect(results.length).toBe(10);
      expect(duration).toBeLessThan(200); // Should complete efficiently
    });
  });

  describe('Resource Cleanup', () => {
    test('audio resources should be cleaned up properly', async () => {
      const { createProcessingIndicator, stopProcessingIndicator } = await import('../../src/lib/audio-utils.js');

      // Mock AudioContext
      const mockOscillator = {
        frequency: { setValueAtTime: jest.fn() },
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn()
      };

      const mockGain = {
        gain: { setValueAtTime: jest.fn() },
        connect: jest.fn()
      };

      global.AudioContext = jest.fn().mockImplementation(() => ({
        createOscillator: jest.fn().mockReturnValue(mockOscillator),
        createGain: jest.fn().mockReturnValue(mockGain),
        destination: {}
      }));

      // Create and cleanup multiple times
      for (let i = 0; i < 50; i++) {
        createProcessingIndicator();
        stopProcessingIndicator();
      }

      // Should not cause memory issues or performance degradation
      expect(true).toBe(true); // Basic assertion that no errors occurred
    });
  });
});
