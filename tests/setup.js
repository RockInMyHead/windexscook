/**
 * Jest setup file - configures test environment
 */

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.VITE_API_URL = 'https://cook.windexs.ru';

// Mock import.meta for Vite environment variables
global.import = global.import || {};
global.import.meta = {
  env: {
    VITE_OPENAI_API_KEY: 'test-openai-key',
    VITE_API_URL: 'https://cook.windexs.ru',
    DEV: false,
    PROD: true
  }
};

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress console errors/warnings during tests unless explicitly needed
  console.error = (...args) => {
    if (args[0]?.includes?.('Warning:') ||
        args[0]?.includes?.('ReactDOMTestUtils') ||
        args[0]?.includes?.('act()')) {
      return;
    }
    originalConsoleError(...args);
  };

  console.warn = (...args) => {
    if (args[0]?.includes?.('Warning:') ||
        args[0]?.includes?.('ReactDOMTestUtils')) {
      return;
    }
    originalConsoleWarn(...args);
  };
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock window.IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock window.MutationObserver
global.MutationObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{}]
    }),
    enumerateDevices: jest.fn().mockResolvedValue([])
  },
  configurable: true
});

// Mock Audio API
global.Audio = jest.fn().mockImplementation(() => ({
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  load: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  currentTime: 0,
  volume: 1,
  muted: false,
  src: ''
}));

// Mock URL APIs
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock fetch
global.fetch = jest.fn();

// Mock TextEncoder/TextDecoder for OpenAI streaming
global.TextEncoder = jest.fn().mockImplementation(() => ({
  encode: jest.fn((text) => new Uint8Array(Buffer.from(text)))
}));

global.TextDecoder = jest.fn().mockImplementation(() => ({
  decode: jest.fn((buffer) => buffer.toString())
}));

// Mock ReadableStream for streaming responses
global.ReadableStream = jest.fn().mockImplementation(() => ({
  getReader: jest.fn(() => ({
    read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
    cancel: jest.fn()
  }))
}));

// Mock performance.now
global.performance.now = jest.fn(() => Date.now());

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

// Mock setImmediate for Node.js compatibility
global.setImmediate = jest.fn((cb, ...args) => setTimeout(() => cb(...args), 0));
global.clearImmediate = jest.fn((id) => clearTimeout(id));

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});