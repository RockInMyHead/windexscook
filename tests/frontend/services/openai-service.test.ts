import { makeRequest, makeStreamingRequest, OpenAIError } from '../../../src/services/openai';

// Mock fetch
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('OpenAI Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VITE_OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.VITE_OPENAI_API_KEY;
  });

  describe('makeRequest', () => {
    test('should make successful request to OpenAI API', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }],
          usage: { total_tokens: 100 }
        })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await makeRequest('Test prompt', 'gpt-4-turbo', 1000);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          },
          body: JSON.stringify({
            model: 'gpt-4-turbo',
            messages: [{ role: 'user', content: 'Test prompt' }],
            max_completion_tokens: 1000,
            temperature: 0.7
          })
        })
      );

      expect(result).toEqual({
        choices: [{ message: { content: 'Test response' } }],
        usage: { total_tokens: 100 }
      });
    });

    test('should handle API errors', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: jest.fn().mockResolvedValue({ error: { message: 'Rate limit exceeded' } })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(makeRequest('Test prompt')).rejects.toThrow(OpenAIError);
      await expect(makeRequest('Test prompt')).rejects.toThrow('Rate limit exceeded');
    });

    test('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(makeRequest('Test prompt')).rejects.toThrow('Network error');
    });

    test('should use default model and tokens when not specified', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Response' } }]
        })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await makeRequest('Test prompt');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            model: 'gpt-4-turbo',
            messages: [{ role: 'user', content: 'Test prompt' }],
            max_completion_tokens: 4000,
            temperature: 0.7
          })
        })
      );
    });
  });

  describe('makeStreamingRequest', () => {
    test('should handle streaming response', async () => {
      const mockResponse = {
        ok: true,
        body: {
          getReader: jest.fn().mockReturnValue({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n') })
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":" world"}}]}\n\n') })
              .mockResolvedValueOnce({ done: true, value: undefined })
          })
        }
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const onChunk = jest.fn();
      const result = await makeStreamingRequest('Test prompt', onChunk);

      expect(onChunk).toHaveBeenCalledWith('Hello');
      expect(onChunk).toHaveBeenCalledWith(' world');
      expect(result).toBe('Hello world');
    });

    test('should handle streaming timeout', async () => {
      const mockResponse = {
        ok: true,
        body: {
          getReader: jest.fn().mockReturnValue({
            read: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ done: false, value: undefined }), 6000)))
          })
        }
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const onChunk = jest.fn();

      await expect(makeStreamingRequest('Test prompt', onChunk)).rejects.toThrow('Streaming timeout');
    });

    test('should handle malformed streaming data', async () => {
      const mockResponse = {
        ok: true,
        body: {
          getReader: jest.fn().mockReturnValue({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('invalid json') })
              .mockResolvedValueOnce({ done: true, value: undefined })
          })
        }
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const onChunk = jest.fn();
      const result = await makeStreamingRequest('Test prompt', onChunk);

      // Should handle invalid JSON gracefully
      expect(result).toBe('');
    });
  });

  describe('OpenAIError', () => {
    test('should create error with message', () => {
      const error = new OpenAIError('Test error message');
      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('OpenAIError');
    });

    test('should create error with default message', () => {
      const error = new OpenAIError();
      expect(error.message).toBe('OpenAI API error');
      expect(error.name).toBe('OpenAIError');
    });
  });
});
