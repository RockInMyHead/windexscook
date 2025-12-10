import { BrowserCompatibility } from '../../../src/lib/browser-compatibility';

// Mock browser objects
const mockNavigator = navigator as any;
const mockWindow = window as any;

// Mock browser APIs using jest.spyOn for better control
beforeEach(() => {
  // Reset BrowserCompatibility capabilities cache
  BrowserCompatibility['capabilities'] = null;

  // Mock navigator.userAgent
  jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('');

  // Mock various browser APIs
  Object.defineProperty(window, 'AudioContext', {
    value: undefined,
    configurable: true,
    writable: true
  });
  Object.defineProperty(window, 'MediaRecorder', {
    value: undefined,
    configurable: true,
    writable: true
  });
  Object.defineProperty(window, 'SpeechRecognition', {
    value: undefined,
    configurable: true,
    writable: true
  });
  Object.defineProperty(window, 'webkitSpeechRecognition', {
    value: undefined,
    configurable: true,
    writable: true
  });
  Object.defineProperty(window, 'speechSynthesis', {
    value: undefined,
    configurable: true,
    writable: true
  });
  Object.defineProperty(window, 'fetch', {
    value: undefined,
    configurable: true,
    writable: true
  });
  Object.defineProperty(window, 'localStorage', {
    value: undefined,
    configurable: true,
    writable: true
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    value: undefined,
    configurable: true,
    writable: true
  });
});

describe('BrowserCompatibility', () => {
  beforeEach(() => {
    // Reset all capabilities
    BrowserCompatibility['capabilities'] = null;
    jest.clearAllMocks();
  });

  describe('getCapabilities', () => {
    test('should detect Chrome capabilities', () => {
      jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );

      // Mock browser APIs
      (window as any).AudioContext = jest.fn();
      (window as any).MediaRecorder = jest.fn();
      (navigator as any).mediaDevices = { getUserMedia: jest.fn() };
      (window as any).SpeechRecognition = jest.fn();
      (window as any).speechSynthesis = { speak: jest.fn() };
      (window as any).fetch = jest.fn();

      const caps = BrowserCompatibility.getCapabilities();

      expect(caps.webAudio).toBe(true);
      expect(caps.mediaRecorder).toBe(true);
      expect(caps.getUserMedia).toBe(true);
      expect(caps.speechRecognition).toBe(true);
      expect(caps.speechSynthesis).toBe(true);
      expect(caps.fetch).toBe(true);
    });

    test('should detect Safari capabilities', () => {
      jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
      );

      // Mock browser APIs for Safari
      (window as any).AudioContext = jest.fn();
      (window as any).MediaRecorder = { isTypeSupported: jest.fn().mockReturnValue(true) };
      (navigator as any).mediaDevices = { getUserMedia: jest.fn() };
      (window as any).webkitSpeechRecognition = jest.fn();
      (window as any).speechSynthesis = { speak: jest.fn() };
      (window as any).fetch = jest.fn();

      const caps = BrowserCompatibility.getCapabilities();

      expect(caps.webAudio).toBe(true);
      expect(caps.mediaRecorder).toBe(true); // Safari-specific check
      expect(caps.getUserMedia).toBe(true);
      expect(caps.webkitSpeechRecognition).toBe(true);
      expect(caps.speechSynthesis).toBe(true);
      expect(caps.fetch).toBe(true);
    });

    test('should detect Firefox capabilities', () => {
      jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
      );

      // Mock browser APIs for Firefox
      (window as any).AudioContext = jest.fn();
      (window as any).MediaRecorder = jest.fn();
      (navigator as any).mediaDevices = { getUserMedia: jest.fn() };
      (window as any).webkitSpeechRecognition = jest.fn();
      (window as any).speechSynthesis = { speak: jest.fn() };
      (window as any).fetch = jest.fn();

      const caps = BrowserCompatibility.getCapabilities();

      expect(caps.webAudio).toBe(true);
      expect(caps.mediaRecorder).toBe(true);
      expect(caps.getUserMedia).toBe(true);
      expect(caps.webkitSpeechRecognition).toBe(true);
      expect(caps.speechSynthesis).toBe(true);
      expect(caps.fetch).toBe(true);
    });

    test('should handle missing APIs gracefully', () => {
      jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (compatible; Old Browser)');
      (window as any).AudioContext = undefined;
      (window as any).MediaRecorder = undefined;
      (navigator as any).mediaDevices = undefined;
      (window as any).SpeechRecognition = undefined;
      (window as any).webkitSpeechRecognition = undefined;
      (window as any).speechSynthesis = undefined;
      (window as any).fetch = undefined;

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
      jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      const info = BrowserCompatibility.getBrowserInfo();

      expect(info.isChrome).toBe(true);
      expect(info.isSafari).toBe(false);
      expect(info.isFirefox).toBe(false);
      expect(info.version).toBe('91');
    });

    test('should correctly identify Safari', () => {
      jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15');

      const info = BrowserCompatibility.getBrowserInfo();

      expect(info.isChrome).toBe(false);
      expect(info.isSafari).toBe(true);
      expect(info.isFirefox).toBe(false);
      expect(info.version).toBe('14');
    });

    test('should correctly identify Firefox', () => {
      jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0');

      const info = BrowserCompatibility.getBrowserInfo();

      expect(info.isChrome).toBe(false);
      expect(info.isSafari).toBe(false);
      expect(info.isFirefox).toBe(true);
      expect(info.version).toBe('89');
    });
  });

  describe('checkMinimumRequirements', () => {
    test('should pass when all requirements are met', () => {
      // Mock all required APIs
      (window as any).fetch = jest.fn();
      (window as any).AudioContext = class {}; // Mock as constructor
      (window as any).localStorage = {
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn()
      };
      (navigator as any).mediaDevices = {
        getUserMedia: jest.fn()
      };
      (window as any).speechSynthesis = {
        speak: jest.fn(),
        getVoices: jest.fn().mockReturnValue([])
      };
      (window as any).SpeechRecognition = jest.fn();
      (window as any).webkitSpeechRecognition = jest.fn();

      const result = BrowserCompatibility.checkMinimumRequirements();

      // Debug what issues are found
      console.log('DEBUG: checkMinimumRequirements result:', result);

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
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ data: 'test' })
      });
      (window as any).fetch = mockFetch;

      const result = await BrowserCompatibility.safeFetch('https://example.com');

      expect(mockFetch).toHaveBeenCalledWith('https://example.com', undefined);
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
