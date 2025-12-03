import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "./button";
import { Card } from "./card";
import { Phone, PhoneOff, Mic, MicOff, Square, Bug, X, ChefHat } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

// Hooks
import { useTTS } from "@/voice-chat-system/src/hooks/useTTS";
import { useLLM } from "@/voice-chat-system/src/hooks/useLLM";
import { useTranscription } from "@/voice-chat-system/src/hooks/useTranscription";

// Chef AI service
import { chefAI } from "@/services/chef-ai";

// Debug Logs Component
const DebugLogs = ({ logs, isVisible, onToggle, onClear }: {
  logs: string[];
  isVisible: boolean;
  onToggle: () => void;
  onClear: () => void;
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 bg-white/95 backdrop-blur-sm text-green-800 font-mono text-xs rounded-lg border-2 border-green-200 shadow-lg overflow-hidden z-50">
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200">
        <span className="flex items-center gap-2 font-semibold">
          <Bug className="w-4 h-4 text-green-600" />
          Логи разговора
        </span>
        <div className="flex gap-1">
          <Button
            onClick={onClear}
            size="sm"
            variant="ghost"
            className="h-7 px-3 text-xs text-green-600 hover:text-green-800 hover:bg-green-100"
          >
            Очистить
          </Button>
          <Button
            onClick={onToggle}
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-green-600 hover:text-green-800 hover:bg-green-100"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
      <div className="p-3 max-h-80 overflow-y-auto bg-white">
        {logs.length === 0 ? (
          <div className="text-green-500 italic text-center py-4">Логи еще не появились...</div>
        ) : (
          logs.slice(-50).map((log, index) => (
            <div key={index} className="mb-2 leading-relaxed p-2 bg-green-50/50 rounded border-l-2 border-green-300">
              <span className="text-green-600 font-medium">[{new Date().toLocaleTimeString()}]</span>
              <span className="text-green-800 ml-1">{log}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const ChefVoiceCall = () => {
  const { isAuthenticated } = useUser();

  // UI State
  const [isCallActive, setIsCallActive] = useState(false);
  const [isInitializingCall, setIsInitializingCall] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  // Debug Logs State
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugLogs, setShowDebugLogs] = useState(false);

  // Audio State
  const [isMuted, setIsMuted] = useState(false);
  const callTimerRef = useRef<number | null>(null);

  // Debug logging functions
  const addDebugLog = useCallback((message: string) => {
    console.log(message);
    setDebugLogs(prev => [...prev, message]);
  }, []);

  const clearDebugLogs = useCallback(() => {
    setDebugLogs([]);
  }, []);

  const toggleDebugLogs = useCallback(() => {
    setShowDebugLogs(prev => !prev);
  }, []);

  // --- Hooks Initialization ---

  // 1. TTS Service (Speech Synthesis)
  const {
    speak,
    stop: stopTTS,
    resetDeduplication,
    isPlaying: isTTSPlaying,
    isSynthesizing: isTTSSynthesizing,
    isPlayingRef: isTTSPlayingRef,
    isSynthesizingRef: isTTSSynthesizingRef
  } = useTTS({
    ttsService: chefAI, // Используем chefAI вместо psychologistAI
    onPlaybackStatusChange: (isActive) => {
      if (!isActive) {
        console.log('[Chef TTS] TTS session ended, ready for new text');
      }
    }
  });

  // Combined ref for "Is Chef Speaking" to pass to transcription hook
  const isChefSpeakingRef = useRef(false);

  useEffect(() => {
    isChefSpeakingRef.current = isTTSPlaying || isTTSSynthesizing;
  }, [isTTSPlaying, isTTSSynthesizing]);

  // 2. Chef LLM Service (Logic)
  const {
    processUserMessage,
    addToConversation,
    isProcessing: isAIProcessing
  } = useLLM({
    llmService: chefAI, // Используем chefAI
    onResponseGenerated: async (text) => {
      await speak(text);
    },
    onError: (err) => setError(err)
  });

  // 3. Transcription Service (Speech Recognition)
  const {
    initializeRecognition,
    cleanup: cleanupRecognition,
    transcriptionStatus,
    microphoneAccessGranted,
    microphonePermissionStatus,
    forceOpenAI,
    isIOS,
    stopRecognition,
    startRecognition
  } = useTranscription({
    transcriptionService: chefAI, // Используем chefAI
    isTTSActiveRef: isChefSpeakingRef,
    addDebugLog,
    onTranscriptionComplete: async (text, source) => {
      const transcribeId = Date.now();
      console.log(`[ChefVoiceCall] onTranscriptionComplete (ID: ${transcribeId}) called with: "${text}" from ${source}`);
      if (!text) return;

      // Stop TTS if user interrupted
      if (source !== 'manual') stopTTS();

      // Reset TTS deduplication for new user input
      resetDeduplication();

      console.log(`[ChefVoiceCall] About to call processUserMessage (ID: ${transcribeId})`);
      await processUserMessage(text);
      console.log(`[ChefVoiceCall] processUserMessage completed (ID: ${transcribeId})`);
    },
    onInterruption: () => {
      stopTTS();
    },
    onSpeechStart: () => {
      // Optional: UI indication
    },
    onError: (err) => setError(err)
  });

  // --- Lifecycle & Logic ---

  useEffect(() => {
    // Component is ready when authenticated
    setLoading(false);
  }, [isAuthenticated]);

  const startCall = async () => {
    if (isCallActive || !isAuthenticated) return;
    setIsInitializingCall(true);
    setError(null);

    try {
      // Initialize Audio/Recognition
      await initializeRecognition();

      // UI Updates
      setIsCallActive(true);
      setCallDuration(0);

      // Initial Greeting
      setTimeout(async () => {
         const greeting = "Привет! Я Windexs, ваш личный шеф-повар. Готов помочь с любыми кулинарными вопросами. Что вы хотите приготовить сегодня?";
         addToConversation('assistant', greeting);
         await speak(greeting);
      }, 1000);

      // Start Timer
      callTimerRef.current = window.setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error("Start call error:", err);
      setError(err.message || "Не удалось начать звонок");
      cleanupRecognition();
    } finally {
      setIsInitializingCall(false);
    }
  };

  const endCall = async () => {
    stopTTS();
    cleanupRecognition();

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }

    setIsCallActive(false);
    setCallDuration(0);
    setError(null);
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      startRecognition();
    } else {
      setIsMuted(true);
      stopRecognition();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // --- Render ---

  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-white">
        <Card className="w-full max-w-md text-center border-2 border-green-200">
          <div className="p-8">
            <ChefHat className="w-16 h-16 mx-auto mb-4 text-green-600" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Войдите в аккаунт</h2>
            <p className="text-muted-foreground mb-4">
              Чтобы общаться с <span className="text-green-600 font-semibold">Windexs</span> шеф-поваром, необходимо войти в аккаунт
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-white flex flex-col">
      <div className="flex-1 overflow-hidden px-4 pt-4 pb-4 flex items-center">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-6 animate-fade-in">
            <ChefHat className="w-12 h-12 mx-auto mb-2 text-green-600" />
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Голосовой шеф-повар</h1>
            <p className="text-muted-foreground">Кулинарные советы от Windexs</p>
          </div>

          <Card className="bg-gradient-to-br from-white to-green-50 border-2 border-green-200 shadow-strong p-6 md:p-8 text-center animate-scale-in">
            {isInitializingCall ? (
              <div className="space-y-8">
                <div className="w-[180px] h-[180px] sm:w-[260px] sm:h-[260px] mx-auto rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-strong">
                  <ChefHat className="w-24 h-24 text-white animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold">Инициализация...</h2>
              </div>
            ) : !isCallActive ? (
              <div className="space-y-8">
                <div className="w-[180px] h-[180px] sm:w-[260px] sm:h-[260px] mx-auto rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-strong">
                  <ChefHat className="w-24 h-24 text-white" />
                </div>

                <div>
                  <h2 className="text-2xl font-bold mb-2">Начать разговор</h2>
                  <p className="text-muted-foreground">Получите кулинарные советы от профессионала</p>
                </div>

                <Button
                  onClick={startCall}
                  size="lg"
                  className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg shadow-medium text-lg px-12 py-6 hover:from-green-600 hover:to-emerald-600"
                  disabled={loading}
                >
                  <Phone className="w-6 h-6 mr-2" />
                  {loading ? "Загрузка..." : "Позвонить шеф-повару"}
                </Button>

                {error && <p className="text-sm text-destructive mt-4">{error}</p>}
              </div>
            ) : (
              <div className="space-y-8">
                <div className="w-[220px] h-[220px] sm:w-[320px] sm:h-[320px] mx-auto rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-strong">
                  <ChefHat className="w-32 h-32 text-white animate-pulse" />
                </div>

                <div>
                  <h2 className="text-2xl font-bold mb-2">Разговор идет</h2>
                  <div className="text-lg font-medium text-primary">{formatDuration(callDuration)}</div>
                </div>

                <div className="flex justify-center gap-4">
                  <Button
                    onClick={toggleMute}
                    size="lg"
                    variant={isMuted ? "destructive" : "outline"}
                    className="rounded-full w-16 h-16 p-0"
                  >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </Button>

                  {(isTTSPlaying || isTTSSynthesizing) && (
                    <Button
                      onClick={stopTTS}
                      size="lg"
                      variant="destructive"
                      className="rounded-full w-16 h-16 p-0 animate-pulse"
                      title="Прервать"
                    >
                      <Square className="w-6 h-6" />
                    </Button>
                  )}

                  <Button
                    onClick={endCall}
                    size="lg"
                    variant="destructive"
                    className="rounded-full w-16 h-16 p-0 shadow-medium"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                </div>

                {/* Debug Logs Toggle */}
                <div className="mt-4 flex justify-center">
                  <Button
                    onClick={toggleDebugLogs}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2 text-xs border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 hover:border-green-300"
                  >
                    <Bug className="w-3 h-3" />
                    {showDebugLogs ? 'Скрыть логи' : 'Показать логи'}
                  </Button>
                </div>

                {/* Mobile/No-Mic Text Fallback */}
                {!microphoneAccessGranted && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="text-sm font-medium mb-3 text-red-800">
                      🚫 Проблема с микрофоном
                    </h3>
                    <p className="text-sm text-red-600 mb-3">
                      {forceOpenAI ?
                        "Используется текстовый режим (OpenAI)" :
                        "Микрофон недоступен. Проверьте разрешения."}
                    </p>
                    <div className="text-xs text-gray-500 mb-3 space-y-1">
                      <div>📱 Устройство: iOS={isIOS ? 'Да' : 'Нет'} | Мобильный</div>
                      <div>🎯 Режим: OpenAI={forceOpenAI ? 'Включен' : 'Отключен'}</div>
                      <div>🔐 Разрешения: {microphonePermissionStatus}</div>
                    </div>
                    {forceOpenAI && (
                      <Button
                        onClick={() => {
                          const msg = prompt("Сообщение:");
                          if(msg) processUserMessage(msg);
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Отправить сообщение
                      </Button>
                    )}
                  </div>
                )}

                {transcriptionStatus && (
                  <p className="text-sm text-primary/80 animate-pulse">{transcriptionStatus}</p>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Debug Logs Panel */}
      <DebugLogs
        logs={debugLogs}
        isVisible={showDebugLogs}
        onToggle={toggleDebugLogs}
        onClear={clearDebugLogs}
      />
    </div>
  );
};

export default ChefVoiceCall;
