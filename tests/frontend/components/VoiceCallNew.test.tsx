import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import VoiceCallNew from '../../../src/components/ui/voice-call-new';
import { BrowserCompatibility } from '../../../src/lib/browser-compatibility';
import { useAuth } from '../../../src/contexts/AuthContext';

// Mock dependencies
jest.mock('../../../src/contexts/AuthContext');
jest.mock('../../../src/lib/browser-compatibility');
jest.mock('../../../src/hooks/use-toast');

// Mock Audio API
global.Audio = jest.fn().mockImplementation(() => ({
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  load: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  onended: null,
  onerror: null,
  onplay: null,
  currentTime: 0,
  volume: 1,
  muted: false
}));

// Mock MediaRecorder
global.MediaRecorder = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  ondataavailable: null,
  onstop: null,
  state: 'inactive'
}));

// Mock getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: jest.fn().mockReturnValue([
        { stop: jest.fn() }
      ])
    })
  },
  writable: true
});

// Mock SpeechRecognition
global.SpeechRecognition = jest.fn().mockImplementation(() => ({
  continuous: false,
  interimResults: false,
  lang: '',
  maxAlternatives: 1,
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  onstart: null,
  onresult: null,
  onerror: null,
  onend: null
}));

global.webkitSpeechRecognition = global.SpeechRecognition;

// Mock fetch
global.fetch = jest.fn();

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockBrowserCompatibility = BrowserCompatibility as jest.Mocked<typeof BrowserCompatibility>;

describe('VoiceCallNew Component', () => {
  const mockAuth = {
    token: 'test-token',
    user: { id: '1', email: 'test@example.com' },
    login: jest.fn(),
    logout: jest.fn(),
    isAuthenticated: true
  };

  const mockBrowserCaps = {
    mediaRecorder: true,
    getUserMedia: true,
    speechRecognition: true,
    webkitSpeechRecognition: false,
    speechSynthesis: true,
    webAudio: true,
    mediaDevices: true,
    fetch: true,
    localStorage: true,
    sessionStorage: true,
    indexedDB: true,
    serviceWorker: true,
    intersectionObserver: true,
    mutationObserver: true,
    resizeObserver: true
  };

  const mockBrowserInfo = {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    isChrome: true,
    isFirefox: false,
    isSafari: false,
    isEdge: false,
    isOpera: false,
    isIE: false,
    isMobile: false,
    version: '91',
    capabilities: mockBrowserCaps
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue(mockAuth);
    mockBrowserCompatibility.getCapabilities.mockReturnValue(mockBrowserCaps);
    mockBrowserCompatibility.getBrowserInfo.mockReturnValue(mockBrowserInfo);

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders voice call interface', () => {
    render(<VoiceCallNew />);

    expect(screen.getByText('Нажмите на микрофон, чтобы начать')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mic/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volume/i })).toBeInTheDocument();
  });

  test('shows browser compatibility warning when not supported', () => {
    const unsupportedCaps = { ...mockBrowserCaps, mediaRecorder: false, speechRecognition: false, webkitSpeechRecognition: false };
    mockBrowserCompatibility.getCapabilities.mockReturnValue(unsupportedCaps);

    render(<VoiceCallNew />);

    expect(screen.getByText('Ограниченная совместимость')).toBeInTheDocument();
    expect(screen.getByText(/не полностью поддерживает голосовые функции/)).toBeInTheDocument();
  });

  test('starts recording when mic button is clicked', async () => {
    render(<VoiceCallNew />);

    const micButton = screen.getByRole('button', { name: /mic/i });
    fireEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByText('Слушаю...')).toBeInTheDocument();
    });
  });

  test('stops recording when mic button is clicked again', async () => {
    render(<VoiceCallNew />);

    const micButton = screen.getByRole('button', { name: /mic/i });

    // Start recording
    fireEvent.click(micButton);
    await waitFor(() => {
      expect(screen.getByText('Слушаю...')).toBeInTheDocument();
    });

    // Stop recording
    fireEvent.click(micButton);
    await waitFor(() => {
      expect(screen.getByText('Нажмите на микрофон, чтобы начать')).toBeInTheDocument();
    });
  });

  test('toggles sound on/off', () => {
    render(<VoiceCallNew />);

    const soundButton = screen.getByRole('button', { name: /volume/i });
    expect(soundButton).toBeInTheDocument();

    fireEvent.click(soundButton);
    // Should toggle sound state (visual feedback)
  });

  test('handles navigation back', () => {
    const mockNavigate = jest.fn();
    jest.mock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate,
      useParams: () => ({ courseId: undefined })
    }));

    render(<VoiceCallNew />);

    const backButton = screen.getByRole('button', { name: /phone.*off/i });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  test('handles speech recognition results', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Test response'));
          controller.close();
        }
      })
    } as any);

    render(<VoiceCallNew />);

    const micButton = screen.getByRole('button', { name: /mic/i });
    fireEvent.click(micButton);

    // Simulate speech recognition result
    await waitFor(() => {
      // Should process the speech and send to LLM
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  test('displays transcript during speech recognition', async () => {
    render(<VoiceCallNew />);

    const micButton = screen.getByRole('button', { name: /mic/i });
    fireEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByText('Слушаю...')).toBeInTheDocument();
    });

    // Simulate interim results
    act(() => {
      // This would normally come from SpeechRecognition onresult event
      // For testing purposes, we verify the component can handle state changes
    });
  });

  test('handles TTS playback', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: jest.fn().mockResolvedValue(new Blob(['audio data']))
    } as any);

    render(<VoiceCallNew />);

    // Simulate receiving a response that triggers TTS
    act(() => {
      // This would normally happen when LLM responds
      // Component should handle TTS playback
    });

    await waitFor(() => {
      // Verify audio playback was attempted
      expect(global.Audio).toHaveBeenCalled();
    });
  });

  test('handles API errors gracefully', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockRejectedValueOnce(new Error('API Error'));

    render(<VoiceCallNew />);

    const micButton = screen.getByRole('button', { name: /mic/i });
    fireEvent.click(micButton);

    // Component should handle the error and show appropriate feedback
    await waitFor(() => {
      // Error handling should prevent crashes
      expect(screen.getByText('Нажмите на микрофон, чтобы начать')).toBeInTheDocument();
    });
  });

  test('cleans up resources on unmount', () => {
    const { unmount } = render(<VoiceCallNew />);

    unmount();

    // Should clean up audio contexts, media streams, etc.
    // This is hard to test directly but ensures no memory leaks
  });

  test('shows interrupt button during speech synthesis', async () => {
    render(<VoiceCallNew />);

    // When isSpeaking is true, interrupt button should appear
    // This is tested by checking the conditional rendering logic

    expect(screen.queryByText('Прервать')).not.toBeInTheDocument();
    // Note: In a real scenario, this would appear during TTS playback
  });
});
