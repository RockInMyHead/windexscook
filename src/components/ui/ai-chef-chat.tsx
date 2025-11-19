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
import { ElevenLabsTTS } from '@/services/elevenlabs-tts';
import { useUser } from '@/contexts/UserContext';
import { Recipe } from '@/types/recipe';
import { RecipeDisplay } from './recipe-display';
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
  const [generatedRecipe, setGeneratedRecipe] = useState<Recipe | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Проверяем, является ли запрос запросом рецепта
  const isRecipeRequest = (text: string): boolean => {
    const lowerText = text.toLowerCase();

    // Исключаем разговорные фразы типа "хочу рецепт картошки" - это не явный запрос рецепта
    if (lowerText.includes('хочу рецепт') || lowerText.includes('дай рецепт')) {
      return false;
    }

    const recipeKeywords = [
      'приготовить', 'сварить', 'пожарить', 'запечь', 'сделать',
      'как приготовить', 'как сделать', 'как сварить', 'рецепт на',
      'рецепт приготовления', 'готовим', 'приготовление',
      'покажи рецепт', 'дайте рецепт', 'нужен рецепт'
    ];

    return recipeKeywords.some(keyword => lowerText.includes(keyword));
  };

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
    return 'Спасибо за ваш вопрос! Сейчас приложение работает в демо-режиме. Попробуйте:\n• 📸 Анализ фото продуктов\n• 🎤 Голосовое управление\n• 📊 Калькулятор калорий\n\nДля полноценного AI чата настройте API ключи OpenAI.';
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
      const hasSpeechRecognitionSupport = caps.speechRecognition || caps.webkitSpeechRecognition;
      
      console.log('Speech Recognition Support Check:');
      console.log('- Capabilities:', caps);
      console.log('- Final support:', hasSpeechRecognitionSupport);
      
      setAudioSupported(hasSpeechRecognitionSupport);
    };
    
    checkAudioSupport();
  }, []);


  const sendMessageToAI = async (messageText: string) => {
    setIsLoading(true);
    setIsThinking(true);
    setThinkingStep(0);

    let didStreamResponse = false;

    try {
      // Проверяем, является ли запрос запросом рецепта или изображения
      const shouldGenerateRecipe = isRecipeRequest(messageText);
      const shouldGenerateImage = isImageRequest(messageText);

      console.log('🔍 [AI Chef Chat] Анализ запроса:', {
        isRecipeRequest: shouldGenerateRecipe,
        isImageRequest: shouldGenerateImage,
        message: messageText
      });

      let response: any;
      let responseText: string;
      let recipe: Recipe | null = null;

      if (shouldGenerateRecipe) {
        // Воспроизводим звук обработки во время генерации рецепта (уже вызывается в сервисе)
        // AudioUtils.playProcessingSound();

        // Генерируем рецепт с изображениями
        console.log('🍳 [AI Chef Chat] Обнаружен запрос рецепта - генерируем с изображениями');
        response = await OpenAIService.generateRecipe([messageText], user?.healthProfile, undefined, false, true);

        if (response && response.instructions) {
          recipe = response;
          // Формируем текстовое описание рецепта с изображениями в тексте
          responseText = `Отлично! Я подготовил рецепт "${response.title}". ${response.description}\n\n`;

          response.instructions.forEach((instruction: string, index: number) => {
            // Вставляем изображение перед каждым шагом, если оно есть
            if (response.instructionImages && response.instructionImages[index]) {
              responseText += `![Шаг ${index + 1}](${response.instructionImages[index]})\n\n`;
            }
            responseText += `**Шаг ${index + 1}:** ${instruction}\n\n`;
          });

          if (response.tips) {
            responseText += `**Полезные советы:** ${response.tips}`;
          }

          console.log('🍳 [AI Chef Chat] Сформирован текстовый рецепт с изображениями в тексте');
        } else {
          responseText = response.content || response.description || 'Не удалось сгенерировать рецепт.';
        }
      } else if (shouldGenerateImage) {
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

      // Сохраняем рецепт если он был сгенерирован
      if (recipe) {
        setGeneratedRecipe(recipe);
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
      let errorMessage = 'Извините, я временно недоступен. Попробуйте позже или обратитесь к другим функциям приложения.';

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

  const handleSpeakMessage = async (content: string) => {
    try {
      await ElevenLabsTTS.speak(content);
      toast({
        title: "🔊 Воспроизведение",
        description: "Ответ AI озвучен",
      });
    } catch (error) {
      console.error('Error speaking message:', error);
      toast({
        title: "❌ Ошибка воспроизведения",
        description: "Не удалось воспроизвести ответ",
        variant: "destructive",
      });
    }
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
    setGeneratedRecipe(null);
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
      // Проверяем поддержку Web Speech API
      const caps = BrowserCompatibility.getCapabilities();
      if (!caps.speechRecognition && !caps.webkitSpeechRecognition) {
        throw new Error('Браузер не поддерживает распознавание речи');
      }

      setIsRecording(true);
      
      toast({
        title: "🎤 Запись началась",
        description: "Говорите в микрофон...",
      });

      // Запускаем распознавание речи напрямую
      const text = await speechToText();
      
      if (text) {
        // Добавляем голосовое сообщение в чат
        const audioMessage: Message = {
          id: Date.now().toString(),
          content: text,
          role: 'user',
          timestamp: new Date(),
          isAudio: true
        };
        
        setMessages(prev => [...prev, audioMessage]);
        
        // Небольшая задержка, чтобы пользователь увидел распознанный текст
        setTimeout(async () => {
          await sendMessageToAI(text);
        }, 1000);
      }
      
      setIsRecording(false);
      
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

  const stopRecording = () => {
    // Для прямого распознавания речи остановка не нужна
    // Функция оставлена для совместимости с UI
    setIsRecording(false);
  };


  const speechToText = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Проверяем поддержку Web Speech API
      const caps = BrowserCompatibility.getCapabilities();
      if (!caps.speechRecognition && !caps.webkitSpeechRecognition) {
        reject(new Error('Браузер не поддерживает распознавание речи'));
        return;
      }

      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.lang = 'ru-RU';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      let hasResult = false;

      recognition.onstart = () => {
        console.log('Speech recognition started');
        toast({
          title: "🎤 Распознавание речи",
          description: "Слушаем... Говорите четко и громко.",
        });
      };

      recognition.onresult = (event: any) => {
        hasResult = true;
        const result = event.results[0][0].transcript;
        console.log('Speech recognition result:', result);
        
        // Показываем уведомление об успешном распознавании
        toast({
          title: "✅ Речь распознана",
          description: `"${result}"`,
        });
        
        resolve(result);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        hasResult = true;
        
        let errorMessage = 'Ошибка распознавания речи';
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'Речь не обнаружена. Попробуйте говорить громче.';
            break;
          case 'audio-capture':
            errorMessage = 'Не удалось получить доступ к микрофону.';
            break;
          case 'not-allowed':
            errorMessage = 'Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.';
            break;
          case 'network':
            errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
            break;
        }
        
        reject(new Error(errorMessage));
      };

      recognition.onend = () => {
        if (!hasResult) {
          reject(new Error('Речь не распознана. Попробуйте еще раз.'));
        }
      };

      // Запускаем распознавание
      try {
        recognition.start();
      } catch (error) {
        reject(new Error('Не удалось запустить распознавание речи'));
      }
    });
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
          {/* Generated Recipe Display */}
          {generatedRecipe && (
            <div className="w-full max-w-4xl mx-auto mb-4">
              <RecipeDisplay recipe={generatedRecipe} />
            </div>
          )}

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
                          <ReactMarkdown
                            className="prose prose-sm max-w-none dark:prose-invert"
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
                          onClick={() => handleSpeakMessage(message.content)}
                        >
                          <Volume2 className="w-3 h-3" />
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
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-blue-500">🎤</span>
                        <span className="text-xs text-muted-foreground">Аудио</span>
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
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading || !audioSupported}
              size="icon"
              className={`shrink-0 h-10 w-10 ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : audioSupported 
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-400 text-gray-600 cursor-not-allowed'
              }`}
              title={audioSupported ? (isRecording ? 'Остановить запись' : 'Начать запись') : 'Запись аудио не поддерживается'}
            >
              {isRecording ? (
                <Square className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || isRecording}
              size="icon"
              className="shrink-0 h-10 w-10"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
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
            {audioSupported ? (
              <span className="text-blue-500">🎤 Используйте микрофон для голосового ввода (Chrome, Edge, Safari)</span>
            ) : (
              <span className="text-gray-500">🎤 Голосовой ввод недоступен в вашем браузере. Используйте Chrome, Edge или Safari.</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
