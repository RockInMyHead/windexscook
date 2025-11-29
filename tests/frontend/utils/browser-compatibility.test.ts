import { BrowserCompatibility } from '../../../src/lib/browser-compatibility';

// Mock navigator and window objects
const mockNavigator = {
  userAgent: '',
  mediaDevices: null as any,
  serviceWorker: null as any
};

const mockWindow = {
  AudioContext: null as any,
  webkitAudioContext: null as any,
  MediaRecorder: null as any,
  SpeechRecognition: null as any,
  webkitSpeechRecognition: null as any,
  speechSynthesis: null as any,
  fetch: null as any,
  localStorage: null as any,
  sessionStorage: null as any,
  indexedDB: null as any,
  IntersectionObserver: null as any,
  MutationObserver: null as any,
  ResizeObserver: null as any
};

Object.defineProperty(window, 'navigator', { value: mockNavigator, writable: true });
Object.defineProperty(window, 'AudioContext', { value: mockWindow.AudioContext, writable: true });
Object.defineProperty(window, 'webkitAudioContext', { value: mockWindow.webkitAudioContext, writable: true });
Object.defineProperty(window, 'MediaRecorder', { value: mockWindow.MediaRecorder, writable: true });
Object.defineProperty(window, 'SpeechRecognition', { value: mockWindow.SpeechRecognition, writable: true });
Object.defineProperty(window, 'webkitSpeechRecognition', { value: mockWindow.webkitSpeechRecognition, writable: true });
Object.defineProperty(window, 'speechSynthesis', { value: mockWindow.speechSynthesis, writable: true });
Object.defineProperty(window, 'fetch', { value: mockWindow.fetch, writable: true });
Object.defineProperty(window, 'localStorage', { value: mockWindow.localStorage, writable: true });
Object.defineProperty(window, 'sessionStorage', { value: mockWindow.sessionStorage, writable: true });
Object.defineProperty(window, 'indexedDB', { value: mockWindow.indexedDB, writable: true });
Object.defineProperty(window, 'IntersectionObserver', { value: mockWindow.IntersectionObserver, writable: true });
Object.defineProperty(window, 'MutationObserver', { value: mockWindow.MutationObserver, writable: true });
Object.defineProperty(window, 'ResizeObserver', { value: mockWindow.ResizeObserver, writable: true });

describe('BrowserCompatibility', () => {
  beforeEach(() => {
    // Reset all capabilities
    BrowserCompatibility['capabilities'] = null;
    jest.clearAllMocks();
  });

  describe('getCapabilities', () => {
    test('should detect Chrome capabilities', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      mockWindow.AudioContext = jest.fn();
      mockWindow.MediaRecorder = jest.fn();
      mockNavigator.mediaDevices = { getUserMedia: jest.fn() };
      mockWindow.SpeechRecognition = jest.fn();
      mockWindow.speechSynthesis = { speak: jest.fn() };
      mockWindow.fetch = jest.fn();

      const caps = BrowserCompatibility.getCapabilities();

      expect(caps.webAudio).toBe(true);
      expect(caps.mediaRecorder).toBe(true);
      expect(caps.getUserMedia).toBe(true);
      expect(caps.speechRecognition).toBe(true);
      expect(caps.speechSynthesis).toBe(true);
      expect(caps.fetch).toBe(true);
    });

    test('should detect Safari capabilities', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
      mockWindow.AudioContext = jest.fn();
      mockWindow.MediaRecorder = { isTypeSupported: jest.fn().mockReturnValue(true) };
      mockNavigator.mediaDevices = { getUserMedia: jest.fn() };
      mockWindow.webkitSpeechRecognition = jest.fn();
      mockWindow.speechSynthesis = { speak: jest.fn() };
      mockWindow.fetch = jest.fn();

      const caps = BrowserCompatibility.getCapabilities();

      expect(caps.webAudio).toBe(true);
      expect(caps.mediaRecorder).toBe(true); // Safari-specific check
      expect(caps.getUserMedia).toBe(true);
      expect(caps.webkitSpeechRecognition).toBe(true);
      expect(caps.speechSynthesis).toBe(true);
      expect(caps.fetch).toBe(true);
    });

    test('should detect Firefox capabilities', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
      mockWindow.AudioContext = jest.fn();
      mockWindow.MediaRecorder = jest.fn();
      mockNavigator.mediaDevices = { getUserMedia: jest.fn() };
      mockWindow.webkitSpeechRecognition = jest.fn();
      mockWindow.speechSynthesis = { speak: jest.fn() };
      mockWindow.fetch = jest.fn();

      const caps = BrowserCompatibility.getCapabilities();

      expect(caps.webAudio).toBe(true);
      expect(caps.mediaRecorder).toBe(true);
      expect(caps.getUserMedia).toBe(true);
      expect(caps.webkitSpeechRecognition).toBe(true);
      expect(caps.speechSynthesis).toBe(true);
      expect(caps.fetch).toBe(true);
    });

    test('should handle missing APIs gracefully', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (compatible; Old Browser)';
      mockWindow.AudioContext = undefined;
      mockWindow.MediaRecorder = undefined;
      mockNavigator.mediaDevices = undefined;
      mockWindow.SpeechRecognition = undefined;
      mockWindow.webkitSpeechRecognition = undefined;
      mockWindow.speechSynthesis = undefined;
      mockWindow.fetch = undefined;

      const caps = BrowserCompatibility.getCapabilities();

      expect(caps.webAudio).toBe(false);
      expect(caps.mediaRecorder).toBe(false);
      expect(caps.getUserMedia).toBe(false);
      expect(caps.speechRecognition).toBe(false);
      expect(caps.webkitSpeechRecognition).toBe(false);
      expect(caps.speechSynthesis).toBe(false);
      expect(caps.fetch).toBe(false);
    });
  });

  describe('getBrowserInfo', () => {
    test('should correctly identify Chrome', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

      const info = BrowserCompatibility.getBrowserInfo();

      expect(info.isChrome).toBe(true);
      expect(info.isSafari).toBe(false);
      expect(info.isFirefox).toBe(false);
      expect(info.version).toBe('91');
    });

    test('should correctly identify Safari', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';

      const info = BrowserCompatibility.getBrowserInfo();

      expect(info.isChrome).toBe(false);
      expect(info.isSafari).toBe(true);
      expect(info.isFirefox).toBe(false);
      expect(info.version).toBe('14');
    });

    test('should correctly identify Firefox', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';

      const info = BrowserCompatibility.getBrowserInfo();

      expect(info.isChrome).toBe(false);
      expect(info.isSafari).toBe(false);
      expect(info.isFirefox).toBe(true);
      expect(info.version).toBe('89');
    });
  });

  describe('checkMinimumRequirements', () => {
    test('should pass when all requirements are met', () => {
      mockWindow.fetch = jest.fn();
      mockWindow.AudioContext = jest.fn();
      mockWindow.localStorage = {
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn()
      };

      const result = BrowserCompatibility.checkMinimumRequirements();

      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should fail when critical APIs are missing', () => {
      mockWindow.fetch = undefined;
      mockWindow.AudioContext = undefined;
      mockWindow.localStorage = undefined;

      const result = BrowserCompatibility.checkMinimumRequirements();

      expect(result.passed).toBe(false);
      expect(result.issues).toContain('Fetch API не поддерживается. Обновите браузер.');
      expect(result.issues).toContain('Web Audio API не поддерживается. Используйте современный браузер.');
      expect(result.issues).toContain('LocalStorage недоступен. Возможно, включен приватный режим.');
    });
  });

  describe('safeFetch', () => {
    test('should use native fetch when available', async () => {
      const mockFetch = jest.fn().mockResolvedValue('response');
      mockWindow.fetch = mockFetch;

      const result = await BrowserCompatibility.safeFetch('https://example.com');

      expect(mockFetch).toHaveBeenCalledWith('https://example.com', undefined);
      expect(result).toBe('response');
    });

    test('should fallback to XMLHttpRequest when fetch is unavailable', async () => {
      mockWindow.fetch = undefined;

      // Mock XMLHttpRequest
      const mockXHR = {
        open: jest.fn(),
        setRequestHeader: jest.fn(),
        send: jest.fn(),
        onload: null,
        onerror: null,
        ontimeout: null,
        responseText: 'response text',
        status: 200,
        statusText: 'OK',
        getResponseHeader: jest.fn().mockReturnValue('application/json')
      };

      global.XMLHttpRequest = jest.fn(() => mockXHR) as any;

      const promise = BrowserCompatibility.safeFetch('https://example.com');

      // Simulate successful response
      mockXHR.onload();

      const result = await promise;

      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
      expect(mockXHR.open).toHaveBeenCalledWith('GET', 'https://example.com');
    });
  });
});
