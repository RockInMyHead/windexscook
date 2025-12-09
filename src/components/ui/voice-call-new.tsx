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

export const VoiceCallNew: React.FC<VoiceCallProps> = ({ className = '' }) => {
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

  // Refs
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastTranscriptRef = useRef<string>('');
  const generationIdRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const microphoneSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const volumeMonitorRef = useRef<number | null>(null);
  const isPlayingAudioRef = useRef<boolean>(false);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const ttsProgressRef = useRef<{
    startTime: number;
    text: string;
    duration: number;
    words: string[];
    currentWordIndex: number;
  } | null>(null);

  // Fallback recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Voice call timer refs
  const callStartTimeRef = useRef<number | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Инициализация аудио контекста
  const initializeAudioContext = useCallback(async (): Promise<AudioContext> => {
    if (audioContextRef.current) {
      return audioContextRef.current;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContextClass();

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  // Основная функция прерывания речи ассистента
  const stopAssistantSpeech = useCallback(() => {
    console.log('🛑 Прерываем речь ассистента');
    generationIdRef.current += 1;
    audioQueueRef.current = [];

    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.volume = 0;
        currentAudioRef.current.muted = true;
        currentAudioRef.current.src = '';
        currentAudioRef.current.load();
      } catch (error) {
        console.warn('⚠️ Ошибка при остановке аудио:', error);
      }
      currentAudioRef.current = null;
    }

    isPlayingAudioRef.current = false;
    setIsSpeaking(false);
    ttsProgressRef.current = null;
  }, []);

  // Check if Web Speech API is available
  const isWebSpeechAvailable = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition;
    return !!SpeechRecognition;
  }, []);

  // Voice call time management
  const FREE_VOICE_TIME_MINUTES = 60; // 1 hour free

  const getVoiceCallTime = useCallback((): number => {
    const stored = localStorage.getItem('voiceCallTime');
    if (!stored) return 0;
    return parseInt(stored, 10) || 0;
  }, []);

  const saveVoiceCallTime = useCallback((time: number): void => {
    localStorage.setItem('voiceCallTime', time.toString());
  }, []);

  const getRemainingTime = useCallback((): number => {
    const usedTime = getVoiceCallTime();
    const totalFreeTime = FREE_VOICE_TIME_MINUTES * 60 * 1000; // Convert to milliseconds
    return Math.max(0, totalFreeTime - usedTime);
  }, [getVoiceCallTime]);

  const checkPremiumRequired = useCallback((): boolean => {
    return getRemainingTime() <= 0;
  }, [getRemainingTime]);

  const startCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }

    callStartTimeRef.current = Date.now();
    callTimerRef.current = setInterval(() => {
      const currentTime = Date.now();
      const elapsed = currentTime - (callStartTimeRef.current || currentTime);
      const totalUsed = getVoiceCallTime() + elapsed;

      const remaining = Math.max(0, (FREE_VOICE_TIME_MINUTES * 60 * 1000) - totalUsed);
      if (remaining <= 0) {
        console.log('⏰ Бесплатное время вышло! Перенаправление на премиум...');
        stopCallTimer();
        // Redirect to premium page after a short delay
        setTimeout(() => {
          navigate('/premium');
        }, 2000);
      }
    }, 1000);
  }, [getVoiceCallTime, navigate]);

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    // Save the call duration
    if (callStartTimeRef.current) {
      const callDuration = Date.now() - callStartTimeRef.current;
      const totalUsed = getVoiceCallTime() + callDuration;
      saveVoiceCallTime(totalUsed);
      callStartTimeRef.current = null;
    }
  }, [getVoiceCallTime, saveVoiceCallTime]);

  // Cleanup timer on component unmount
  useEffect(() => {
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  // Transcribe audio using OpenAI Whisper API (fallback)
  const transcribeWithOpenAI = useCallback(async (audioBlob: Blob): Promise<string | null> => {
    try {
      console.log('🎤 Отправка аудио на транскрибацию через OpenAI Whisper...');
      setIsTranscribing(true);

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/openai/v1/audio/transcriptions', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Transcription failed');
      }

      const data = await response.json();
      console.log('✅ Транскрибация завершена:', data.text);
      return data.text || null;
    } catch (error) {
      console.error('❌ Ошибка транскрибации:', error);
      toast({
        title: "Ошибка распознавания",
        description: "Не удалось распознать речь. Попробуйте еще раз.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, [toast]);

  // Start fallback recording
  const startFallbackRecording = useCallback(async () => {
    try {
      console.log('🎤 Запуск fallback записи (MediaRecorder)...');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({
          title: "Микрофон недоступен",
          description: "Ваш браузер не поддерживает запись аудио.",
          variant: "destructive"
        });
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      console.log('✅ Fallback запись начата');
      return true;
    } catch (error) {
      console.error('❌ Ошибка запуска fallback записи:', error);
      toast({
        title: "Ошибка микрофона",
        description: "Не удалось получить доступ к микрофону.",
        variant: "destructive"
      });
      return false;
    }
  }, [toast]);

  // Stop fallback recording and transcribe
  const stopFallbackRecording = useCallback(async () => {
    return new Promise<string | null>((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
      return;
    }

      mediaRecorderRef.current.onstop = async () => {
        console.log('🛑 Fallback запись остановлена, chunks:', audioChunksRef.current.length);

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }

        if (audioChunksRef.current.length === 0) {
          resolve(null);
      return;
    }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];

        const text = await transcribeWithOpenAI(audioBlob);
        resolve(text);
      };

      mediaRecorderRef.current.stop();
    });
  }, [transcribeWithOpenAI]);

  // Initialize Web Speech API
  const initializeSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition;

    if (!SpeechRecognition) {
      console.log('⚠️ Web Speech API не поддерживается, будет использоваться OpenAI Whisper');
      setUseFallbackTranscription(true);
      return null;
    }

    console.log('🎤 Инициализация Web Speech API...');
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ru-RU';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('🎙️ Speech recognition started');
      setIsTranscribing(true);
    };

    recognition.onresult = async (event) => {
      if (!isMicEnabled) {
        return;
      }

      const result = event.results[event.results.length - 1];

      if (!result.isFinal) {
        const interimTranscript = result[0].transcript.trim();
        setTranscriptDisplay(interimTranscript);
        console.log('👤 Interim распознанный текст:', interimTranscript);
      }

      if (result.isFinal) {
        const transcript = result[0].transcript.trim();
        setTranscriptDisplay(transcript);
        console.log('👤 Финальный распознанный текст:', transcript);

        if (transcript) {
          if (isSpeaking) {
            stopAssistantSpeech();
          }

          lastTranscriptRef.current = transcript;

          const llmResponse = await sendToLLM(transcript);
          if (llmResponse && llmResponse.trim()) {
            await new Promise(resolve => setTimeout(resolve, 100));
            await speakText(llmResponse);
          }
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('❌ Speech recognition error:', event.error);
      setIsTranscribing(false);
    };

    recognition.onend = () => {
      console.log('🎙️ Speech recognition ended');
      setIsTranscribing(false);

      if (isRecording) {
        console.log('🔄 Перезапуск после неожиданной остановки...');
        setTimeout(() => {
          if (speechRecognitionRef.current && isRecording) {
            try {
              speechRecognitionRef.current.start();
              console.log('✅ Перезапуск успешен');
            } catch (e: any) {
              if (e.name !== 'InvalidStateError') {
                console.error('❌ Ошибка перезапуска:', e);
              }
            }
          }
        }, 1000);
      }
    };

    speechRecognitionRef.current = recognition;
    console.log('✅ Web Speech API инициализирован');
    return recognition;
  }, [isRecording, isMicEnabled]);

  // Start speech recognition
  const startSpeechRecognition = useCallback(() => {
    if (!speechRecognitionRef.current) {
      console.log('❌ Speech recognition не инициализирован');
      return;
    }

    console.log('🎙️ Попытка запуска распознавания речи...', {
      isRecording,
      isTranscribing,
      recognitionState: speechRecognitionRef.current ? 'exists' : 'null'
    });

    try {
      console.log('🎙️ Запуск распознавания речи...');
      speechRecognitionRef.current.start();
      console.log('✅ start() вызван успешно');
    } catch (error: any) {
      if (error.name === 'InvalidStateError') {
        console.log('ℹ️ Распознавание речи уже запущено, продолжаем');
        return;
      }
      console.error('❌ Ошибка запуска speech recognition:', error);
      console.error('❌ Детали ошибки:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      setIsTranscribing(false);
    }
  }, [isRecording, isTranscribing]);

  // Start/stop recording
  const handleStartStopRecording = useCallback(async () => {
    if (isRecording) {
      console.log('🛑 Остановка записи...');
      setIsRecording(false);
      setIsTranscribing(false);

      // Stop the call timer
      stopCallTimer();

      if (useFallbackTranscription || !isWebSpeechAvailable()) {
        const transcript = await stopFallbackRecording();
        if (transcript && transcript.trim()) {
          console.log('🎯 Fallback транскрипция:', transcript);
          setTranscriptDisplay(transcript);

          stopAssistantSpeech();

          try {
            const llmResponse = await sendToLLM(transcript);
            if (llmResponse && llmResponse.trim()) {
              await speakText(llmResponse);
            }
          } catch (error) {
            console.error('❌ Ошибка обработки ответа:', error);
          }
        }
      } else {
        if (speechRecognitionRef.current) {
          try {
            speechRecognitionRef.current.stop();
          } catch (error) {
            console.log('Speech recognition already stopped');
          }
        }
      }
    } else {
      // Check if premium is required before starting
      if (isPremiumRequired || checkPremiumRequired()) {
        toast({
          title: "Премиум требуется",
          description: "Ваше бесплатное время голосового общения истекло. Переход на премиум...",
          variant: "destructive"
        });
        navigate('/premium');
        return;
      }

      // Check if premium is required before starting
      if (checkPremiumRequired()) {
        console.log('💎 Премиум требуется - перенаправление на страницу оплаты');
        navigate('/premium');
        return;
      }

      if (!isMicEnabled) {
        toast({
          title: "Микрофон отключен",
          description: "Включите микрофон для начала записи",
          variant: "destructive"
        });
        return;
      }

      console.log('🎤 Запуск записи...');
      setTranscriptDisplay("");

      // Start the call timer
      startCallTimer();

      if (!isWebSpeechAvailable()) {
        console.log('🔄 Используется fallback режим (OpenAI Whisper)');
        setUseFallbackTranscription(true);

        const started = await startFallbackRecording();
        if (started) {
          setIsRecording(true);
        }
        return;
      }

      try {
        if (!speechRecognitionRef.current) {
          const recognition = initializeSpeechRecognition();
          if (!recognition) {
            setUseFallbackTranscription(true);
            const started = await startFallbackRecording();
            if (started) {
              setIsRecording(true);
            }
            return;
          }
        }

        setIsRecording(true);
        startSpeechRecognition();

      } catch (error) {
        console.error('❌ Ошибка запуска записи:', error);
        setUseFallbackTranscription(true);

        const started = await startFallbackRecording();
        if (started) {
          setIsRecording(true);
        }
      }
    }
  }, [isRecording, isMicEnabled, toast]);

  // Toggle microphone
  const handleToggleMic = useCallback(() => {
    if (isMicEnabled) {
      console.log('🎤 Отключение микрофона...');
      setIsMicEnabled(false);
      if (isRecording) {
        setIsRecording(false);
        setIsTranscribing(false);

        if (speechRecognitionRef.current) {
          try {
            speechRecognitionRef.current.stop();
          } catch (error) {
            console.log('Speech recognition already stopped');
          }
        }

        if (mediaRecorderRef.current) {
          try {
            mediaRecorderRef.current.stop();
          } catch (error) {
            console.log('MediaRecorder already stopped');
          }
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }
      }
      toast({
        title: "Микрофон отключен",
        description: "Распознавание речи приостановлено"
      });
    } else {
      console.log('🎤 Включение микрофона...');
      setIsMicEnabled(true);
      toast({
        title: "Микрофон включен",
        description: "Распознавание речи активно"
      });
    }
  }, [isMicEnabled, isRecording, toast]);

  // Toggle sound
  const handleToggleSound = useCallback(() => {
    if (isSoundEnabled) {
      console.log('🔊 Отключение звука...');
      setIsSoundEnabled(false);
      toast({
        title: "Звук отключен",
        description: "Ответы не будут озвучиваться"
      });
    } else {
      console.log('🔊 Включение звука...');
      setIsSoundEnabled(true);
        toast({
        title: "Звук включен",
        description: "Ответы будут озвучиваться"
      });
    }
  }, [isSoundEnabled, toast]);

  // Send transcribed text to LLM
  const sendToLLM = useCallback(async (userMessage: string, retryCount: number = 0): Promise<string> => {
    const MAX_RETRIES = 3;
    const originalMessage = userMessage;

    console.log('🚀 sendToLLM вызвана с сообщением:', `"${userMessage}"`, retryCount > 0 ? `(попытка ${retryCount + 1}/${MAX_RETRIES + 1})` : '');

    setIsGeneratingResponse(true);
    const startGenId = generationIdRef.current;

    try {
      console.log('🤖 Отправка сообщения в LLM...');

      let response;
      try {
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: `Ты - опытный шеф-повар мирового уровня. Давай подробные кулинарные советы и рецепты.

Правила общения:
- Отвечай только текстом на русском языке
- Объясняй каждый шаг доходчиво, как мастер ученику
- Давай не только рецепты, но и объясняй ПОЧЕМУ так делать
- Упоминай секреты профессиональной кулинарии
- Будь вежливым и готовым ответить на уточняющие вопросы

При объяснении рецепта:
1. Детально описывай подготовку ингредиентов (размер нарезки, температура)
2. Объясняй температурные режимы и их влияние
3. Рассказывай о последовательности действий
4. Давай советы по исправлению ошибок`
              },
              {
                role: 'user',
                content: userMessage
              }
            ],
            stream: true
          })
        });
      } catch (fetchError) {
        console.error('❌ Fetch error:', fetchError);
        throw fetchError;
      }

      if (generationIdRef.current !== startGenId) {
        console.log('🛑 Генерация была прервана пользователем во время запроса к LLM');
        return '';
      }

      if (!response.ok) {
        console.error('❌ Server returned error:', response.status, response.statusText);
        if (response.status === 401) {
        toast({
            title: "Ошибка авторизации",
            description: "Сессия истекла. Пожалуйста, обновите страницу.",
            variant: "destructive"
          });
        }
        throw new Error(`Failed to get response from LLM: ${response.status}`);
      }

      // Обработка streaming ответа (чистый текст, не SSE)
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let fullMessage = '';
      let lastChunkTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        if (chunk.trim()) { // Игнорируем пустые чанки
          fullMessage += chunk;
          lastChunkTime = Date.now();
          console.log('📥 [Stream] Received chunk, total length:', fullMessage.length);
        }

        // Проверяем прерывание
        if (generationIdRef.current !== startGenId) {
          console.log('🛑 Генерация была прервана во время стриминга');
          return '';
        }

        // Проверяем таймаут (если нет данных более 5 секунд, завершаем)
        if (Date.now() - lastChunkTime > 5000) {
          console.log('⏰ [Stream] Timeout reached, ending stream');
          break;
        }
      }

      // Ждем еще немного на случай задержки последнего чанка
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('🤖 Ответ от LLM получен (длина):', fullMessage.length);

      if (!fullMessage || fullMessage.trim().length === 0) {
        console.warn('⚠️ Получен пустой ответ от LLM');

        if (retryCount < MAX_RETRIES) {
          console.log(`🔄 Запуск повторной попытки ${retryCount + 1}...`);
          const delay = Math.pow(2, retryCount) * 500;
          await new Promise(resolve => setTimeout(resolve, delay));
          return sendToLLM(originalMessage, retryCount + 1);
        } else {
          console.error('❌ Все попытки получения ответа исчерпаны');
          return "Извините, я не расслышала. Повторите, пожалуйста.";
        }
      }

      return fullMessage;
    } catch (error: any) {
      console.error('❌ Ошибка общения с LLM:', error);

      // Проверяем, является ли ошибка таймаутом
      const isTimeoutError = error.name === 'AbortError' ||
                           error.message?.includes('timeout') ||
                           error.message?.includes('504') ||
                           error.code === 'ETIMEDOUT';

      if (retryCount < MAX_RETRIES) {
        console.log(`${isTimeoutError ? '⏰' : '🔄'} ${isTimeoutError ? 'Таймаут' : 'Ошибка сети'}, повторная попытка ${retryCount + 1}...`);

        // Используем exponential backoff: для таймаутов - более длинные задержки
        const baseDelay = isTimeoutError ? 3000 : 1000; // 3 сек для таймаутов, 1 сек для других ошибок
        const delay = Math.min(baseDelay * Math.pow(2, retryCount), 10000); // Макс 10 секунд

        console.log(`⏳ Ждем ${delay}мс перед повторной попыткой...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return sendToLLM(originalMessage, retryCount + 1);
      }

      // Специальная обработка для таймаутов
      if (isTimeoutError) {
        toast({
          title: "Превышено время ожидания",
          description: "Ответ занимает слишком много времени. Попробуйте упростить запрос или повторите позже.",
          variant: "destructive"
        });
        return "Извините, генерация ответа занимает слишком много времени. Попробуйте упростить запрос или повторите позже.";
      }

      toast({
        title: "Ошибка",
        description: "Не удалось получить ответ от ассистента",
        variant: "destructive"
      });
      return "Извините, произошла ошибка связи. Попробуйте еще раз.";
    } finally {
      if (generationIdRef.current === startGenId) {
        setIsGeneratingResponse(false);
      }
    }
  }, [toast]);

  // Speak text using OpenAI TTS
  const speakText = useCallback(async (text: string) => {
    if (!text || !isSoundEnabled) return;

    const startGenId = generationIdRef.current;

    try {
      console.log('🔊 Генерация озвучки для:', text);
      isPlayingAudioRef.current = true;

      ttsProgressRef.current = {
        startTime: Date.now(),
        text: text,
        duration: text.length * 60,
        words: text.split(' '),
        currentWordIndex: 0
      };

      const response = await fetch('/api/openai/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          voice: 'nova',
          model: 'tts-1-hd',
          speed: 0.95
        })
      });

      if (generationIdRef.current !== startGenId) {
        console.log('🛑 Озвучка прервана до начала воспроизведения');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      audio.onplay = () => {
        console.log('🔊 Озвучка начата');
        setIsSpeaking(true);

        const shouldStop = !isSafari() && speechRecognitionRef.current;
        if (shouldStop) {
          try {
            console.log('⏸️ Останавливаем распознавание на время TTS (не Safari)');
            speechRecognitionRef.current.stop();
          } catch (e) {
            console.warn('⚠️ Ошибка остановки распознавания:', e);
          }
        }
      };

      audio.onended = () => {
        console.log('✅ Озвучка завершена');
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        isPlayingAudioRef.current = false;
        setIsSpeaking(false);
        ttsProgressRef.current = null;

        if (!isSafari() && speechRecognitionRef.current) {
          setTimeout(() => {
            try {
              console.log('▶️ Перезапускаем распознавание после TTS (не Safari)');
              speechRecognitionRef.current?.start();
            } catch (e: any) {
              if (e.name !== 'InvalidStateError') {
                console.warn('⚠️ Ошибка перезапуска распознавания:', e);
              }
            }
          }, 300);
        }
      };

      audio.onerror = (event) => {
        console.error('❌ Ошибка воспроизведения аудио:', event);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        isPlayingAudioRef.current = false;
        setIsSpeaking(false);
        ttsProgressRef.current = null;

        if (!isSafari() && speechRecognitionRef.current) {
          setTimeout(() => {
            try {
              console.log('▶️ Перезапускаем распознавание после ошибки (не Safari)');
              speechRecognitionRef.current?.start();
            } catch (e: any) {
              if (e.name !== 'InvalidStateError') {
                console.warn('⚠️ Ошибка перезапуска:', e);
              }
            }
          }, 300);
        }

        toast({
          title: "Ошибка озвучки",
          description: "Не удалось воспроизвести аудио",
          variant: "destructive"
        });
      };

      if (generationIdRef.current !== startGenId) {
        console.log('🛑 Озвучка прервана перед play()');
        return;
      }

      await audio.play();

    } catch (error) {
      console.error('❌ Ошибка TTS:', error);
      setIsSpeaking(false);
      isPlayingAudioRef.current = false;
      ttsProgressRef.current = null;
    }
  }, [isSoundEnabled, toast]);

  // Load user profile on mount
  useEffect(() => {
    const caps = BrowserCompatibility.getCapabilities();
    const browserInfo = BrowserCompatibility.getBrowserInfo();
    const hasRecordingSupport = caps.mediaRecorder && caps.getUserMedia;
    const hasSpeechRecognition = caps.speechRecognition || caps.webkitSpeechRecognition;

    // Для Safari используем Web Speech API как приоритетный вариант
    const isSafari = browserInfo.isSafari;
    const shouldUseFallback = !hasRecordingSupport || isSafari;

    if (shouldUseFallback && !hasSpeechRecognition) {
      console.warn('🎤 [Voice Call] Ни MediaRecorder, ни Web Speech API не поддерживаются в этом браузере');
      setBrowserSupported(false);
      setBrowserCapabilities(caps);
    } else if (shouldUseFallback && hasSpeechRecognition) {
      console.log('✅ [Voice Call] Используется Web Speech API (Safari или браузер без MediaRecorder)');
      setUseFallbackTranscription(true);
    } else {
      console.log('✅ [Voice Call] MediaRecorder API поддерживается в этом браузере');
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch (e) { }
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) { }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Determine Orb state
  const orbState = useMemo(() => {
    if (isSpeaking) return 'speaking';
    if (isGeneratingResponse) return 'processing';
    if (isRecording && isTranscribing) return 'listening';
    if (isRecording) return 'listening';
    return 'idle';
  }, [isSpeaking, isGeneratingResponse, isRecording, isTranscribing]);

  // Determine status text
  const statusText = useMemo(() => {
    if (isSpeaking) return 'Говорю...';
    if (isGeneratingResponse) return 'Думаю...';
    if (isRecording) return 'Слушаю...';
    return 'Нажмите на микрофон, чтобы начать';
  }, [isSpeaking, isGeneratingResponse, isRecording]);

  const showInterruptButton = isSpeaking && !isSafari();

    return (
    <div className={`relative w-full h-screen bg-background overflow-hidden flex flex-col font-sans ${className}`}>
      {/* Header */}
      <div className="absolute top-4 left-0 right-0 z-40 flex justify-center px-4">
        <div className="bg-background/80 backdrop-blur-sm px-6 py-2 rounded-full border border-border/50 shadow-sm">
          <span className="text-foreground/70 text-sm md:text-base font-medium">
            Windexs Cook AI
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4 pt-16 pb-32 md:pb-24">
        {/* Show browser compatibility warning */}
        {!browserSupported && browserCapabilities && (
          <div className="absolute top-20 left-0 right-0 z-40 flex justify-center px-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-center text-orange-600">⚠️ Ограниченная совместимость</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Ваш браузер не полностью поддерживает голосовые функции.
                  Отсутствует поддержка: запись аудио и распознавание речи.
              </p>
              <p className="text-sm text-muted-foreground">
                Для голосового общения используйте Chrome, Firefox или Edge.
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
        )}

        {/* Assistant Orb */}
        <div className="relative flex items-center justify-center mb-12 md:mb-16 scale-90 md:scale-100 transition-transform duration-500">
          <AssistantOrb state={orbState} />
      </div>

        {/* Status */}
        <div className="flex flex-col items-center space-y-6 text-center max-w-2xl px-4">
          <div className="text-foreground/80 text-xl md:text-2xl font-light tracking-widest uppercase transition-colors duration-300">
            {statusText}
          </div>

          {/* Interrupt Button */}
          {showInterruptButton && (
            <Button
              variant="outline"
              size="lg"
              className="bg-green-500 hover:bg-green-600 text-white border-green-600 hover:border-green-700 shadow-lg animate-in fade-in-0 zoom-in-95 duration-300"
              onClick={() => {
                console.log('🛑 Пользователь нажал кнопку прерывания');
                stopAssistantSpeech();

                if (speechRecognitionRef.current) {
                  setTimeout(() => {
                    try {
                      console.log('▶️ Перезапуск распознавания после прерывания кнопкой');
                      speechRecognitionRef.current?.start();
                    } catch (e: any) {
                      if (e.name !== 'InvalidStateError') {
                        console.warn('⚠️ Ошибка перезапуска:', e);
                      }
                    }
                  }, 100);
                }
              }}
            >
              <span className="font-medium">Прервать</span>
            </Button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-0 right-0 z-50 flex items-center justify-center space-x-6 md:space-x-12 px-4 pb-safe">
        {/* Sound Toggle */}
              <Button
          variant="ghost"
          size="icon"
          className={`w-12 h-12 md:w-14 md:h-14 rounded-full transition-all duration-300 border ${isSoundEnabled ? 'bg-background border-border text-foreground hover:bg-accent' : 'bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20'}`}
          onClick={handleToggleSound}
        >
          {isSoundEnabled ? <Volume2 className="w-5 h-5 md:w-6 md:h-6" /> : <VolumeX className="w-5 h-5 md:w-6 md:h-6" />}
              </Button>

        {/* Mic Toggle (Main Action) */}
                <Button
          variant="default"
          size="icon"
          className={`w-16 h-16 md:w-20 md:h-20 rounded-full shadow-lg transition-all duration-500 transform hover:scale-105 ${isRecording
            ? 'bg-destructive hover:bg-destructive/90 shadow-destructive/20'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          onClick={handleStartStopRecording}
        >
          {isRecording ? (
            <MicOff className="w-6 h-6 md:w-8 md:h-8" />
          ) : (
            <Mic className="w-6 h-6 md:w-8 md:h-8" />
          )}
                </Button>

        {/* End Call (Exit) */}
                <Button
          variant="ghost"
          size="icon"
          className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 hover:text-destructive transition-all duration-300"
          onClick={() => navigate('/')}
        >
          <PhoneOff className="w-5 h-5 md:w-6 md:h-6" />
                </Button>
      </div>
    </div>
  );
};

export default VoiceCallNew;