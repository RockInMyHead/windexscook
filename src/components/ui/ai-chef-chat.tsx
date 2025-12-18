import React, { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { Button } from './button';
import { Input } from './input';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { Badge } from './badge';
import { ScrollArea } from './scroll-area';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Loader2,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Mic,
  Square,
  Volume2,
  Trash2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { OpenAIService } from '@/services/openai';
import { OpenAITTS } from '@/services/openai-tts';
import { OpenAISTT } from '@/services/openai-stt';
import { useUser } from '@/contexts/UserContext';
import { AudioUtils } from '@/lib/audio-utils';
import { BrowserCompatibility } from '@/lib/browser-compatibility';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isTyping?: boolean;
  isAudio?: boolean;
  isStreaming?: boolean;
}

interface AiChefChatProps {
  className?: string;
}


// Функция для извлечения названия блюда из запроса
export const AiChefChat: React.FC<AiChefChatProps> = ({ className = '' }) => {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Готов помочь с кулинарными вопросами! Что хотите приготовить?',
      role: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioSupported, setAudioSupported] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [isTTSSynthesizing, setIsTTSSynthesizing] = useState(false);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [currentSpeakingMessageId, setCurrentSpeakingMessageId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Проверяем, является ли запрос запросом на показ фото блюда
  const isImageRequest = (text: string): boolean => {
    const lowerText = text.toLowerCase();

    const imageKeywords = [
      'покажи фото', 'покажите фото', 'покажи изображение', 'покажите изображение',
      'фото блюда', 'изображение блюда', 'как выглядит', 'покажи как выглядит',
      'визуально', 'визуализация', 'нарисуй', 'нарисуйте', 'изобрази', 'изобразите',
      'генерируй фото', 'сгенерируй фото', 'создай изображение'
    ];

    return imageKeywords.some(keyword => lowerText.includes(keyword));
  };

  // Массив "мыслей" AI для визуализации
  const thinkingSteps = [
    "Анализирую ваш запрос...",
    "Подбираю подходящие ингредиенты...",
    "Составляю пошаговый план...",
    "Генерирую изображения для шагов...",
    "Учитываю ваши предпочтения...",
    "Формирую детальный ответ...",
    "Проверяю рецепт на точность..."
  ];

  // Демо-ответы для случаев когда API недоступен
  const getDemoResponse = (message: string): string => {
    const lowerMessage = message.toLowerCase();

    // Приветствия
    if (lowerMessage.includes('привет') || lowerMessage.includes('здравствуй') || lowerMessage.includes('hi') || lowerMessage.includes('hello')) {
      return 'Привет! Я - ваш виртуальный шеф-повар. Расскажите, что вы хотели бы приготовить, и я помогу с рецептом!';
    }

    // Вопросы о кулинарии
    if (lowerMessage.includes('как') && (lowerMessage.includes('приготовить') || lowerMessage.includes('сделать'))) {
      return 'Я вижу, что вы спрашиваете о приготовлении. В демо-режиме я могу дать общие советы. Для полноценных рецептов с AI нужны API ключи. Попробуйте другие функции приложения - анализ изображений или голосовое управление!';
    }

    // Ингредиенты
    if (lowerMessage.includes('рецепт') || lowerMessage.includes('ингредиент')) {
      return 'Вы спрашиваете о рецепте. В демо-режиме рецепты ограничены. Попробуйте загрузить фото продуктов - функция анализа изображений работает без API ключей!';
    }

    // Общие вопросы
    if (lowerMessage.includes('что') || lowerMessage.includes('как') || lowerMessage.includes('почему')) {
      return 'Интересный вопрос! В демо-режиме я даю базовые советы. Для глубоких консультаций с AI нужно настроить API ключи. А пока попробуйте голосовое управление - оно работает автономно!';
    }

    // По умолчанию
    return 'Спасибо за ваш вопрос! Сейчас приложение работает в демо-режиме, так как не настроен API ключ OpenAI.\n\nДоступные функции:\n• 📸 Анализ фото продуктов\n• 🎤 Голосовое управление\n• 📊 Калькулятор калорий\n\nДля полноценного AI чата настройте API ключ OpenAI в переменных окружения.';
  };

  // Автоскролл к последнему сообщению
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      const shouldAutoScroll = distanceFromBottom <= 120;

      if (autoScrollRef.current !== shouldAutoScroll) {
        autoScrollRef.current = shouldAutoScroll;
      }
    };

    handleScroll();
    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (!viewport || !autoScrollRef.current) return;

    try {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: 'auto'
      });
    } catch {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  // Останавливаем TTS при уходе со страницы
  useEffect(() => {
    const handleBeforeUnload = () => {
      stopTTS();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopTTS();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopTTS(); // Останавливаем TTS при размонтировании компонента
    };
  }, []);

  // Анимация мыслей AI (теперь только для индикации загрузки)
  useEffect(() => {
    if (isThinking) {
      const interval = setInterval(() => {
        setThinkingStep(prev => (prev + 1) % thinkingSteps.length);
      }, 1500); // Меняем мысль каждые 1.5 секунды

      return () => clearInterval(interval);
    }
  }, [isThinking, thinkingSteps]);

  // Проверка поддержки аудио при загрузке
  useEffect(() => {
    const checkAudioSupport = () => {
      const caps = BrowserCompatibility.getCapabilities();
      const hasRecordingSupport = caps.mediaRecorder && caps.getUserMedia;

      console.log('Audio Recording Support Check:');
      console.log('- Capabilities:', caps);
      console.log('- Recording support:', hasRecordingSupport);

      setAudioSupported(hasRecordingSupport);
    };

    checkAudioSupport();
  }, []);


  const sendMessageToAI = async (messageText: string) => {
    setIsLoading(true);
    setIsThinking(true);
    setThinkingStep(0);

    let didStreamResponse = false;

    try {
      // Проверяем, является ли запрос запросом изображения
      const shouldGenerateImage = isImageRequest(messageText);

      console.log('🔍 [AI Chef Chat] Анализ запроса:', {
        isImageRequest: shouldGenerateImage,
        message: messageText
      });

      let response: any;
      let responseText: string;

      if (shouldGenerateImage) {
        // Генерируем изображение блюда
        console.log('🎨 [AI Chef Chat] Обнаружен запрос изображения блюда');

        // Извлекаем название блюда из запроса
        const dishName = messageText.toLowerCase()
          .replace(/покажи(te)? фото/i, '')
          .replace(/покажи(te)? изображение/i, '')
          .replace(/фото блюда/i, '')
          .replace(/изображение блюда/i, '')
          .replace(/как выглядит/i, '')
          .replace(/визуально/i, '')
          .replace(/визуализация/i, '')
          .replace(/нарисуй(te)?/i, '')
          .replace(/изобрази(te)?/i, '')
          .replace(/генерируй(te)? фото/i, '')
          .replace(/сгенерируй(te)? фото/i, '')
          .replace(/создай(te)? изображение/i, '')
          .trim();

        console.log('🎨 [AI Chef Chat] Извлеченное название блюда:', dishName);

        // Генерируем изображение
        const imagePrompt = dishName
          ? `Photorealistic food photography: ${dishName}. Professional culinary photography, beautiful presentation, appetizing appearance, high quality, detailed textures, restaurant quality plating.`
          : `Photorealistic food photography: delicious gourmet dish. Professional culinary photography, beautiful presentation, appetizing appearance, high quality, detailed textures, restaurant quality plating.`;

        try {
          const imageUrl = await OpenAIService.generateImage(imagePrompt);
          responseText = `Вот как может выглядеть${dishName ? ` "${dishName}"` : ' ваше блюдо'}:\n\n![Блюдо](${imageUrl})\n\nНадеюсь, вам понравилось изображение! Если хотите рецепт приготовления, просто спросите.`;
          console.log('✅ [AI Chef Chat] Изображение блюда сгенерировано успешно');
        } catch (imageError) {
          console.error('❌ [AI Chef Chat] Ошибка генерации изображения:', imageError);
          responseText = 'Извините, не удалось сгенерировать изображение блюда. Попробуйте позже или опишите блюдо подробнее.';
        }
      } else {
        // Подготавливаем историю сообщений для контекста
        const messageHistory = messages
          .filter(msg =>
            !(msg.role === 'assistant' && msg.content === 'Готов помочь с кулинарными вопросами! Что хотите приготовить?')
          )
          .map(msg => ({
            role: msg.role,
            content: msg.content
          }));

        console.log('🔍 DEBUG: Sending message history:', messageHistory.length, 'messages');

        // Создаем сообщение для стриминга
        const streamingMessageId = `streaming-${Date.now()}`;
        const streamingMessage: Message = {
          id: streamingMessageId,
          content: '',
          role: 'assistant',
          timestamp: new Date(),
          isStreaming: true
        };

        // Добавляем пустое сообщение для стриминга
        setMessages(prev => [...prev, streamingMessage]);

        // Воспроизводим звук обработки во время генерации ответа (уже вызывается в сервисе)
        // AudioUtils.playProcessingSound();

        // Используем настоящий стриминг от сервера с очередью чанков
        let currentContent = '';
        let chunkQueue: string[] = [];
        let isProcessingQueue = false;

        const processChunkQueue = async () => {
          if (isProcessingQueue || chunkQueue.length === 0) return;
          isProcessingQueue = true;

          while (chunkQueue.length > 0) {
            const chunk = chunkQueue.shift()!;
            console.log('🎯 [Client Streaming] Processing chunk:', chunk.length, 'chars:', JSON.stringify(chunk));

          currentContent += chunk;

            // Используем flushSync для немедленного обновления UI
            flushSync(() => {
          setMessages(prev => prev.map(msg =>
            msg.id === streamingMessageId
              ? { ...msg, content: currentContent }
              : msg
          ));
            });

            // Задержка между чанками для визуального эффекта
            await new Promise(resolve => setTimeout(resolve, 20));
          }

          isProcessingQueue = false;
        };

        const onChunk = (chunk: string) => {
          console.log('📥 [Client Streaming] Received chunk:', chunk.length, 'chars:', JSON.stringify(chunk));
          if (!chunk) return;

          chunkQueue.push(chunk);
          didStreamResponse = true;

          // Запускаем обработку очереди
          processChunkQueue();
        };

        try {
          response = await OpenAIService.chatWithChefStreaming(messageText, user?.healthProfile, messageHistory, onChunk);

          // Убеждаемся, что все оставшиеся чанки обработаны перед завершением
          await new Promise(resolve => {
            const checkQueue = () => {
              if (isProcessingQueue || chunkQueue.length > 0) {
                setTimeout(checkQueue, 50);
              } else {
                resolve(null);
              }
            };
            checkQueue();
          });

          // Завершаем стриминг
          const finalStreamedContent = currentContent.length > 0 ? currentContent : response.content; // без .trim()
          setMessages(prev => prev.map(msg =>
            msg.id === streamingMessageId
              ? { ...msg, content: finalStreamedContent, isStreaming: false }
              : msg
          ));

          responseText = finalStreamedContent;

          // Если ответ пустой, пробуем обычный запрос
          if (!responseText || !responseText.trim()) {
            console.warn('⚠️ [AI Chef Chat] Streaming returned empty response, trying regular request');
            
            // Удаляем пустое стриминговое сообщение
            setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
            didStreamResponse = false;

            // Пробуем обычный запрос
            const regularResponse = await OpenAIService.chatWithChef(messageText, user?.healthProfile, messageHistory);
            responseText = regularResponse.content;
          }
        } catch (streamError) {
          console.error('❌ [AI Chef Chat] Streaming failed, trying regular request:', streamError);
          if (streamError && (streamError as any).response) {
            const err = streamError as any;
            console.error('OpenAI streaming error status:', err.response?.status);
            console.error('OpenAI streaming error data:', err.response?.data);
          }
          
          // Удаляем пустое стриминговое сообщение
          setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
          didStreamResponse = false;

          // Fallback на обычный запрос
          try {
            const regularResponse = await OpenAIService.chatWithChef(messageText, user?.healthProfile, messageHistory);
            responseText = regularResponse.content;
          } catch (fallbackError) {
            throw streamError; // Бросаем оригинальную ошибку стриминга
          }
        }
      }

        // Добавляем ответ только если он не пустой
        if (responseText && responseText.trim()) {
        if (!didStreamResponse) {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            content: responseText,
            role: 'assistant',
            timestamp: new Date()
          }]);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);

      // Определяем тип ошибки
      let useDemoMode = false;
      let errorMessage = 'Произошла ошибка при обработке запроса. Попробуйте еще раз или обратитесь к другим функциям приложения.';

      if (error instanceof Error) {
        const errorText = error.message.toLowerCase();

        if (errorText.includes('недоступны в вашем регионе') || errorText.includes('unsupported_country') || errorText.includes('regional_restriction')) {
          useDemoMode = true; // Используем демо-режим для геоблокировок
        } else if (errorText.includes('api key not configured') || errorText.includes('api key')) {
          useDemoMode = true; // Используем демо-режим если нет API ключей
        } else if (errorText.includes('network') || errorText.includes('подключиться')) {
          errorMessage = 'Проблемы с подключением к интернету. Проверьте соединение и попробуйте еще раз.';
        }
      }

      // Если используем демо-режим, показываем демо-ответ
      if (useDemoMode) {
        const demoResponse = getDemoResponse(messageText);
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            content: demoResponse,
            role: 'assistant',
            timestamp: new Date()
        }]);
      } else {
        // Добавляем сообщение об ошибке
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            content: errorMessage,
            role: 'assistant',
            timestamp: new Date()
        }]);
      }
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage.trim(),
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputMessage.trim();
    setInputMessage('');
    
    // Отправляем сообщение AI
    await sendMessageToAI(messageText);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Скопировано!",
      description: "Сообщение скопировано в буфер обмена",
    });
  };

  const handleSpeakMessage = async (content: string, messageId?: string) => {
    // Если TTS уже играет для этого сообщения, останавливаем его
    if (isTTSPlaying && currentSpeakingMessageId === messageId) {
      OpenAITTS.stop();
      setIsTTSPlaying(false);
      setCurrentSpeakingMessageId(null);
      return;
    }

    // Останавливаем предыдущий TTS если он играет
    if (isTTSPlaying) {
      OpenAITTS.stop();
      setIsTTSPlaying(false);
      setCurrentSpeakingMessageId(null);
    }

    try {
      setIsTTSSynthesizing(true);
      setCurrentSpeakingMessageId(messageId || null);

      // Преобразуем цифры в слова для TTS
      const contentForTTS = OpenAIService.replaceNumbersWithWords(content);

      // Создаем кастомный аудио элемент для отслеживания состояний
      const audio = await OpenAITTS.speak(contentForTTS, 'alloy');

      // Отслеживаем состояния через события аудио
      if (audio) {
        audio.addEventListener('loadstart', () => {
          setIsTTSSynthesizing(false);
          setIsTTSPlaying(true);
        });

        audio.addEventListener('play', () => {
          setIsTTSSynthesizing(false);
          setIsTTSPlaying(true);
        });

        audio.addEventListener('ended', () => {
          setIsTTSPlaying(false);
          setCurrentSpeakingMessageId(null);
        });

        audio.addEventListener('pause', () => {
          setIsTTSPlaying(false);
        });

        audio.addEventListener('error', () => {
          setIsTTSSynthesizing(false);
          setIsTTSPlaying(false);
          setCurrentSpeakingMessageId(null);
        });
      }

      toast({
        title: "🔊 Воспроизведение",
        description: "Ответ AI озвучен",
      });
    } catch (error: any) {
      console.error('Error speaking message:', error);
      setIsTTSSynthesizing(false);
      setIsTTSPlaying(false);
      setCurrentSpeakingMessageId(null);

      let errorMessage = "Не удалось воспроизвести ответ";
      if (error.message?.includes('TTS API error')) {
        errorMessage = "Озвучка недоступна - настройте API ключ OpenAI";
      } else if (error.message?.includes('401')) {
        errorMessage = "API ключ OpenAI не настроен";
      }

      toast({
        title: "❌ Ошибка воспроизведения",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopTTS = () => {
    OpenAITTS.stop();
    setIsTTSSynthesizing(false);
    setIsTTSPlaying(false);
    setCurrentSpeakingMessageId(null);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: '1',
        content: 'Готов помочь с кулинарными вопросами! Что хотите приготовить?',
        role: 'assistant',
        timestamp: new Date()
      }
    ]);
    toast({
      title: "Чат очищен",
      description: "История разговора удалена. Начинаем новый диалог!",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Простое форматирование сообщений для базовой обработки списков
  const formatMessageContent = (content: string) => {
    if (!content) return content;

    // Обработка списков: превращаем - в • для лучшего отображения
    let formatted = content;

    // Превращаем маркеры списков - в •
    formatted = formatted.replace(/^(\s*)-(\s+)/gm, '$1•$2');

    // Убираем лишние пустые строки между элементами списка
    formatted = formatted.replace(/(\n\s*•[^\n]*)\n\s*\n\s*(?=•)/g, '$1\n');

    return formatted;
  };


  // Функции для работы с аудио
  const startRecording = async () => {
    try {
      // Проверяем поддержку записи аудио
      if (!OpenAISTT.isSupported()) {
        throw new Error('Браузер не поддерживает запись аудио');
      }

      setIsRecording(true);

      toast({
        title: "🎤 Запись началась",
        description: "Говорите в микрофон... Нажмите кнопку еще раз, чтобы остановить.",
      });

      // Запускаем запись аудио
      await OpenAISTT.startRecording();

    } catch (error) {
      console.error('Error starting recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Не удалось получить доступ к микрофону';
      toast({
        title: "Ошибка записи",
        description: errorMessage,
        variant: "destructive",
      });
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!OpenAISTT.isCurrentlyRecording()) {
      return;
    }

    try {
      toast({
        title: "⏳ Обрабатываем запись",
        description: "Распознаем вашу речь...",
      });

      // Останавливаем запись и получаем транскрибацию
      const text = await OpenAISTT.stopRecording();

      if (text && text.trim()) {
        // Добавляем голосовое сообщение в чат
        const audioMessage: Message = {
          id: Date.now().toString(),
          content: text.trim(),
          role: 'user',
          timestamp: new Date(),
          isAudio: true
        };

        setMessages(prev => [...prev, audioMessage]);

        // Показываем успешное распознавание
        toast({
          title: "✅ Речь распознана",
          description: `"${text.trim()}"`,
        });

        // Небольшая задержка, чтобы пользователь увидел распознанный текст
        setTimeout(async () => {
          await sendMessageToAI(text.trim());
        }, 1000);
      } else {
        toast({
          title: "⚠️ Речь не распознана",
          description: "Попробуйте говорить четче или проверьте микрофон",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Error stopping recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при обработке записи';
      toast({
        title: "Ошибка распознавания",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRecording(false);
    }
  };




  return (
    <div className={`h-full flex flex-col overflow-hidden ${className}`}>
      <Card className="flex-1 flex flex-col overflow-hidden mb-32 border-0 shadow-none mt-[5%]">
        {/* Recording indicator - only show when recording */}
        {isRecording && (
          <div className="p-4 flex-shrink-0">
            <div className="flex items-center gap-2 text-red-500">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Запись...</span>
            </div>
          </div>
        )}

        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        <ScrollArea ref={scrollAreaRef} className="flex-1 px-4 sm:px-6 lg:px-[10%] min-h-0">
          <div className="space-y-4 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div
                  className={`max-w-[80%] space-y-2 ${
                    message.role === 'user' ? 'order-first' : ''
                  }`}
                >
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground ml-auto'
                        : 'bg-muted'
                    } ${
                      message.isTyping ? 'animate-pulse' : ''
                    }`}
                  >
                    {message.isAudio ? (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                          <Mic className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium mb-1">🎤 Голосовое сообщение</p>
                          <div className="text-sm opacity-90 prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown
                              components={{
                                p: ({children}) => <p className="mb-4 leading-relaxed text-sm">{children}</p>,
                                h1: ({children}) => <h1 className="text-xl font-bold mb-4 mt-6 text-primary">{children}</h1>,
                                h2: ({children}) => <h2 className="text-lg font-semibold mb-3 mt-5 text-primary">{children}</h2>,
                                h3: ({children}) => <h3 className="text-base font-medium mb-3 mt-4 text-primary/90">{children}</h3>,
                                h4: ({children}) => <h4 className="text-sm font-medium mb-2 mt-3 text-primary/80">{children}</h4>,
                                ul: ({children}) => <ul className="mb-4 ml-4 space-y-1">{children}</ul>,
                                ol: ({children}) => <ol className="mb-4 ml-4 space-y-1">{children}</ol>,
                                li: ({children}) => <li className="leading-relaxed text-sm">{children}</li>,
                                strong: ({children}) => <strong className="font-semibold text-primary">{children}</strong>,
                                em: ({children}) => <em className="italic text-primary/90">{children}</em>
                              }}
                            >{message.content}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    ) : message.isTyping || message.isStreaming ? (
                      <div className="flex items-center gap-2">
                        <div className="text-sm whitespace-pre-wrap">
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown
                              components={{
                                p: ({children}) => <p className="mb-4 leading-relaxed text-sm">{children}</p>,
                                h1: ({children}) => <h1 className="text-xl font-bold mb-4 mt-6 text-primary">{children}</h1>,
                                h2: ({children}) => <h2 className="text-lg font-semibold mb-3 mt-5 text-primary">{children}</h2>,
                                h3: ({children}) => <h3 className="text-base font-medium mb-3 mt-4 text-primary/90">{children}</h3>,
                                h4: ({children}) => <h4 className="text-sm font-medium mb-2 mt-3 text-primary/80">{children}</h4>,
                                ul: ({children}) => <ul className="mb-4 ml-4 space-y-1">{children}</ul>,
                                ol: ({children}) => <ol className="mb-4 ml-4 space-y-1">{children}</ol>,
                                li: ({children}) => <li className="leading-relaxed text-sm">{children}</li>,
                                strong: ({children}) => <strong className="font-semibold text-primary">{children}</strong>,
                                em: ({children}) => <em className="italic text-primary/90">{children}</em>
                              }}
                            >{message.content}</ReactMarkdown>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown
                          components={{
                            p: ({children}) => <p className="mb-4 leading-relaxed text-sm">{children}</p>,
                            h1: ({children}) => <h1 className="text-xl font-bold mb-4 mt-6 text-primary">{children}</h1>,
                            h2: ({children}) => <h2 className="text-lg font-semibold mb-3 mt-5 text-primary">{children}</h2>,
                            h3: ({children}) => <h3 className="text-base font-medium mb-3 mt-4 text-primary/90">{children}</h3>,
                            h4: ({children}) => <h4 className="text-sm font-medium mb-2 mt-3 text-primary/80">{children}</h4>,
                            ul: ({children}) => <ul className="mb-4 ml-4 space-y-1">{children}</ul>,
                            ol: ({children}) => <ol className="mb-4 ml-4 space-y-1">{children}</ol>,
                            li: ({children}) => <li className="leading-relaxed text-sm">{children}</li>,
                            strong: ({children}) => <strong className="font-semibold text-primary">{children}</strong>,
                            em: ({children}) => <em className="italic text-primary/90">{children}</em>
                          }}
                        >{message.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatTime(message.timestamp)}
                    </span>
                    {message.role === 'assistant' && !message.isTyping && !message.isStreaming && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleCopyMessage(message.content)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleSpeakMessage(message.content, message.id)}
                          disabled={isTTSSynthesizing && currentSpeakingMessageId !== message.id}
                          title={
                            isTTSSynthesizing && currentSpeakingMessageId === message.id
                              ? "ПОВАР ДУМАЕТ..."
                              : isTTSPlaying && currentSpeakingMessageId === message.id
                              ? "ПОВАР ГОВОРИТ... (нажмите чтобы остановить)"
                              : "Озвучить ответ"
                          }
                        >
                          {isTTSSynthesizing && currentSpeakingMessageId === message.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isTTSPlaying && currentSpeakingMessageId === message.id ? (
                            <Square className="w-3 h-3" />
                          ) : (
                            <Volume2 className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    {message.isAudio && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-500">🎤</span>
                        <span className="text-xs text-muted-foreground">Аудио</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleCopyMessage(message.content)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {message.role === 'user' && (
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarFallback className="bg-accent text-accent-foreground">
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        </CardContent>
      </Card>

      {/* TTS Status */}
      {(isTTSSynthesizing || isTTSPlaying) && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-primary/90 text-primary-foreground px-4 py-2 rounded-full text-sm font-medium shadow-lg backdrop-blur-sm flex items-center gap-2">
            {isTTSSynthesizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                ПОВАР ДУМАЕТ...
              </>
            ) : isTTSPlaying ? (
              <>
                <Volume2 className="w-4 h-4" />
                ПОВАР ГОВОРИТ...
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Fixed input at bottom of page */}
      <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container mx-auto max-w-4xl">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Спросите что-нибудь о готовке..."
              disabled={isLoading || isRecording}
              className="flex-1 text-sm sm:text-base"
            />
            {/* Кнопка отправки/записи с плавной анимацией */}
            <div className="relative shrink-0">
              {inputMessage.trim() ? (
                // Кнопка отправки - показывается когда есть текст
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isLoading || isRecording}
                  size="icon"
                  className="h-10 w-10 transition-all duration-200 ease-in-out transform hover:scale-105"
                  title="Отправить сообщение"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              ) : (
                // Кнопка микрофона - показывается когда поле пустое
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading || !audioSupported}
                  size="icon"
                  className={`h-10 w-10 transition-all duration-200 ease-in-out transform hover:scale-105 ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                      : audioSupported
                        ? 'bg-blue-500 hover:bg-blue-600 text-white'
                        : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  }`}
                  title={audioSupported ? (isRecording ? 'Остановить запись' : 'Начать голосовой ввод') : 'Запись аудио не поддерживается'}
                >
                  {isRecording ? (
                    <Square className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
            <Button
              onClick={handleClearChat}
              disabled={isLoading || isRecording}
              size="icon"
              variant="outline"
              className="shrink-0 h-10 w-10"
              title="Очистить чат"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 hidden sm:block">
            💡 Спросите о рецептах, техниках готовки, ингредиентах или любых кулинарных вопросах.
            {inputMessage.trim() ? (
              <span className="text-green-600"> 📤 Кнопка отправки активна - нажмите для отправки сообщения</span>
            ) : (
              audioSupported ? (
                <span className="text-blue-500">🎤 Начните писать или нажмите микрофон для голосового ввода</span>
              ) : (
                <span className="text-gray-500">🎤 Голосовой ввод недоступен. Начните писать сообщение в поле выше.</span>
              )
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
