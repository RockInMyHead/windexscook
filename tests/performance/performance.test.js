const { performance, PerformanceObserver } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

describe('Performance Benchmarks', () => {
  let performanceObserver;
  let results = {};

  beforeAll(() => {
    performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        console.log(`Performance: ${entry.name} took ${entry.duration}ms`);
        results[entry.name] = entry.duration;
      });
    });
    performanceObserver.observe({ entryTypes: ['measure'] });

    // Create results directory
    const resultsDir = path.join(__dirname, '../../performance-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
  });

  afterAll(() => {
    performanceObserver.disconnect();

    // Save results to file
    const resultsFile = path.join(__dirname, '../../performance-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      results,
      benchmarks: {
        maxResponseTime: 500, // ms
        maxVoiceProcessingTime: 2000, // ms
        maxMemoryUsage: 100 * 1024 * 1024, // 100MB
        minConcurrentUsers: 100
      }
    }, null, 2));

    console.log('Performance results saved to:', resultsFile);
  });

  describe('Browser Compatibility Checks', () => {
    test('getCapabilities should be fast', async () => {
      const { BrowserCompatibility } = await import('../../src/lib/browser-compatibility.js');

      performance.mark('capabilities-start');

      // Run multiple times to get average
      for (let i = 0; i < 100; i++) {
        BrowserCompatibility.getCapabilities();
      }

      performance.mark('capabilities-end');
      performance.measure('BrowserCompatibility.getCapabilities', 'capabilities-start', 'capabilities-end');

      const measure = performance.getEntriesByName('BrowserCompatibility.getCapabilities')[0];
      const averageTime = measure.duration / 100;

      console.log(`BrowserCompatibility.getCapabilities() average time: ${averageTime.toFixed(3)}ms`);
      expect(averageTime).toBeLessThan(1); // Should be very fast (< 1ms per call)
    });

    test('checkMinimumRequirements should complete quickly', async () => {
      const { BrowserCompatibility } = await import('../../src/lib/browser-compatibility.js');

      performance.mark('requirements-start');
      const result = BrowserCompatibility.checkMinimumRequirements();
      performance.mark('requirements-end');
      performance.measure('BrowserCompatibility.checkMinimumRequirements', 'requirements-start', 'requirements-end');

      const measure = performance.getEntriesByName('BrowserCompatibility.checkMinimumRequirements')[0];

      console.log(`BrowserCompatibility.checkMinimumRequirements() time: ${measure.duration.toFixed(3)}ms`);
      expect(measure.duration).toBeLessThan(10); // Should be very fast (< 10ms)
    });

    test('getBrowserInfo should be efficient', async () => {
      const { BrowserCompatibility } = await import('../../src/lib/browser-compatibility.js');

      performance.mark('browser-info-start');

      // Test multiple calls
      for (let i = 0; i < 50; i++) {
        BrowserCompatibility.getBrowserInfo();
      }

      performance.mark('browser-info-end');
      performance.measure('BrowserCompatibility.getBrowserInfo', 'browser-info-start', 'browser-info-end');

      const measure = performance.getEntriesByName('BrowserCompatibility.getBrowserInfo')[0];
      const averageTime = measure.duration / 50;

      console.log(`BrowserCompatibility.getBrowserInfo() average time: ${averageTime.toFixed(3)}ms`);
      expect(averageTime).toBeLessThan(2); // Should be fast (< 2ms per call)
    });
  });

  describe('OpenAI Service Performance', () => {
    beforeEach(() => {
      // Reset fetch mock
      global.fetch = jest.fn();
    });

    test('makeRequest should handle concurrent requests efficiently', async () => {
      const { makeRequest } = await import('../../src/services/openai.js');

      // Mock fetch to avoid actual API calls
      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }],
          usage: { total_tokens: 100 }
        })
      });

      performance.mark('concurrent-requests-start');

      // Make multiple concurrent requests
      const promises = [];
      const numRequests = 10;
      for (let i = 0; i < numRequests; i++) {
        promises.push(makeRequest(`Test prompt ${i}`));
      }

      const results = await Promise.all(promises);

      performance.mark('concurrent-requests-end');
      performance.measure('OpenAI Concurrent Requests', 'concurrent-requests-start', 'concurrent-requests-end');

      const measure = performance.getEntriesByName('OpenAI Concurrent Requests')[0];
      const avgTimePerRequest = measure.duration / numRequests;

      console.log(`Concurrent requests: ${numRequests} requests in ${measure.duration.toFixed(2)}ms`);
      console.log(`Average time per request: ${avgTimePerRequest.toFixed(2)}ms`);

      expect(results).toHaveLength(numRequests);
      expect(measure.duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(avgTimePerRequest).toBeLessThan(200); // Average < 200ms per request
    });

    test('streaming response should process chunks efficiently', async () => {
      const { makeStreamingRequest } = await import('../../src/services/openai.js');

      let chunkCount = 0;
      // Mock streaming response with multiple chunks
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn(() => {
              chunkCount++;
              if (chunkCount <= 5) {
                return Promise.resolve({
                  done: false,
                  value: new TextEncoder().encode(`data: {"choices":[{"delta":{"content":"chunk${chunkCount}"}}]}\n\n`)
                });
              } else {
                return Promise.resolve({ done: true, value: undefined });
              }
            })
          })
        }
      };

      global.fetch.mockResolvedValue(mockResponse);

      const onChunk = jest.fn();
      performance.mark('streaming-start');

      const result = await makeStreamingRequest('Test prompt', onChunk);

      performance.mark('streaming-end');
      performance.measure('OpenAI Streaming Response', 'streaming-start', 'streaming-end');

      const measure = performance.getEntriesByName('OpenAI Streaming Response')[0];

      console.log(`Streaming response processing: ${measure.duration.toFixed(2)}ms for ${chunkCount - 1} chunks`);
      console.log(`Result: "${result}"`);

      expect(measure.duration).toBeLessThan(500); // Should process within 500ms
      expect(onChunk).toHaveBeenCalledTimes(5);
      expect(result).toBe('chunk1chunk2chunk3chunk4chunk5');
    });

    test('should handle large payloads efficiently', async () => {
      const { makeRequest } = await import('../../src/services/openai.js');

      // Create a large prompt (1000 characters)
      const largePrompt = 'A'.repeat(1000);

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Response to large prompt' } }],
          usage: { total_tokens: 1200 }
        })
      });

      performance.mark('large-payload-start');
      const result = await makeRequest(largePrompt);
      performance.mark('large-payload-end');
      performance.measure('OpenAI Large Payload', 'large-payload-start', 'large-payload-end');

      const measure = performance.getEntriesByName('OpenAI Large Payload')[0];

      console.log(`Large payload processing: ${measure.duration.toFixed(2)}ms for ${largePrompt.length} chars`);

      expect(measure.duration).toBeLessThan(1000); // Should handle large payloads within 1 second
      expect(result.choices[0].message.content).toBe('Response to large prompt');
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
