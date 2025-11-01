import React, { useState, useRef, useEffect } from 'react';
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
  Trash2,
  Zap
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { OpenAIService } from '@/services/openai';
import { OpenAITTS } from '@/services/openai-tts';
import { useUser } from '@/contexts/UserContext';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isTyping?: boolean;
  isAudio?: boolean;
}

interface AiChefChatProps {
  className?: string;
}

export const AiChefChat: React.FC<AiChefChatProps> = ({ className = '' }) => {
  const { user } = useUser();

  // Загружаем историю сообщений из localStorage
  const loadMessagesFromStorage = (): Message[] => {
    try {
      const saved = localStorage.getItem('ai-chef-chat-history');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Преобразуем timestamp обратно в Date объекты
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.error('Ошибка загрузки истории чата:', error);
    }
    // Возвращаем начальное сообщение, если истории нет
    return [
      {
        id: '1',
        content: 'Готов помочь с кулинарными вопросами! Что хотите приготовить?',
        role: 'assistant',
        timestamp: new Date()
      }
    ];
  };

  const [messages, setMessages] = useState<Message[]>(loadMessagesFromStorage);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioSupported, setAudioSupported] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [isFastMode, setIsFastMode] = useState(false); // Быстрый режим для более быстрых ответов
  const [isContinuousMode, setIsContinuousMode] = useState(false); // Режим постоянного прослушивания
  const [isUserSpeaking, setIsUserSpeaking] = useState(false); // Флаг, что пользователь говорит

  // Сохраняем историю сообщений в localStorage при каждом изменении
  const saveMessagesToStorage = (messagesToSave: Message[]) => {
    try {
      // Ограничиваем историю до последних 50 сообщений для экономии места
      const limitedMessages = messagesToSave.slice(-50);
      localStorage.setItem('ai-chef-chat-history', JSON.stringify(limitedMessages));
    } catch (error) {
      console.error('Ошибка сохранения истории чата:', error);
    }
  };

  // Функция для очистки истории чата
  const clearChatHistory = () => {
    const initialMessage = {
      id: Date.now().toString(),
      content: 'История чата очищена. Готов помочь с новыми кулинарными вопросами!',
      role: 'assistant' as const,
      timestamp: new Date()
    };
    setMessages([initialMessage]);
    localStorage.removeItem('ai-chef-chat-history');
    toast({
      title: "История очищена",
      description: "Начнем разговор заново!",
    });
  };

  // Функция переключения режима постоянного прослушивания
  const toggleContinuousMode = async () => {
    if (!audioSupported) {
      toast({
        title: "Недоступно",
        description: "Голосовые функции не поддерживаются в вашем браузере",
        variant: "destructive",
      });
      return;
    }

    const newContinuousMode = !isContinuousMode;
    setIsContinuousMode(newContinuousMode);

    if (newContinuousMode) {
      // Включаем постоянное прослушивание
      toast({
        title: "🎤 Режим постоянного диалога",
        description: "Теперь я буду слушать вас постоянно. Говорите в любое время!",
      });

      // Начинаем прослушивание
      await startContinuousListening();
    } else {
      // Выключаем постоянное прослушивание
      toast({
        title: "Режим выключен",
        description: "Постоянное прослушивание отключено",
      });

      // Останавливаем прослушивание
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      setIsUserSpeaking(false);
    }
  };

  // Функция запуска постоянного прослушивания
  const startContinuousListening = async () => {
    if (isRecording || !audioSupported) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Освобождаем поток сразу, так как он нам не нужен
      stream.getTracks().forEach(track => track.stop());

      await speechToText();
    } catch (error) {
      console.error('Error starting continuous listening:', error);
      toast({
        title: "Ошибка микрофона",
        description: "Не удалось получить доступ к микрофону",
        variant: "destructive",
      });
      setIsContinuousMode(false);
    }
  };
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Массив "мыслей" AI для визуализации
  const thinkingSteps = [
    "Анализирую ваш запрос...",
    "Подбираю подходящие ингредиенты...",
    "Составляю пошаговый план...",
    "Учитываю ваши предпочтения...",
    "Формирую детальный ответ...",
    "Проверяю рецепт на точность..."
  ];

  // Автоскролл к последнему сообщению
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Анимация мыслей AI
  useEffect(() => {
    if (isThinking) {
      const interval = setInterval(() => {
        setThinkingStep(prev => {
          const nextStep = (prev + 1) % thinkingSteps.length;
          // Обновляем содержимое сообщения о мышлении
          setMessages(currentMessages => 
            currentMessages.map(msg => 
              msg.id === 'thinking' 
                ? { ...msg, content: thinkingSteps[nextStep] }
                : msg
            )
          );
          return nextStep;
        });
      }, 1500); // Меняем мысль каждые 1.5 секунды

      return () => clearInterval(interval);
    }
  }, [isThinking, thinkingSteps]);

  // Проверка поддержки аудио при загрузке
  useEffect(() => {
    const checkAudioSupport = () => {
      const hasWebkitSpeechRecognition = !!(window as any).webkitSpeechRecognition;
      const hasSpeechRecognition = !!(window as any).SpeechRecognition;
      const hasSpeechRecognitionSupport = hasWebkitSpeechRecognition || hasSpeechRecognition;
      
      console.log('Speech Recognition Support Check:');
      console.log('- webkitSpeechRecognition:', hasWebkitSpeechRecognition);
      console.log('- SpeechRecognition:', hasSpeechRecognition);
      console.log('- Final support:', hasSpeechRecognitionSupport);
      
      setAudioSupported(hasSpeechRecognitionSupport);
    };
    
    checkAudioSupport();
  }, []);


  const sendMessageToAI = async (messageText: string) => {
    setIsLoading(true);
    setIsThinking(true);
    setThinkingStep(0);

    // Добавляем сообщение о том, что AI думает
    const thinkingMessage: Message = {
      id: 'thinking',
      content: thinkingSteps[0],
      role: 'assistant',
      timestamp: new Date(),
      isTyping: true
    };

    setMessages(prev => [...prev, thinkingMessage]);

    try {
      // Подготавливаем историю сообщений для контекста
      const messageHistory = messages
        .filter(msg => 
          msg.id !== 'thinking' && 
          !(msg.role === 'assistant' && msg.content === 'Готов помочь с кулинарными вопросами! Что хотите приготовить?')
        )
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      console.log('🔍 DEBUG: Sending message history:', messageHistory.length, 'messages');

      try {
        const response = await OpenAIService.chatWithChef(messageText, user?.healthProfile, messageHistory, isFastMode);

        // Удаляем сообщение о мышлении
        setMessages(prev => {
          const withoutThinking = prev.filter(msg => msg.id !== 'thinking');

          // Добавляем ответ только если он не пустой
          if (response && response.trim()) {
            const newMessages = [...withoutThinking, {
              id: Date.now().toString(),
              content: response,
              role: 'assistant',
              timestamp: new Date()
            }];

            // Сохраняем обновленную историю в localStorage
            saveMessagesToStorage(newMessages);

            return newMessages;
          }

          return withoutThinking;
        });
      } catch (error) {
        console.error('Error sending message:', error);

        // Удаляем сообщение о мышлении и добавляем сообщение об ошибке
        setMessages(prev => {
          const withoutThinking = prev.filter(msg => msg.id !== 'thinking');
          const errorMessage = {
            id: Date.now().toString(),
            content: 'Извините, я временно недоступен. Попробуйте позже или обратитесь к другим функциям приложения.',
            role: 'assistant' as const,
            timestamp: new Date()
          };
          const newMessages = [...withoutThinking, errorMessage];

          // Сохраняем обновленную историю в localStorage
          saveMessagesToStorage(newMessages);

          return newMessages;
        });
      } finally {
        setIsLoading(false);
        setIsThinking(false);
      }
    } catch (error) {
      console.error('Unexpected error in sendMessageToAI:', error);
      // Удаляем сообщение о мышлении при неожиданной ошибке
      setMessages(prev => prev.filter(msg => msg.id !== 'thinking'));
      setIsLoading(false);
      setIsThinking(false);
    }

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
      await OpenAITTS.speak(content);
      toast({
        title: "🔊 Воспроизведение",
        description: "Ответ AI озвучен",
      });

      // В режиме постоянного диалога автоматически начинаем слушать после окончания речи
      if (isContinuousMode) {
        console.log('🎤 TTS finished, starting continuous listening...');
        setTimeout(() => {
          startContinuousListening();
        }, 500); // Небольшая пауза перед началом прослушивания
      }
    } catch (error) {
      console.error('Error speaking message:', error);
      toast({
        title: "❌ Ошибка воспроизведения",
        description: "Не удалось воспроизвести ответ",
        variant: "destructive",
      });

      // Даже при ошибке TTS, в режиме постоянного диалога продолжаем слушать
      if (isContinuousMode) {
        setTimeout(() => {
          startContinuousListening();
        }, 1000);
      }
    }
  };

  const handleClearChat = () => {
    clearChatHistory();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatMessageContent = (content: string) => {
    // Сначала заменяем ### на ** для жирного текста большего шрифта
    let formattedContent = content.replace(/\n### (.*?)(?=\n|$)/g, '\n**$1**');
    
    // Затем заменяем #### на ** для обычного жирного шрифта
    formattedContent = formattedContent.replace(/\n#### (.*?)(?=\n|$)/g, '\n**$1**');
    
    // Затем обрабатываем markdown для жирного текста
    const parts = formattedContent.split(/(\*\*.*?\*\*)/g);
    
    const formattedParts = parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Это жирный текст - проверяем, был ли это ### (больший шрифт)
        const text = part.slice(2, -2);
        const originalText = content;
        const isLargeFont = originalText.includes(`### ${text}`);
        
        if (isLargeFont) {
          return <strong key={index} className="font-bold text-lg">{text}</strong>;
        } else {
          return <strong key={index} className="font-bold">{text}</strong>;
        }
      }
      return part;
    });

    // Теперь обрабатываем Windexs
    const finalParts: React.ReactNode[] = [];
    
    formattedParts.forEach((part, index) => {
      if (typeof part === 'string') {
        const windexsParts = part.split('Windexs');
        windexsParts.forEach((subPart, subIndex) => {
          if (subIndex > 0) {
            finalParts.push(<span key={`${index}-${subIndex}`} className="text-primary font-semibold">Windexs</span>);
          }
          if (subPart) {
            finalParts.push(subPart);
          }
        });
      } else {
        finalParts.push(part);
      }
    });

    return finalParts;
  };

  // Функции для работы с аудио
  const startRecording = async () => {
    try {
      // Проверяем поддержку Web Speech API
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
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
        
        setMessages(prev => {
          const newMessages = [...prev, audioMessage];
          // Сохраняем обновленную историю в localStorage
          saveMessagesToStorage(newMessages);
          return newMessages;
        });
        
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
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        reject(new Error('Браузер не поддерживает распознавание речи'));
        return;
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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

        // В режиме постоянного диалога автоматически отправляем сообщение AI
        if (isContinuousMode && result.trim()) {
          console.log('🎯 Continuous mode: auto-sending message to AI');
          setTimeout(() => {
            sendMessageToAI(result.trim());
          }, 500); // Небольшая задержка
        }

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
                          <p className="text-sm whitespace-pre-wrap opacity-90">{message.content}</p>
                        </div>
                      </div>
                    ) : message.isTyping ? (
                      <div className="flex items-center gap-2">
                        <p className="text-sm whitespace-pre-wrap">{formatMessageContent(message.content)}</p>
                        <div className="flex gap-1">
                          <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{formatMessageContent(message.content)}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatTime(message.timestamp)}
                    </span>
                    {message.role === 'assistant' && !message.isTyping && (
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
              onClick={() => setIsFastMode(!isFastMode)}
              disabled={isLoading || isRecording}
              size="icon"
              variant={isFastMode ? "default" : "outline"}
              className="shrink-0 h-10 w-10"
              title={isFastMode ? "Выключить быстрый режим" : "Включить быстрый режим"}
            >
              <Zap className={`w-4 h-4 ${isFastMode ? 'text-yellow-400' : ''}`} />
            </Button>
            <Button
              onClick={toggleContinuousMode}
              disabled={isLoading || !audioSupported}
              size="icon"
              variant={isContinuousMode ? "default" : "outline"}
              className="shrink-0 h-10 w-10"
              title={isContinuousMode ? "Выключить постоянный диалог" : "Включить постоянный диалог"}
            >
              <Mic className={`w-4 h-4 ${isContinuousMode ? 'text-red-400 animate-pulse' : ''}`} />
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
            {isFastMode && <span className="text-yellow-600 font-medium"> ⚡ Быстрый режим активен</span>}
            {isContinuousMode && <span className="text-red-600 font-medium"> 🎤 Постоянный диалог активен</span>}
            {audioSupported ? (
              <span className="text-blue-500"> 🎤 Используйте микрофон для голосового ввода (Chrome, Edge, Safari)</span>
            ) : (
              <span className="text-gray-500"> 🎤 Голосовой ввод недоступен в вашем браузере. Используйте Chrome, Edge или Safari.</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
// File integrity check
