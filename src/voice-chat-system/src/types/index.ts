// Core audio types
export interface AudioConstraints {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  sampleRate?: number | { ideal: number; min?: number; max?: number };
  channelCount?: number | { ideal: number; min?: number; max?: number };
}

export interface RecordingOptions {
  mimeType?: string;
  audioBitsPerSecond?: number;
  videoBitsPerSecond?: number;
}

// Service interfaces
export interface TranscriptionService {
  transcribeAudio(audioBlob: Blob): Promise<string>;
}

export interface TTSService {
  synthesizeSpeech(text: string): Promise<ArrayBuffer>;
}

export interface LLMService {
  getVoiceResponse(messages: ChatMessage[], memoryContext?: string, fastMode?: boolean): Promise<string>;
}

// Chat and conversation types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface ConversationContext {
  messages: ChatMessage[];
  memory: string;
  userProfile?: UserProfile;
}

// User profile types
export interface UserProfile {
  id?: string;
  personalityTraits?: string;
  communicationStyle?: string;
  currentConcerns?: string;
  emotionalState?: string;
  stressTriggers?: string;
  interests?: string;
  dislikes?: string;
  values?: string;
  workLife?: string;
  relationships?: string;
  family?: string;
  health?: string;
  discussedTopics?: string;
  recurringThemes?: string;
  sessionCount?: number;
  lastSessionDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Audio processing types
export interface AudioAnalysis {
  volume: number;
  duration: number;
  format: string;
  size: number;
  sampleRate?: number;
  channels?: number;
}

export interface SpeechDetection {
  isActive: boolean;
  confidence: number;
  volume: number;
  timestamp: number;
}

// Hook props and state types
export interface UseTranscriptionProps {
  transcriptionService?: TranscriptionService;
  onTranscriptionComplete: (text: string, source: 'browser' | 'openai' | 'manual') => void;
  onSpeechStart?: () => void;
  onInterruption?: () => void;
  isTTSActiveRef: React.MutableRefObject<boolean>;
  onError?: (error: string) => void;
}

export interface UseTTSProps {
  ttsService: TTSService;
  onPlaybackStatusChange?: (isPlaying: boolean) => void;
}

export interface UseAudioRecorderProps {
  onRecordingComplete?: (blob: Blob) => void;
  onError?: (error: string) => void;
  onVolumeChange?: (volume: number) => void;
  mimeType?: string;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  sampleRate?: number;
  channelCount?: number;
}

export interface UseLLMProps {
  llmService?: any;
  memoryService?: any;
  userProfileService?: any;
  userId?: string;
  callId?: string | null;
  onResponseGenerated?: (text: string) => Promise<void>;
  onError?: (error: string) => void;
}

// Audio call session types
export interface AudioCallSession {
  id: string;
  userId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  transcriptionCount: number;
  ttsCount: number;
  status: 'active' | 'completed' | 'interrupted';
}

// Error types
export interface AudioError {
  type: 'microphone' | 'recording' | 'transcription' | 'synthesis' | 'network' | 'permission';
  message: string;
  code?: string;
  details?: any;
}

// Device capability types
export interface DeviceCapabilities {
  hasMicrophone: boolean;
  hasUserMedia: boolean;
  hasMediaRecorder: boolean;
  hasSpeechRecognition: boolean;
  hasWebAudio: boolean;
  supportedMimeTypes: string[];
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isMobile: boolean;
}

// Analytics and logging types
export interface VoiceSessionAnalytics {
  sessionId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  totalDuration: number;
  transcriptionCount: number;
  ttsCount: number;
  averageResponseTime: number;
  errorCount: number;
  interruptionCount: number;
  deviceInfo: DeviceCapabilities;
}

export interface NetworkEvent {
  type: 'openaiRequests' | 'openaiRetries' | 'openaiTimeouts' | 'networkErrors';
  count: number;
  timestamp: number;
}

// Configuration types
export interface VoiceChatConfig {
  transcription: {
    useOpenAI: boolean;
    mobileTimerInterval: number;
    volumeThreshold: number;
    minAudioSize: number;
    maxRetries: number;
  };
  tts: {
    defaultVoice: string;
    defaultModel: string;
    defaultFormat: string;
    playbackQueueSize: number;
  };
  audio: {
    constraints: AudioConstraints;
    recordingOptions: RecordingOptions;
  };
  llm: {
    maxTokens: number;
    temperature: number;
    contextWindow: number;
  };
}
