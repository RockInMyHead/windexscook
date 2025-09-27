import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { 
  Video, 
  Mic, 
  MicOff, 
  Square, 
  Play, 
  Pause,
  Volume2,
  VolumeX,
  Settings,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ElevenLabsService } from '@/services/elevenlabs';
import { ElevenLabsTTS } from '@/services/elevenlabs-tts';
import { BrowserTTS } from '@/services/browser-tts';
import { OpenAIService } from '@/services/openai';

interface ElevenLabsMirrorProps {
  className?: string;
}

interface MirrorState {
  isConnected: boolean;
  isRecording: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
}

export const ElevenLabsMirror: React.FC<ElevenLabsMirrorProps> = ({ className = '' }) => {
  const [mirrorState, setMirrorState] = useState<MirrorState>({
    isConnected: false,
    isRecording: false,
    isPlaying: false,
    isMuted: false,
    isLoading: false,
    error: null
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  // Инициализация зеркала через iframe
  const initializeMirrorIframe = async () => {
    console.log('🔄 Инициализируем зеркало через iframe...');
    setMirrorState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const mirrorUrl = ElevenLabsService.getMirrorUrl();
      console.log('🔗 URL зеркала:', mirrorUrl);

      // Устанавливаем src для iframe
      if (iframeRef.current) {
        iframeRef.current.src = mirrorUrl;
        console.log('✅ iframe src установлен:', mirrorUrl);
      } else {
        console.log('⚠️ iframe ref не найден, создаем новый iframe');
        // Создаем iframe программно если ref не работает
        const iframe = document.createElement('iframe');
        iframe.src = mirrorUrl;
        iframe.className = 'w-full h-full border-0';
        iframe.allow = 'camera; microphone; autoplay';
        iframe.title = 'ElevenLabs Mirror';
        iframe.style.display = 'block';
        iframe.onload = () => {
          console.log('✅ iframe загружен программно');
        };
        iframe.onerror = (e) => {
          console.error('❌ Ошибка загрузки программного iframe:', e);
        };
        
        const container = document.querySelector('.mirror-container');
        if (container) {
          container.appendChild(iframe);
        }
      }

      setMirrorState(prev => ({ 
        ...prev, 
        isConnected: true, 
        isLoading: false 
      }));

      toast({
        title: "✅ Зеркало подключено",
        description: "ElevenLabs зеркало готово к работе",
      });

    } catch (error) {
      console.error('❌ Ошибка инициализации iframe:', error);
      setMirrorState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Ошибка загрузки зеркала' 
      }));
    }
  };

  // Инициализация зеркала через WebSocket
  const initializeMirrorWebSocket = async () => {
    console.log('🔄 Начинаем инициализацию зеркала через WebSocket...');
    setMirrorState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('🔍 Проверяем поддержку WebRTC...');
      // Проверяем поддержку WebRTC
      if (!ElevenLabsService.checkWebRTCSupport()) {
        throw new Error('Ваш браузер не поддерживает необходимые функции для видеозвонка');
      }
      console.log('✅ WebRTC поддерживается');

      console.log('📹 Запрашиваем доступ к камере и микрофону...');
      // Получаем доступ к камере и микрофону
      const stream = await ElevenLabsService.getMediaStream();
      console.log('✅ Получен медиа поток:', stream);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        console.log('✅ Видео запущено');
      }

      console.log('🔌 Подключаемся к ElevenLabs...');
      // Инициализируем WebSocket соединение с ElevenLabs
      await connectToElevenLabs();
      console.log('✅ WebSocket подключен');

      setMirrorState(prev => ({ 
        ...prev, 
        isConnected: true, 
        isLoading: false 
      }));

      toast({
        title: "✅ Зеркало подключено",
        description: "ElevenLabs зеркало готово к работе",
      });

    } catch (error) {
      console.error('❌ Ошибка инициализации зеркала:', error);
      const errorMessage = ElevenLabsService.handleError(error);
      
      setMirrorState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));

      toast({
        title: "❌ Ошибка подключения",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Основная функция инициализации
  const initializeMirror = async () => {
    // Используем локальное видео решение
    await initializeLocalVideo();
  };

  // Инициализация локального видео
  const initializeLocalVideo = async () => {
    console.log('🔄 Инициализируем локальное видео...');
    setMirrorState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('📹 Запрашиваем доступ к камере и микрофону...');
      const stream = await ElevenLabsService.getMediaStream();
      console.log('✅ Получен медиа поток:', stream);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Важно для автовоспроизведения
        videoRef.current.playsInline = true;
        
        // Ждем загрузки метаданных перед воспроизведением
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current!.play();
            console.log('✅ Видео запущено');
          } catch (error) {
            console.error('❌ Ошибка воспроизведения видео:', error);
          }
        };
        
        // Альтернативный способ - попробуем воспроизвести сразу
        setTimeout(async () => {
          if (videoRef.current && videoRef.current.paused) {
            try {
              await videoRef.current.play();
              console.log('✅ Видео запущено (альтернативный способ)');
            } catch (error) {
              console.error('❌ Ошибка альтернативного воспроизведения:', error);
            }
          }
        }, 1000);
        
        console.log('📹 Видео элемент настроен, ждем загрузки метаданных...');
      }

      setMirrorState(prev => ({ 
        ...prev, 
        isConnected: true, 
        isLoading: false 
      }));

      toast({
        title: "✅ Видеозвонок подключен",
        description: "Ваше видео готово! Используйте кнопку микрофона для общения с AI поваром.",
      });

    } catch (error) {
      console.error('❌ Ошибка инициализации видео:', error);
      const errorMessage = ElevenLabsService.handleError(error);
      
      setMirrorState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));

      toast({
        title: "❌ Ошибка подключения",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Открыть зеркало в новом окне
  const openMirrorInNewWindow = () => {
    const mirrorUrl = ElevenLabsService.getMirrorUrl();
    console.log('🔗 Открываем зеркало в новом окне:', mirrorUrl);
    
    const newWindow = window.open(
      mirrorUrl,
      'ElevenLabsMirror',
      'width=800,height=600,scrollbars=yes,resizable=yes'
    );
    
    if (newWindow) {
      setMirrorState(prev => ({ 
        ...prev, 
        isConnected: true, 
        isLoading: false 
      }));
      
      toast({
        title: "✅ Зеркало открыто",
        description: "ElevenLabs зеркало открыто в новом окне",
      });
    } else {
      toast({
        title: "❌ Ошибка",
        description: "Не удалось открыть новое окно. Проверьте блокировщик всплывающих окон.",
        variant: "destructive",
      });
    }
  };

  // Подключение к ElevenLabs WebSocket
  const connectToElevenLabs = async () => {
    try {
      const ws = await ElevenLabsService.createWebSocketConnection();
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleElevenLabsMessage(data);
        } catch (error) {
          console.error('Error parsing ElevenLabs message:', error);
        }
      };

      ws.onclose = () => {
        console.log('ElevenLabs WebSocket closed');
        websocketRef.current = null;
        setMirrorState(prev => ({ ...prev, isConnected: false }));
      };

      websocketRef.current = ws;
    } catch (error) {
      throw error;
    }
  };

  // Обработка сообщений от ElevenLabs
  const handleElevenLabsMessage = (data: any) => {
    switch (data.type) {
      case 'audio':
        // Воспроизводим аудио ответ от агента
        playAudioResponse(data.audio_data);
        break;
      case 'status':
        console.log('ElevenLabs status:', data.status);
        break;
      case 'error':
        console.error('ElevenLabs error:', data.error);
        toast({
          title: "❌ Ошибка ElevenLabs",
          description: data.error,
          variant: "destructive",
        });
        break;
    }
  };

  // Воспроизведение аудио ответа
  const playAudioResponse = async (audioData: string) => {
    try {
      if (!mirrorState.isMuted) {
        await ElevenLabsService.playAudioResponse(audioData);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      toast({
        title: "❌ Ошибка воспроизведения",
        description: "Не удалось воспроизвести аудио ответ",
        variant: "destructive",
      });
    }
  };

  // Начать/остановить запись
  const toggleRecording = () => {
    if (!mirrorState.isConnected) {
      toast({
        title: "⚠️ Не подключено",
        description: "Сначала подключитесь к зеркалу",
        variant: "destructive",
      });
      return;
    }

    if (mirrorState.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    setMirrorState(prev => ({ ...prev, isRecording: true }));

    try {
      // Создаем MediaRecorder для записи аудио
      const mediaRecorder = ElevenLabsService.createAudioRecorder(streamRef.current);
      
      // Сохраняем ссылку на recorder для остановки
      (mediaRecorder as any).recorderRef = mediaRecorder;
      
      let audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          console.log('🎤 Получены аудио данные:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🛑 Запись остановлена');
        setMirrorState(prev => ({ ...prev, isRecording: false }));
        
        // Обрабатываем записанное аудио
        if (audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          await processAudioWithAI(audioBlob);
          audioChunks = []; // Очищаем массив
        }
      };

      mediaRecorder.start(100); // Отправляем данные каждые 100мс

      toast({
        title: "🎤 Запись началась",
        description: "Говорите с AI поваром...",
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      setMirrorState(prev => ({ ...prev, isRecording: false }));
      toast({
        title: "❌ Ошибка записи",
        description: "Не удалось начать запись аудио",
        variant: "destructive",
      });
    }
  };

  // Умный выбор TTS сервиса
  const speakWithFallback = async (text: string) => {
    try {
      console.log('🎤 Пробуем ElevenLabs TTS через прокси...');
      await ElevenLabsTTS.speak(text);
      console.log('✅ ElevenLabs TTS работает');
    } catch (error) {
      console.log('⚠️ ElevenLabs TTS не работает, пробуем браузерный TTS...');
      try {
        await BrowserTTS.speak(text);
        console.log('✅ Браузерный TTS работает');
      } catch (browserError) {
        console.error('❌ Оба TTS не работают:', browserError);
        throw browserError;
      }
    }
  };

  // Обработка аудио с AI (упрощенная версия)
  const processAudioWithAI = async (audioBlob: Blob) => {
    try {
      console.log('🤖 Обрабатываем аудио с AI...');
      
      // Пока что используем простой ответ без Speech-to-Text
      // В будущем здесь можно добавить реальную обработку аудио
      const aiResponse = "Привет! Я слышу ваш голос. К сожалению, пока что я не могу понять речь, но вы можете писать мне в текстовом чате. Я готов помочь вам с рецептами и кулинарными советами!";
      
      console.log('🤖 AI повар отвечает:', aiResponse);
      
      // Озвучиваем ответ через умный выбор TTS
      await speakWithFallback(aiResponse);
      
      toast({
        title: "✅ Ответ получен",
        description: "AI повар ответил на ваш вопрос",
      });
      
    } catch (error) {
      console.error('❌ Ошибка обработки аудио:', error);
      
      // Fallback - используем текстовый ответ
      const fallbackResponse = "Извините, произошла ошибка при обработке вашего голоса. Попробуйте написать вопрос в текстовом чате.";
      await speakWithFallback(fallbackResponse);
      
      toast({
        title: "❌ Ошибка обработки",
        description: "Не удалось обработать аудио",
        variant: "destructive",
      });
    }
  };

  // Получение ответа от AI повара
  const getAIResponse = async (userMessage: string): Promise<string> => {
    try {
      // Используем существующий сервис OpenAI
      const response = await OpenAIService.generateRecipeSuggestion(userMessage);
      return response;
    } catch (error) {
      console.error('❌ Ошибка получения ответа AI:', error);
      return "Извините, я не могу ответить на ваш вопрос в данный момент. Попробуйте позже.";
    }
  };

  const stopRecording = () => {
    setMirrorState(prev => ({ ...prev, isRecording: false }));
    
    toast({
      title: "⏹️ Запись остановлена",
      description: "Обрабатываем ваш запрос...",
    });
  };

  // Переключить звук
  const toggleMute = () => {
    setMirrorState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    
    toast({
      title: mirrorState.isMuted ? "🔊 Звук включен" : "🔇 Звук выключен",
      description: mirrorState.isMuted ? "Теперь вы слышите ответы" : "Ответы воспроизводятся без звука",
    });
  };

  // Отключиться от зеркала
  const disconnectMirror = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setMirrorState({
      isConnected: false,
      isRecording: false,
      isPlaying: false,
      isMuted: false,
      isLoading: false,
      error: null
    });

    toast({
      title: "🔌 Отключено",
      description: "Зеркало ElevenLabs отключено",
    });
  };

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      disconnectMirror();
    };
  }, []);

  return (
    <Card className={`h-full flex flex-col overflow-hidden ${className}`}>
      <CardHeader className="pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Видеозвонок с AI Поваром
                <Badge variant={mirrorState.isConnected ? "default" : "secondary"}>
                  {mirrorState.isConnected ? "Подключено" : "Отключено"}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Локальное видео с возможностью записи аудио
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={mirrorState.isConnected ? disconnectMirror : initializeMirror}
              disabled={mirrorState.isLoading}
              className="text-xs"
            >
              {mirrorState.isLoading ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : mirrorState.isConnected ? (
                <>
                  <Square className="w-3 h-3 mr-1" />
                  Отключить
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 mr-1" />
                  Подключить
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        {/* Видео область */}
        <div className="mirror-container flex-1 bg-black rounded-lg m-4 relative overflow-hidden">
          {mirrorState.isConnected ? (
            <>
              {/* Локальное видео */}
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
                style={{ 
                  backgroundColor: '#000',
                  minHeight: '300px'
                }}
                onLoadStart={() => console.log('📹 Видео начало загружаться')}
                onLoadedData={() => console.log('📹 Видео данные загружены')}
                onCanPlay={() => console.log('📹 Видео готово к воспроизведению')}
                onPlay={() => console.log('▶️ Видео воспроизводится')}
                onError={(e) => console.error('❌ Ошибка видео:', e)}
              />
              
              {/* ElevenLabs iframe (скрыт) */}
              <iframe
                ref={iframeRef}
                className="w-full h-full border-0"
                allow="camera; microphone; autoplay"
                title="ElevenLabs Mirror"
                style={{ display: 'none' }}
                onLoad={() => {
                  console.log('✅ iframe загружен успешно');
                }}
                onError={(e) => {
                  console.error('❌ Ошибка загрузки iframe:', e);
                }}
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ display: 'none' }}
              />
              
                  {/* Индикаторы состояния */}
                  <div className="absolute top-4 left-4 flex gap-2">
                    {mirrorState.isRecording && (
                      <div className="flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded-full text-xs">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        Запись
                      </div>
                    )}
                    {mirrorState.isMuted && (
                      <div className="flex items-center gap-1 bg-gray-500 text-white px-2 py-1 rounded-full text-xs">
                        <VolumeX className="w-3 h-3" />
                        Без звука
                      </div>
                    )}
                    {mirrorState.isConnected && (
                      <div className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded-full text-xs">
                        <Video className="w-3 h-3" />
                        Камера активна
                      </div>
                    )}
                  </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Зеркало не подключено</h3>
                <p className="text-sm mb-4">
                  Нажмите "Подключить" чтобы начать видеозвонок с AI поваром
                </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-blue-900 mb-2">🎥 Локальное Видео</h4>
                      <p className="text-sm text-blue-700 mb-2">
                        Ваша камера будет использована для видеозвонка
                      </p>
                      <p className="text-xs text-blue-600">
                        Нажмите "Подключить" для доступа к камере и микрофону
                      </p>
                    </div>
                {mirrorState.error && (
                  <div className="flex items-center gap-2 text-red-500 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {mirrorState.error}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Панель управления */}
        <div className="p-4 border-t bg-background">
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={toggleRecording}
              disabled={!mirrorState.isConnected || mirrorState.isLoading}
              size="lg"
              className={`h-12 w-12 rounded-full ${
                mirrorState.isRecording 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {mirrorState.isRecording ? (
                <Square className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </Button>

            <Button
              onClick={toggleMute}
              disabled={!mirrorState.isConnected}
              variant="outline"
              size="lg"
              className="h-12 w-12 rounded-full"
            >
              {mirrorState.isMuted ? (
                <VolumeX className="w-6 h-6" />
              ) : (
                <Volume2 className="w-6 h-6" />
              )}
            </Button>

            <Button
              onClick={openMirrorInNewWindow}
              variant="outline"
              size="lg"
              className="h-12 px-4 rounded-full"
            >
              <Video className="w-4 h-4 mr-2" />
              Новое окно
            </Button>

            <Button
              onClick={async () => {
                try {
                  await speakWithFallback("Привет! Я ваш AI повар. Готов помочь с рецептами и кулинарными советами!");
                  toast({
                    title: "🔊 Тест голоса",
                    description: "AI повар говорит!",
                  });
                } catch (error) {
                  toast({
                    title: "❌ Ошибка",
                    description: "Не удалось воспроизвести голос",
                    variant: "destructive",
                  });
                }
              }}
              variant="outline"
              size="lg"
              className="h-12 px-4 rounded-full"
            >
              <Volume2 className="w-4 h-4 mr-2" />
              Тест голоса
            </Button>

            <Button
              onClick={async () => {
                try {
                  const isWorking = await ElevenLabsTTS.testApiKey();
                  toast({
                    title: isWorking ? "✅ API работает" : "❌ API не работает",
                    description: isWorking ? "API ключ ElevenLabs активен" : "Проверьте API ключ",
                    variant: isWorking ? "default" : "destructive",
                  });
                } catch (error) {
                  toast({
                    title: "❌ Ошибка тестирования",
                    description: "Не удалось проверить API ключ",
                    variant: "destructive",
                  });
                }
              }}
              variant="outline"
              size="lg"
              className="h-12 px-4 rounded-full"
            >
              <Settings className="w-4 h-4 mr-2" />
              Тест API
            </Button>
          </div>

          <div className="text-center mt-4">
            <p className="text-xs text-muted-foreground">
              {mirrorState.isConnected ? (
                mirrorState.isRecording ? (
                  "🎤 Запись активна. Говорите с AI поваром."
                ) : (
                  "💬 Видео подключено. Нажмите микрофон для записи."
                )
              ) : (
                "🔌 Нажмите 'Подключить' для доступа к камере и микрофону"
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
