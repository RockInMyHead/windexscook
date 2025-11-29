import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Loader2,
  ChefHat
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { OpenAIService } from '@/services/openai';
import { OpenAITTS } from '@/services/openai-tts';
import { OpenAISTT } from '@/services/openai-stt';
import { Recipe } from '@/types/recipe';
import { RecipeDisplay } from './recipe-display';
import { AudioUtils } from '@/lib/audio-utils';
import { BrowserCompatibility } from '@/lib/browser-compatibility';
import AssistantOrb from './assistant-orb';

// API URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'https://cook.windexs.ru';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((event: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
    mozSpeechRecognition?: new () => SpeechRecognition;
  }
}

// Функция определения Safari
const isSafari = () => {
  const ua = navigator.userAgent.toLowerCase();
  const result = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium');
  console.log('🌐 Определение браузера:', {
    userAgent: ua,
    isSafari: result,
    hasChrome: ua.includes('chrome'),
    hasSafari: ua.includes('safari')
  });
  return result;
};

interface VoiceCallProps {
  className?: string;
}

export const VoiceCall: React.FC<VoiceCallProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useUser();

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [transcriptDisplay, setTranscriptDisplay] = useState<string>("");
  const [browserSupported, setBrowserSupported] = useState<boolean>(true);
  const [browserCapabilities, setBrowserCapabilities] = useState<any>(null);
  const [useFallbackTranscription, setUseFallbackTranscription] = useState(false);

  // Refs для управления состоянием
  const isConnectedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const isStartingRecordingRef = useRef(false);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedTextRef = useRef('');
  const currentGenerationRef = useRef<AbortController | null>(null);
  const pendingMessageRef = useRef<string>('');

  // Проверка поддержки OpenAI STT
  useEffect(() => {
    const caps = BrowserCompatibility.getCapabilities();

    // Проверяем поддержку OpenAI STT (MediaRecorder + getUserMedia)
    const hasRecordingSupport = caps.mediaRecorder && caps.getUserMedia;

    if (!hasRecordingSupport) {
      console.warn('🎤 [Voice Call] OpenAI STT не поддерживается в этом браузере');
      setBrowserSupported(false);
      setBrowserCapabilities(caps);
      return;
    }

    console.log('✅ [Voice Call] OpenAI STT поддерживается в этом браузере');
  }, []);

  // Функция для обработки голосовых сообщений
  const processVoiceMessage = async (message: string, appendToPending: boolean = false) => {
    if (!message || !message.trim()) {
      console.log('⚠️ [Voice Call] Пустое сообщение - пропускаем');
      return;
    }

    // Объединяем с накопленным сообщением, если нужно
    const finalMessage = appendToPending && pendingMessageRef.current
      ? `${pendingMessageRef.current} ${message.trim()}`
      : message.trim();

    console.log('🎤 [Voice Call] Обрабатываем голосовое сообщение:', finalMessage, appendToPending ? '(добавлено к предыдущему)' : '');

    // Прерываем предыдущую генерацию, если она активна
    if (currentGenerationRef.current) {
      console.log('🚫 [Voice Call] Прерываем предыдущую генерацию');
      currentGenerationRef.current.abort();
      currentGenerationRef.current = null;
    }

    // Создаем новый AbortController для этой генерации
    const abortController = new AbortController();
    currentGenerationRef.current = abortController;

    try {
      setCallState(prev => ({ ...prev, isLoading: true }));

      // Создаем промпт для генерации рецепта
      const recipePrompt = `Создай подробный рецепт на основе этого голосового запроса: "${finalMessage}"

Требования:
- Определи основные ингредиенты из запроса
- Создай пошаговый рецепт
- Укажи время приготовления
- Добавь советы шеф-повара

Ответ в формате JSON:
{
  "title": "Название блюда",
  "description": "Описание",
  "ingredients": ["ингредиент 1", "ингредиент 2"],
  "instructions": ["шаг 1", "шаг 2"],
  "cookTime": "время",
  "servings": количество,
  "tips": "советы"
}`;

      // Отправляем запрос к OpenAI с возможностью прерывания
      const response = await OpenAIService.generateRecipeFromText(recipePrompt, abortController.signal);

      // Проверяем, не было ли прерывание
      if (abortController.signal.aborted) {
        console.log('⚠️ [Voice Call] Генерация была прервана новым сообщением');
        setCallState(prev => ({ ...prev, isLoading: false }));
          return;
        }

      if (response) {
        console.log('✅ [Voice Call] Рецепт сгенерирован:', response.title);
        setCallState(prev => ({
          ...prev,
          generatedRecipe: response,
          isLoading: false
        }));

        // Очищаем накопленное сообщение после успешной генерации
        pendingMessageRef.current = '';

        // Озвучиваем результат
        const speechText = `Отлично! Я приготовил для вас рецепт "${response.title}". ${response.description}. Хотите, чтобы я озвучил подробный рецепт?`;
        await OpenAITTS.speak(speechText, 'alloy');
        setCallState(prev => ({ ...prev, isPlaying: true }));
        isPlayingRef.current = true;
      }

    } catch (error: any) {
      // Игнорируем ошибку прерывания (AbortError)
      if (error.name === 'AbortError') {
        console.log('ℹ️ [Voice Call] Генерация была прервана - это нормально');
        return;
      }

      console.error('❌ [Voice Call] Ошибка обработки голосового сообщения:', error);
      setCallState(prev => ({
        ...prev,
        error: 'Ошибка обработки запроса',
        isLoading: false
      }));

      toast({
        title: "❌ Ошибка",
        description: "Не удалось обработать ваш запрос",
        variant: "destructive",
      });
    } finally {
      // Очищаем AbortController
      if (currentGenerationRef.current === abortController) {
        currentGenerationRef.current = null;
      }
    }
  };

  // Функция начала записи
  const startRecording = useCallback(async () => {
    console.log('🎤 [Voice Call] startRecording вызвана');

    if (!isConnectedRef.current) {
      console.log('⚠️ [Voice Call] Попытка записи без подключения - отменяем');
      return;
    }

    if (isStartingRecordingRef.current) {
      console.log('⚠️ [Voice Call] Запись уже запускается - пропускаем');
      return;
    }

    isStartingRecordingRef.current = true;

    try {
      // Останавливаем предыдущую запись если она активна
      if (callState.isRecording) {
        console.log('🔄 [Voice Call] Останавливаем предыдущую запись');
        stopRecording();
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Останавливаем текущее воспроизведение TTS если пользователь начинает говорить
    if (callState.isPlaying) {
        console.log('🚫 [Voice Call] Прерываем TTS при начале записи');
      OpenAITTS.stop();
      setCallState(prev => ({ ...prev, isPlaying: false }));
        isPlayingRef.current = false;
        toast({
          title: "🎤 Речь прервана",
          description: "Ваша речь важнее! Говорите...",
        });
      }

      // Прерываем текущую генерацию рецепта, если она активна
      if (currentGenerationRef.current && !currentGenerationRef.current.signal.aborted) {
        console.log('🚫 [Voice Call] Прерываем текущую генерацию рецепта');
        currentGenerationRef.current.abort();
        currentGenerationRef.current = null;
        setCallState(prev => ({ ...prev, isLoading: false }));
      }

      // Запускаем запись с OpenAI STT
      console.log('🎬 [Voice Call] Запускаем OpenAI STT запись');
      await OpenAISTT.startRecording();

      setCallState(prev => ({ ...prev, isRecording: true }));
      isStartingRecordingRef.current = false;

      console.log('✅ [Voice Call] Запись речи начата');
      console.log('⏱️ [Voice Call] Время начала записи:', new Date().toISOString());

      toast({
        title: "🎤 Запись начата",
        description: "Говорите в микрофон. Нажмите кнопку еще раз, чтобы остановить.",
      });

    } catch (error: any) {
      console.error('❌ [Voice Call] Ошибка начала записи:', error);
      setCallState(prev => ({ ...prev, isRecording: false, error: error.message }));
        isStartingRecordingRef.current = false;

        toast({
        title: "❌ Ошибка записи",
        description: error.message || "Не удалось начать запись",
          variant: "destructive",
        });
      }
  }, [callState.isRecording, callState.isPlaying]);

  // Функция остановки записи
  const stopRecording = useCallback(async () => {
    console.log('🛑 [Voice Call] stopRecording вызвана');

    if (!OpenAISTT.isCurrentlyRecording()) {
      console.log('⚠️ [Voice Call] Запись не активна');
                      return;
                    }

    try {
      console.log('⏳ [Voice Call] Останавливаем запись и обрабатываем...');

      // Показываем уведомление о обработке
      toast({
        title: "⏳ Обработка речи",
        description: "Распознаем вашу речь...",
      });

      // Останавливаем запись и получаем транскрибацию
      const text = await OpenAISTT.stopRecording();

      if (text && text.trim()) {
        console.log('✅ [Voice Call] Текст распознан:', text.trim());

        // Показываем успешное распознавание
        toast({
          title: "✅ Речь распознана",
          description: `"${text.trim()}"`,
        });

        // Определяем, нужно ли добавить к предыдущему сообщению
        const shouldAppend = currentGenerationRef.current !== null || callState.isLoading;

        if (shouldAppend) {
          // Добавляем к накопленному сообщению
          pendingMessageRef.current = pendingMessageRef.current
            ? `${pendingMessageRef.current} ${text.trim()}`
            : text.trim();
          console.log('🔗 [Voice Call] Добавляем к предыдущему сообщению:', pendingMessageRef.current);
        }

        // Обрабатываем голосовое сообщение
        await processVoiceMessage(text.trim(), shouldAppend);
      } else {
        console.log('⚠️ [Voice Call] Текст не распознан');
        toast({
          title: "⚠️ Речь не распознана",
          description: "Попробуйте говорить четче или проверьте микрофон",
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('❌ [Voice Call] Ошибка остановки записи:', error);
      toast({
        title: "❌ Ошибка распознавания",
        description: error.message || "Не удалось обработать запись",
        variant: "destructive",
      });
    } finally {
      setCallState(prev => ({ ...prev, isRecording: false }));
                        isStartingRecordingRef.current = false;
                      }
  }, []);

  // Функция начала звонка
  const startCall = useCallback(async () => {
    console.log('📞 [Voice Call] Начинаем звонок');

    try {
      setCallState(prev => ({ ...prev, isLoading: true }));

      // Инициализируем приветствие
      const greeting = "Привет! Я ваш AI шеф-повар. Расскажите, что вы хотели бы приготовить, и я помогу с рецептом!";
      await OpenAITTS.speak(greeting, 'alloy');
      
      setCallState(prev => ({ 
        ...prev, 
        isConnected: true, 
        isPlaying: true,
        isLoading: false
      }));
      isConnectedRef.current = true;
      isPlayingRef.current = true;

      console.log('✅ [Voice Call] Звонок начат');
      
    } catch (error) {
      console.error('❌ [Voice Call] Ошибка начала звонка:', error);
      setCallState(prev => ({ 
        ...prev, 
        error: 'Ошибка подключения',
        isLoading: false
      }));
    }
  }, []);

  // Функция окончания звонка
  const endCall = useCallback(() => {
    console.log('📞 [Voice Call] Завершаем звонок');

    // Останавливаем все активные процессы
    OpenAITTS.stop();
    if (OpenAISTT.isCurrentlyRecording()) {
      OpenAISTT.cancelRecording();
    }

    // Очищаем таймеры
    if (callTimerRef.current) {
      clearTimeout(callTimerRef.current);
      callTimerRef.current = null;
    }
    
    // Прерываем активную генерацию
    if (currentGenerationRef.current) {
      currentGenerationRef.current.abort();
      currentGenerationRef.current = null;
    }
    
    setCallState({
      isConnected: false,
      isRecording: false,
      isPlaying: false,
      isLoading: false,
      isContinuousMode: false,
      error: null,
      generatedRecipe: null
    });
    
    isConnectedRef.current = false;
    isPlayingRef.current = false;
    isStartingRecordingRef.current = false;
      accumulatedTextRef.current = '';
    pendingMessageRef.current = '';

    console.log('✅ [Voice Call] Звонок завершен');
  }, []);

  // Обработчик окончания TTS
  useEffect(() => {
    const handleTTSEnd = () => {
        setCallState(prev => ({ ...prev, isPlaying: false }));
      isPlayingRef.current = false;
    };

    // Здесь можно добавить слушатель событий TTS окончания
    // Пока просто оставим заглушку
  }, []);

  // Stop TTS and clear timer on unmount
  useEffect(() => {
    return () => {
      console.log('🛑 [Voice Call] Component unmounted, stopping TTS and timer');
                          OpenAITTS.stop();
      if (callTimerRef.current) clearTimeout(callTimerRef.current);
      if (currentGenerationRef.current) {
        currentGenerationRef.current.abort();
        currentGenerationRef.current = null;
      }
    };
  }, []);

  // Показываем предупреждение если браузер не поддерживается
  if (!browserSupported && browserCapabilities) {
    const caps = browserCapabilities;
    const missingFeatures = [];

    if (!caps.getUserMedia) missingFeatures.push('микрофон');
    if (!caps.mediaRecorder) missingFeatures.push('запись аудио');
    if (!caps.webAudio) missingFeatures.push('аудио');

    return (
      <div className={`h-full flex flex-col ${className}`}>
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-center text-orange-600">⚠️ Ограниченная совместимость</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Ваш браузер не полностью поддерживает голосовые функции.
                {missingFeatures.length > 0 && ` Отсутствует поддержка: ${missingFeatures.join(', ')}.`}
              </p>
              <p className="text-sm text-muted-foreground">
                Рекомендуется использовать современный браузер с поддержкой MediaRecorder API.
              </p>
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                <strong>Информация о браузере:</strong><br/>
                {BrowserCompatibility.getBrowserInfo().isChrome && `Chrome v${BrowserCompatibility.getBrowserInfo().version}`}
                {BrowserCompatibility.getBrowserInfo().isFirefox && `Firefox v${BrowserCompatibility.getBrowserInfo().version}`}
                {BrowserCompatibility.getBrowserInfo().isSafari && `Safari v${BrowserCompatibility.getBrowserInfo().version}`}
                {BrowserCompatibility.getBrowserInfo().isEdge && `Edge v${BrowserCompatibility.getBrowserInfo().version}`}
                {BrowserCompatibility.getBrowserInfo().isOpera && `Opera v${BrowserCompatibility.getBrowserInfo().version}`}
                {!BrowserCompatibility.getBrowserInfo().isChrome &&
                 !BrowserCompatibility.getBrowserInfo().isFirefox &&
                 !BrowserCompatibility.getBrowserInfo().isSafari &&
                 !BrowserCompatibility.getBrowserInfo().isEdge &&
                 !BrowserCompatibility.getBrowserInfo().isOpera &&
                 `Unknown browser v${BrowserCompatibility.getBrowserInfo().version}`}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">AI Повар</h2>
              <p className="text-sm text-muted-foreground">
                {callState.isConnected ? 'В сети' : 'Не в сети'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {callState.isConnected && (
              <Badge variant={callState.isRecording ? "destructive" : "default"}>
                {callState.isRecording ? "🎤 Слушаю..." : "🎙️ Готов слушать"}
              </Badge>
            )}
            {callState.isPlaying && (
              <Badge variant="default">
                <Mic className="w-3 h-3 mr-1" />
                Говорит
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Call Controls */}
        <div className="p-4 border-b border-border/50">
          <div className="flex justify-center gap-4">
          {!callState.isConnected ? (
            <Button
              onClick={startCall}
              disabled={callState.isLoading}
                className="bg-green-500 hover:bg-green-600 text-white"
              size="lg"
            >
              {callState.isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                  <Phone className="w-5 h-5 mr-2" />
              )}
                Позвонить AI Повару
            </Button>
          ) : (
              <div className="flex gap-2">
                <Button
                  onClick={callState.isRecording ? stopRecording : startRecording}
                  disabled={callState.isLoading}
                  variant={callState.isRecording ? "destructive" : "default"}
                  size="lg"
                >
                  {callState.isRecording ? (
                    <MicOff className="w-5 h-5 mr-2" />
                  ) : (
                    <Mic className="w-5 h-5 mr-2" />
                  )}
                  {callState.isRecording ? "Остановить" : "Говорить"}
                </Button>

            <Button
              onClick={endCall}
                  variant="outline"
              size="lg"
            >
              <PhoneOff className="w-5 h-5 mr-2" />
                  Завершить
            </Button>
              </div>
          )}
          </div>
        </div>

        {/* Recipe Display */}
        {callState.generatedRecipe && (
          <div className="flex-1 p-4">
            <RecipeDisplay recipe={callState.generatedRecipe} />
          </div>
        )}

        {/* Loading State */}
        {callState.isLoading && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Обрабатываю ваш запрос...</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {callState.error && (
          <div className="p-4">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <p className="text-red-600 text-sm">{callState.error}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Instructions */}
        {!callState.isConnected && !callState.error && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <ChefHat className="w-16 h-16 mx-auto mb-4 text-primary/60" />
              <h3 className="text-lg font-semibold mb-2">AI Шеф-повар</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Позвоните AI повару и расскажите голосом, что вы хотели бы приготовить.
                Он создаст персональный рецепт специально для вас!
              </p>
              <div className="text-xs text-muted-foreground">
                🎤 Работает во всех современных браузерах<br/>
                🔒 Ваша речь обрабатывается через OpenAI Whisper
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
