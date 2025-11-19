import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Loader2,
  ChefHat
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { OpenAIService } from '@/services/openai';
import { OpenAITTS } from '@/services/openai-tts';
import { Recipe } from '@/types/recipe';
import { RecipeDisplay } from './recipe-display';
import { AudioUtils } from '@/lib/audio-utils';
import { BrowserCompatibility } from '@/lib/browser-compatibility';

interface VoiceCallProps {
  className?: string;
}

interface CallState {
  isConnected: boolean;
  isRecording: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  isContinuousMode: boolean;
  error: string | null;
  generatedRecipe: Recipe | null;
}

export const VoiceCall: React.FC<VoiceCallProps> = ({ className = '' }) => {
  const [callState, setCallState] = useState<CallState>({
    isConnected: false,
    isRecording: false,
    isPlaying: false,
    isLoading: false,
    isContinuousMode: true, // Постоянный режим включен по умолчанию
    error: null,
    generatedRecipe: null
  });

  const [browserSupported, setBrowserSupported] = useState<boolean>(true);
  const [browserCapabilities, setBrowserCapabilities] = useState<any>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const callStartRef = useRef<number | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const isConnectedRef = useRef<boolean>(false);
  const isStartingRecordingRef = useRef<boolean>(false);

  // Проверка совместимости браузера
  useEffect(() => {
    const capabilities = BrowserCompatibility.getCapabilities();
    const requirements = BrowserCompatibility.checkMinimumRequirements();

    setBrowserCapabilities(capabilities);
    setBrowserSupported(requirements.passed);

    console.log('🌐 [Browser] Проверка совместимости браузера:', {
      capabilities,
      requirements,
      browserInfo: BrowserCompatibility.getBrowserInfo()
    });

    if (!requirements.passed) {
      console.warn('⚠️ [Browser] Обнаружены проблемы совместимости:', requirements.issues);
      toast({
        title: "Предупреждение о совместимости",
        description: `Некоторые функции могут не работать: ${requirements.issues.join(', ')}`,
        variant: "destructive",
      });
    }
  }, []);

  // Синхронизируем ref с состоянием воспроизведения и подключения
  useEffect(() => {
    isPlayingRef.current = callState.isPlaying;
  }, [callState.isPlaying]);

  useEffect(() => {
    isConnectedRef.current = callState.isConnected;
  }, [callState.isConnected]);

  // Инициализация распознавания речи
  useEffect(() => {
    const caps = BrowserCompatibility.getCapabilities();

    if (!caps.speechRecognition && !caps.webkitSpeechRecognition) {
      console.warn('🎤 [Voice Call] Speech Recognition API не поддерживается в этом браузере');
      return;
    }

    try {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false; // Однократное распознавание для быстрого отклика
      recognitionRef.current.interimResults = true; // Промежуточные результаты для возможности прерывания
      recognitionRef.current.lang = 'ru-RU';
      recognitionRef.current.maxAlternatives = 1; // Только лучший результат

      recognitionRef.current.onspeechstart = () => {
        console.log('🎤 [Voice Call] ===== ОБНАРУЖЕНА РЕЧЬ ПОЛЬЗОВАТЕЛЯ =====');
        console.log('🚫 [Voice Call] Проверяем, нужно ли прервать TTS...');

        // Автоматически прерываем TTS если пользователь начинает говорить
        if (isPlayingRef.current) {
          console.log('🚫 [Voice Call] Автоматически прерываем TTS при обнаружении речи пользователя');
          OpenAITTS.stop();
          setCallState(prev => ({ ...prev, isPlaying: false }));
          console.log('✅ [Voice Call] TTS прерван автоматически');

          // Автоматически начинаем слушать пользователя после прерывания TTS
          console.log('🎧 [Voice Call] Автоматически начинаем слушать после прерывания TTS');
          setTimeout(() => startRecording(), 300); // Увеличенная задержка для плавного перехода
        } else {
          console.log('ℹ️ [Voice Call] TTS не воспроизводится, прерывание не требуется');
        }
      };

      recognitionRef.current.onresult = (event: any) => {
        console.log('🎯 [Voice Call] ===== РЕЗУЛЬТАТ РАСПОЗНАВАНИЯ РЕЧИ =====');
        console.log('📝 [Voice Call] Сырые данные события:', event);

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        console.log('🗣️ [Voice Call] Распознанный текст:', {
          final: finalTranscript,
          interim: interimTranscript,
          isFinal: !!finalTranscript,
          timestamp: new Date().toISOString()
        });

        // Обрабатываем только финальный результат
        if (finalTranscript.trim()) {
          console.log('🔄 [Voice Call] Передаем финальный текст в обработчик сообщений');
          handleUserMessage(finalTranscript.trim());
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('❌ [Voice Call] ===== ОШИБКА РАСПОЗНАВАНИЯ РЕЧИ =====');
        console.error('🔍 [Voice Call] Детали ошибки:', {
          error: event.error,
          type: event.type,
          timestamp: new Date().toISOString()
        });
        
        setCallState(prev => ({ ...prev, isRecording: false, error: event.error }));
        isStartingRecordingRef.current = false; // Сбрасываем флаг при ошибке
      };

      recognitionRef.current.onend = () => {
        console.log('🏁 [Voice Call] ===== РАСПОЗНАВАНИЕ РЕЧИ ЗАВЕРШЕНО =====');
        console.log('⏱️ [Voice Call] Время завершения:', new Date().toISOString());
        setCallState(prev => ({ ...prev, isRecording: false }));
        isStartingRecordingRef.current = false; // Сбрасываем флаг при завершении
      };

      console.log('✅ [Voice Call] Распознавание речи инициализировано успешно');
    } catch (error) {
      console.error('❌ [Voice Call] Ошибка инициализации распознавания речи:', error);
      setCallState(prev => ({
        ...prev,
        error: 'Ошибка инициализации распознавания речи. Возможно, браузер не поддерживает эту функцию.'
      }));
    }
  }, []);

  // Stop TTS and clear timer on unmount
  useEffect(() => {
    return () => {
      console.log('🛑 [Voice Call] Component unmounted, stopping TTS and timer');
      OpenAITTS.stop();
      if (callTimerRef.current) clearTimeout(callTimerRef.current);
    };
  }, []);

  // Проверяем, является ли запрос запросом рецепта
  const isRecipeRequest = (text: string): boolean => {
    const recipeKeywords = [
      'рецепт', 'приготовить', 'сварить', 'пожарить', 'запечь', 'сделать',
      'как приготовить', 'как сделать', 'как сварить', 'рецепт на',
      'рецепт приготовления', 'готовим', 'приготовление'
    ];

    const lowerText = text.toLowerCase();
    return recipeKeywords.some(keyword => lowerText.includes(keyword));
  };

  const handleUserMessage = async (text: string) => {
    console.log('🔍 [Voice Call] handleUserMessage вызвана с аргументом:', {
      type: typeof text,
      isString: typeof text === 'string',
      value: text,
      length: text ? text.length : 'undefined'
    });

    if (!text || typeof text !== 'string') {
      console.error('❌ [Voice Call] handleUserMessage получил некорректный аргумент:', text);
      return;
    }

    if (!text.trim()) {
      console.log('⚠️ [Voice Call] Получен пустой текст, пропускаем обработку');
      return;
    }

    console.log('🗣️ [Voice Call] ===== ОБРАБОТКА СООБЩЕНИЯ ПОЛЬЗОВАТЕЛЯ =====');
    console.log('📝 [Voice Call] Текст сообщения:', {
      text: text,
      length: text.length,
      timestamp: new Date().toISOString()
    });

    // Проверяем, является ли запрос запросом рецепта
    const shouldGenerateRecipe = isRecipeRequest(text);

    console.log('🔍 [Voice Call] Анализ запроса:', {
      isRecipeRequest: shouldGenerateRecipe,
      text: text
    });

    try {
      setCallState(prev => ({ ...prev, isLoading: true }));

      console.log('🤖 [Voice Call] Отправляем запрос в OpenAI...');
      const startTime = Date.now();

      let response;

      if (shouldGenerateRecipe) {
        // Генерируем подробный рецепт без изображений
        console.log('🍳 [Voice Call] Обнаружен запрос рецепта - генерируем подробный рецепт');
        response = await OpenAIService.generateRecipe([text], undefined, undefined, false);
      } else {
        // Используем chatWithChef для обычного общения с кулинаром
        console.log('💬 [Voice Call] Обычный разговор с кулинаром');
        const chatResponse = await OpenAIService.chatWithChef(text, undefined, []);
        response = chatResponse.content;
        console.log('✅ [Voice Call] Ответ от chatWithChef:', {
          type: typeof response,
          isString: typeof response === 'string',
          length: response ? response.length : 'undefined',
          usage: chatResponse.usage,
          value: response
        });
      }

      const responseTime = Date.now() - startTime;

      console.log('✅ [Voice Call] Ответ от OpenAI получен:', {
        responseTime: responseTime + 'ms',
        hasContent: !!response.content,
        hasTitle: !!response.title,
        hasInstructions: !!(response as any).instructions,
        timestamp: new Date().toISOString()
      });

      let responseText: string;

      if (shouldGenerateRecipe && (response as any).instructions) {
        // Это рецепт с инструкциями - формируем подробное текстовое описание для озвучивания
        const recipe = response as any;
        responseText = `Отлично! Я подготовил рецепт "${recipe.title}". ${recipe.description}\n\n`;

        recipe.instructions.forEach((instruction: string, index: number) => {
          responseText += `Шаг ${index + 1}: ${instruction}\n\n`;
        });

        if (recipe.tips) {
          responseText += `Полезные советы: ${recipe.tips}`;
        }

        console.log('🍳 [Voice Call] Сформирован текстовый рецепт для озвучивания');

        // Сохраняем рецепт с изображениями для отображения в UI
        setCallState(prev => ({ ...prev, generatedRecipe: recipe }));
      } else {
        // Обычный текстовый ответ
        responseText = typeof response === 'string'
          ? response
          : (response.content || response.description || 'Я готов помочь с кулинарными вопросами!');
      }

      // Убеждаемся, что responseText всегда является строкой
      const finalText = typeof responseText === 'string' ? responseText : String(responseText);

      console.log('📄 [Voice Call] Текст ответа:', {
        text: finalText.substring(0, 100) + (finalText.length > 100 ? '...' : ''),
        length: finalText.length,
        type: typeof finalText,
        isRecipe: shouldGenerateRecipe
      });

      // Воспроизводим ответ через TTS
      console.log('🔊 [Voice Call] Начинаем воспроизведение через OpenAI TTS...');
      console.log('🔍 [Voice Call] Проверяем тип finalText:', {
        type: typeof finalText,
        isString: typeof finalText === 'string',
        value: finalText
      });

      if (!finalText || typeof finalText !== 'string' || finalText.trim().length === 0) {
        console.error('❌ [Voice Call] finalText не является корректной строкой:', finalText);
        throw new Error('Некорректный текст для озвучки');
      }

      await speakText(finalText.trim());

    } catch (error) {
      console.error('❌ [Voice Call] ===== ОШИБКА ОБРАБОТКИ СООБЩЕНИЯ =====');
      console.error('🔍 [Voice Call] Детали ошибки:', error);

      // В случае ошибки говорим короткое сообщение
      const errorMessage = "Извините, я не расслышала. Повторите, пожалуйста.";
      try {
        await speakText(errorMessage);
      } catch (ttsError) {
        console.error('❌ [Voice Call] Ошибка TTS при сообщении об ошибке:', ttsError);
        toast({
          title: "Ошибка обработки",
          description: "Не удалось обработать ваше сообщение",
          variant: "destructive",
        });
      }
    } finally {
      setCallState(prev => ({ ...prev, isLoading: false }));
      console.log('🏁 [Voice Call] Состояние загрузки сброшено');
    }
  };

  const speakText = async (text: string | any) => {
    try {
      // Убеждаемся, что text является строкой
      let textToSpeak: string;
      if (typeof text === 'string') {
        textToSpeak = text;
      } else if (typeof text === 'object' && text !== null) {
        // Если передан объект, пытаемся извлечь текстовое содержимое
        textToSpeak = text.content || text.description || text.text || String(text);
      } else {
        textToSpeak = String(text || '');
      }

      console.log('🔊 [Voice Call] ===== НАЧАЛО СИНТЕЗА РЕЧИ =====');
      console.log('📝 [Voice Call] Текст для синтеза:', {
        originalType: typeof text,
        textLength: textToSpeak.length,
        textPreview: textToSpeak.substring(0, 100) + (textToSpeak.length > 100 ? '...' : ''),
        fullText: textToSpeak
      });

      // Используем конвертированный текст
      text = textToSpeak;
      
      setCallState(prev => ({ ...prev, isPlaying: true }));
      
      const startTime = Date.now();
      console.log('⏱️ [Voice Call] Время начала синтеза:', new Date().toISOString());
      
      // Разделяем текст на предложения для параллельной обработки
      const sentences = splitIntoSentences(text);
      console.log('📝 [Voice Call] Разделено на предложения:', sentences.length, 'предложений');

      if (sentences.length <= 1) {
        // Если только одно предложение или текст не удалось разделить, используем обычный метод
        console.log('📝 [Voice Call] Используем обычный синтез (одно предложение)');
      await OpenAITTS.speak(text, 'alloy');
      } else {
        // Параллельная обработка предложений
        console.log('⚡ [Voice Call] Запускаем параллельную обработку предложений');

        // Генерируем аудио для всех предложений параллельно
        const audioPromises = sentences.map((sentence, index) => {
          console.log(`🎵 [Voice Call] Генерируем аудио для предложения ${index + 1}:`, sentence.substring(0, 50) + '...');
          return OpenAITTS.generateAudio(sentence.trim(), 'alloy');
        });

        // Ждем завершения всех генераций
        const audioResults = await Promise.all(audioPromises);
        console.log('✅ [Voice Call] Все аудио файлы сгенерированы');

        // Воспроизводим аудио по порядку
        for (let i = 0; i < audioResults.length; i++) {
          const { blob } = audioResults[i];
          console.log(`▶️ [Voice Call] Воспроизводим предложение ${i + 1}/${audioResults.length}`);

          await new Promise<void>((resolve, reject) => {
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);

            audio.onended = () => {
              URL.revokeObjectURL(audioUrl);
              resolve();
            };

            audio.onerror = (error) => {
              URL.revokeObjectURL(audioUrl);
              reject(error);
            };

            audio.play().catch(reject);
          });
        }

        console.log('✅ [Voice Call] Все предложения воспроизведены');
      }
      
      const duration = Date.now() - startTime;
      console.log('✅ [Voice Call] ===== СИНТЕЗ РЕЧИ ЗАВЕРШЕН =====');
      console.log(`⏱️ [Voice Call] Общее время синтеза: ${duration}ms`);
      console.log('📊 [Voice Call] Статистика:', {
        textLength: text.length,
        sentencesCount: sentences.length,
        synthesisTime: duration + 'ms',
        timestamp: new Date().toISOString()
      });
      
      // Если включен постоянный режим, автоматически начинаем слушать после ответа
      if (callState.isContinuousMode) {
        console.log('🔄 [Voice Call] Постоянный режим: автоматически начинаем слушать');
        setTimeout(() => startRecording(), 300); // Минимальная пауза для плавного перехода
      }

    } catch (error) {
      console.error('❌ [Voice Call] ===== ОШИБКА СИНТЕЗА РЕЧИ =====');
      console.error('🔍 [Voice Call] Детали ошибки:', error);
      toast({
        title: "Ошибка воспроизведения",
        description: "Не удалось воспроизвести ответ через OpenAI TTS",
        variant: "destructive",
      });
    } finally {
      setCallState(prev => ({ ...prev, isPlaying: false }));
      console.log('🏁 [Voice Call] Состояние воспроизведения сброшено');
    }
  };

  // Функция для разделения текста на предложения
  const splitIntoSentences = (text: string): string[] => {
    // Разделяем по точкам, восклицательным и вопросительным знакам
    // Сохраняем знаки препинания в предложениях
    const sentences = text.split(/(?<=[.!?])\s+/);

    // Фильтруем пустые строки и слишком короткие предложения
    return sentences
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length > 3) // Игнорируем предложения короче 3 символов
      .map(s => {
        // Убеждаемся, что предложение заканчивается на знак препинания
        if (!/[.!?]$/.test(s)) {
          s += '.';
        }
        return s;
      });
  };

  const startCall = async () => {
    try {
      console.log('📞 [TTS] Начинаем голосовой звонок...');
      setCallState(prev => ({ ...prev, isLoading: true }));

      // Проверяем совместимость браузера
      const caps = BrowserCompatibility.getCapabilities();
      if (!caps.getUserMedia) {
        throw new Error('Ваш браузер не поддерживает доступ к микрофону. Попробуйте обновить браузер или использовать Chrome/Edge.');
      }
      
      // Проверяем поддержку микрофона
      console.log('🎤 [TTS] Проверяем доступ к микрофону...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Останавливаем сразу
      console.log('✅ [TTS] Доступ к микрофону получен');
      
      setCallState(prev => ({ 
        ...prev, 
        isConnected: true, 
        isLoading: false,
        error: null 
      }));
      
      // Приветственное сообщение для естественного общения с кулинаром
      const welcomeText = "Здравствуйте! Я готова обсудить с вами кулинарные вопросы. Чем могу помочь?";
      console.log('👋 [Voice Call] Воспроизводим приветствие:', welcomeText);

      // Воспроизводим приветствие
      await speakText(welcomeText);

      // Если включен постоянный режим, автоматически начинаем слушать после приветствия
      if (callState.isContinuousMode) {
        console.log('🔄 [Voice Call] Постоянный режим: начинаем слушать после приветствия');
        setTimeout(() => startRecording(), 500); // Уменьшаем задержку для более быстрого старта
      }
      
      callStartRef.current = Date.now();
      // schedule 10-minute limit
      callTimerRef.current = window.setTimeout(async () => {
        const limitMessage = 'Время общения превысило десять минут. Если у вас будут вопросы, обращайтесь!';
        console.log('⏰ [Voice Call] 10-minute limit reached, speaking final message');
        await speakText(limitMessage);
        endCall();
      }, 10 * 60 * 1000);
      
      console.log('🎉 [TTS] Голосовой звонок успешно начат');
      toast({
        title: "📞 Звонок начат",
        description: "Говорите в микрофон для общения с AI поваром",
      });
      
    } catch (error) {
      console.error('❌ [TTS] Ошибка начала звонка:', error);
      setCallState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Не удалось получить доступ к микрофону' 
      }));
      toast({
        title: "Ошибка микрофона",
        description: "Разрешите доступ к микрофону для голосового общения",
        variant: "destructive",
      });
    }
  };

  const endCall = () => {
    console.log('🛑 [Voice Call] endCall invoked, stopping TTS and clearing timer');
    OpenAITTS.stop();
    if (callTimerRef.current) {
      clearTimeout(callTimerRef.current);
      callTimerRef.current = null;
    }
    console.log('📞 [TTS] Завершаем голосовой звонок...');
    
    // Останавливаем распознавание речи
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    // Останавливаем TTS
    // OpenAITTS.stop(); // This line is now handled by the useEffect cleanup
    
    setCallState({
      isConnected: false,
      isRecording: false,
      isPlaying: false,
      isLoading: false,
      isContinuousMode: true, // Постоянный режим всегда остается включенным
      error: null,
      generatedRecipe: null
    });
    
    console.log('✅ [TTS] Голосовой звонок завершен');
    toast({
      title: "📞 Звонок завершен",
      description: "Спасибо за общение с AI поваром!",
    });
  };

  const startRecording = useCallback(async () => {
    console.log('🎤 [Voice Call] startRecording вызвана, текущее состояние:', {
      isConnected: isConnectedRef.current,
      isRecording: callState.isRecording,
      isPlaying: callState.isPlaying,
      isLoading: callState.isLoading,
      isStartingRecording: isStartingRecordingRef.current
    });

    if (!isConnectedRef.current) {
      console.log('⚠️ [Voice Call] Попытка записи без подключения - отменяем');
      return;
    }

    // Предотвращаем двойной запуск распознавания речи
    if (isStartingRecordingRef.current) {
      console.log('⚠️ [Voice Call] Распознавание уже запускается - пропускаем');
      return;
    }

    isStartingRecordingRef.current = true;

    try {
      console.log('🎤 [Voice Call] ===== НАЧАЛО ЗАПИСИ РЕЧИ =====');
      console.log('🔍 [Voice Call] Проверяем состояние распознавания:', {
        isConnected: isConnectedRef.current,
        isRecording: callState.isRecording,
        isLoading: callState.isLoading
      });

      // Проверяем, инициализировано ли распознавание речи
      if (!recognitionRef.current) {
        console.error('❌ [Voice Call] Распознавание речи не инициализировано');
        isStartingRecordingRef.current = false;
        return;
      }

      console.log('🔍 [Voice Call] Текущее состояние recognitionRef:', {
        exists: !!recognitionRef.current,
        hasStart: typeof recognitionRef.current.start === 'function',
        hasStop: typeof recognitionRef.current.stop === 'function',
        continuous: recognitionRef.current.continuous,
        interimResults: recognitionRef.current.interimResults,
        lang: recognitionRef.current.lang
      });

      // Останавливаем предыдущую запись если она активна
      if (callState.isRecording) {
        console.log('🔄 [Voice Call] Останавливаем предыдущую запись перед началом новой');
        stopRecording();
        // Увеличиваем паузу для корректной остановки
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Дополнительная проверка состояния recognition
      if (recognitionRef.current) {
        try {
          // Проверяем, можем ли мы начать новую сессию
          console.log('🔍 [Voice Call] Состояние recognition перед запуском:', {
            continuous: recognitionRef.current.continuous,
            interimResults: recognitionRef.current.interimResults,
            lang: recognitionRef.current.lang,
            serviceURI: recognitionRef.current.serviceURI
          });

          // Пытаемся вызвать abort() сначала, чтобы сбросить состояние
          if (typeof recognitionRef.current.abort === 'function') {
            recognitionRef.current.abort();
            console.log('🔄 [Voice Call] Вызван abort() для сброса состояния');
            // Увеличиваем задержку после abort
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (abortError) {
          console.log('⚠️ [Voice Call] Abort не удался (возможно, нормальное поведение):', abortError.message);
        }
      }

      // Останавливаем текущее воспроизведение TTS если пользователь начинает говорить
      if (callState.isPlaying) {
        console.log('🚫 [Voice Call] Прерываем текущее воспроизведение TTS при начале записи');
        OpenAITTS.stop();
        setCallState(prev => ({ ...prev, isPlaying: false }));
        toast({
          title: "🎤 Речь прервана",
          description: "Ваша речь важнее! Говорите...",
        });
      }

      // Дополнительная проверка состояния recognition перед запуском
      try {
        // Проверяем состояние объекта перед запуском
        if (recognitionRef.current && typeof recognitionRef.current.start === 'function') {
          console.log('🔍 [Voice Call] Состояние recognition перед запуском:', {
            continuous: recognitionRef.current.continuous,
            interimResults: recognitionRef.current.interimResults,
            lang: recognitionRef.current.lang,
            serviceURI: recognitionRef.current.serviceURI,
            grammars: recognitionRef.current.grammars
          });

          // Дополнительная задержка для полной инициализации
          await new Promise(resolve => setTimeout(resolve, 100));

          // Финальная проверка состояния перед запуском
          console.log('🔍 [Voice Call] Финальная проверка состояния перед запуском');
          try {
            recognitionRef.current.start();
          } catch (startError) {
            if (startError.name === 'InvalidStateError') {
              console.log('⚠️ [Voice Call] InvalidStateError при запуске - ждем и повторяем');
              await new Promise(resolve => setTimeout(resolve, 200));
              recognitionRef.current.start();
            } else {
              throw startError;
            }
          }
      setCallState(prev => ({ ...prev, isRecording: true }));
          isStartingRecordingRef.current = false; // Сбрасываем флаг после успешного запуска

      console.log('✅ [Voice Call] Запись речи начата');
      console.log('⏱️ [Voice Call] Время начала записи:', new Date().toISOString());
        } else {
          throw new Error('Recognition object is not properly initialized');
        }
      } catch (recognitionError: any) {
        console.error('❌ [Voice Call] ===== ОШИБКА НАЧАЛА ЗАПИСИ =====');
        console.error('🔍 [Voice Call] Детали ошибки:', recognitionError);

        // Сбрасываем состояние при ошибке
        setCallState(prev => ({ ...prev, isRecording: false, error: recognitionError.message }));
        isStartingRecordingRef.current = false;

        // Если это ошибка состояния, пересоздаем объект recognition
        if (recognitionError.name === 'InvalidStateError') {
          console.log('🔄 [Voice Call] InvalidStateError - пересоздаем объект recognition');

          try {
            // Сначала пытаемся остановить старый объект, если он существует
            if (recognitionRef.current) {
              try {
                recognitionRef.current.stop();
                recognitionRef.current = null;
                console.log('🛑 [Voice Call] Старый объект recognition остановлен');
              } catch (stopError) {
                console.log('⚠️ [Voice Call] Не удалось остановить старый recognition:', stopError);
              }
            }

            // Ждем полной очистки
            setTimeout(() => {
              try {
                // Полностью пересоздаем объект распознавания речи
                const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
                if (SpeechRecognition) {
                  const newRecognition = new SpeechRecognition();
                  console.log('🆕 [Voice Call] Создан новый объект recognition');

                  // Переустанавливаем все обработчики событий
                  newRecognition.continuous = true;
                  newRecognition.interimResults = true;
                  newRecognition.lang = 'ru-RU';

                  newRecognition.onspeechstart = () => {
                    console.log('🎤 [Voice Call] ===== ОБНАРУЖЕНА РЕЧЬ ПОЛЬЗОВАТЕЛЯ =====');
                    console.log('🚫 [Voice Call] Проверяем, нужно ли прервать TTS...');

                    if (isPlayingRef.current) {
                      console.log('🚫 [Voice Call] Автоматически прерываем TTS при обнаружении речи пользователя');
                      OpenAITTS.stop();
                      setCallState(prev => ({ ...prev, isPlaying: false }));
                      console.log('✅ [Voice Call] TTS прерван автоматически');

                      console.log('🎧 [Voice Call] Автоматически начинаем слушать после прерывания TTS');
                      setTimeout(() => startRecording(), 500); // Увеличенная задержка
                    } else {
                      console.log('ℹ️ [Voice Call] TTS не воспроизводится, прерывание не требуется');
                    }
                  };

                  newRecognition.onresult = (event: any) => {
                    console.log('🎯 [Voice Call] ===== РЕЗУЛЬТАТ РАСПОЗНАВАНИЯ РЕЧИ =====');

                    let interimTranscript = '';
                    let finalTranscript = '';

                    for (let i = event.resultIndex; i < event.results.length; i++) {
                      const transcript = event.results[i][0].transcript;
                      if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                      } else {
                        interimTranscript += transcript;
                      }
                    }

                    console.log('🗣️ [Voice Call] Распознанный текст:', {
                      final: finalTranscript,
                      interim: interimTranscript,
                      isFinal: !!finalTranscript,
                      timestamp: new Date().toISOString()
                    });

                    if (finalTranscript.trim()) {
                      console.log('🔄 [Voice Call] Передаем финальный текст в обработчик сообщений');
                      handleUserMessage(finalTranscript.trim());
                    }
                  };

                  newRecognition.onerror = (event: any) => {
                    console.error('❌ [Voice Call] ===== ОШИБКА РАСПОЗНАВАНИЯ РЕЧИ =====');
                    console.error('🔍 [Voice Call] Детали ошибки:', {
                      error: event.error,
                      type: event.type,
                      timestamp: new Date().toISOString()
                    });

                    setCallState(prev => ({ ...prev, isRecording: false, error: event.error }));
                    isStartingRecordingRef.current = false;
                  };

                  newRecognition.onend = () => {
                    console.log('🏁 [Voice Call] ===== РАСПОЗНАВАНИЕ РЕЧИ ЗАВЕРШЕНО =====');
                    console.log('⏱️ [Voice Call] Время завершения:', new Date().toISOString());
                    setCallState(prev => ({ ...prev, isRecording: false }));
                    isStartingRecordingRef.current = false;
                  };

                  // Устанавливаем новый объект
                  recognitionRef.current = newRecognition;
                  console.log('✅ [Voice Call] Объект recognition пересоздан и установлен');

                  // Проверяем состояние объекта перед запуском
                  setTimeout(() => {
                    if (isConnectedRef.current && recognitionRef.current) {
                      console.log('🔍 [Voice Call] Проверяем состояние нового recognition перед запуском');

                      // Пытаемся запустить с дополнительными проверками
                      try {
                        console.log('🚀 [Voice Call] Запускаем новый recognition через 1000ms...');
                        setTimeout(() => {
                          if (isConnectedRef.current && recognitionRef.current) {
                            startRecording();
                          }
                        }, 1000);
                      } catch (finalError) {
                        console.error('❌ [Voice Call] Ошибка при финальном запуске:', finalError);
                        isStartingRecordingRef.current = false;
                      }
                    }
                  }, 300);
                } else {
                  console.error('❌ [Voice Call] SpeechRecognition API недоступен');
                  isStartingRecordingRef.current = false;
                }
              } catch (recreateError) {
                console.error('❌ [Voice Call] Ошибка пересоздания recognition:', recreateError);
                isStartingRecordingRef.current = false;
              }
            }, 150); // Задержка для полной остановки старого объекта
          } catch (recreateError) {
            console.error('❌ [Voice Call] Ошибка пересоздания recognition:', recreateError);
            isStartingRecordingRef.current = false;
          }
        }
      }
    } catch (error) {
      console.error('❌ [Voice Call] ===== ОШИБКА НАЧАЛА ЗАПИСИ =====');
      console.error('🔍 [Voice Call] Детали ошибки:', error);
      isStartingRecordingRef.current = false; // Сбрасываем флаг при ошибке
    }
  }, [callState.isConnected]);

  const stopRecording = useCallback(() => {
    console.log('🛑 [Voice Call] ===== ОСТАНОВКА ЗАПИСИ РЕЧИ =====');
    console.log('⏱️ [Voice Call] Время остановки записи:', new Date().toISOString());
    console.log('🔍 [Voice Call] Состояние перед остановкой:', {
      recognitionExists: !!recognitionRef.current,
      isRecording: callState.isRecording,
      isStartingRecording: isStartingRecordingRef.current
    });

    if (recognitionRef.current) {
      try {
      recognitionRef.current.stop();
      console.log('✅ [Voice Call] Распознавание речи остановлено');
      } catch (stopError) {
        console.error('❌ [Voice Call] Ошибка при остановке recognition:', stopError);
      }
    } else {
      console.log('⚠️ [Voice Call] Распознавание речи не было инициализировано');
    }

    setCallState(prev => ({ ...prev, isRecording: false }));
    isStartingRecordingRef.current = false; // Сбрасываем флаг при остановке
    console.log('🏁 [Voice Call] Состояние записи сброшено');
  }, [callState.isRecording]);


  // Показываем предупреждение если браузер не поддерживается
  if (!browserSupported && browserCapabilities) {
    const caps = browserCapabilities;
    const missingFeatures = [];

    if (!caps.getUserMedia) missingFeatures.push('микрофон');
    if (!caps.speechRecognition && !caps.webkitSpeechRecognition) missingFeatures.push('распознавание речи');
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
                Рекомендуется использовать современный браузер: Chrome, Edge, Firefox или Safari.
              </p>
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                <strong>Информация о браузере:</strong><br/>
                {BrowserCompatibility.getBrowserInfo().isChrome && 'Chrome'}
                {BrowserCompatibility.getBrowserInfo().isFirefox && 'Firefox'}
                {BrowserCompatibility.getBrowserInfo().isSafari && 'Safari'}
                {BrowserCompatibility.getBrowserInfo().isEdge && 'Edge'}
                {BrowserCompatibility.getBrowserInfo().isOpera && 'Opera'}
                {' '}v{BrowserCompatibility.getBrowserInfo().version}
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
        {/* Avatar */}
        <div className="relative">
          <div className="w-32 h-32 bg-gradient-primary rounded-full flex items-center justify-center transition-all duration-300">
            <ChefHat className="w-16 h-16 text-primary-foreground" />
          </div>
          
          {/* Status indicator */}
          <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-4 border-background ${
            callState.isConnected ? 'bg-green-500' : 'bg-gray-400'
          }`} />
        </div>

        {/* Status Text - убрано */}

        {/* Messages - убрано */}

        {/* Controls */}
        <div className="flex items-center gap-4">
          {!callState.isConnected ? (
            <Button
              onClick={startCall}
              disabled={callState.isLoading}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3"
            >
              {callState.isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Подключение...
                </>
              ) : (
                <>
                  <Phone className="w-5 h-5 mr-2" />
                  Позвонить
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={endCall}
              variant="destructive"
              size="lg"
              className="px-6 py-3"
            >
              <PhoneOff className="w-5 h-5 mr-2" />
              Завершить звонок
            </Button>
          )}
        </div>

        {/* Generated Recipe Display */}
        {callState.generatedRecipe && (
          <div className="w-full max-w-4xl">
            <RecipeDisplay recipe={callState.generatedRecipe} />
          </div>
        )}

        {/* Error Display - убрано */}
      </div>
    </div>
  );
};
