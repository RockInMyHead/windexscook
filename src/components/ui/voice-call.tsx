import React, { useState, useRef, useEffect } from 'react';
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

interface VoiceCallProps {
  className?: string;
}

interface CallState {
  isConnected: boolean;
  isRecording: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
}

export const VoiceCall: React.FC<VoiceCallProps> = ({ className = '' }) => {
  const [callState, setCallState] = useState<CallState>({
    isConnected: false,
    isRecording: false,
    isPlaying: false,
    isLoading: false,
    error: null
  });

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Инициализация распознавания речи
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'ru-RU';

      recognitionRef.current.onresult = (event: any) => {
        console.log('🎯 [Voice Call] ===== РЕЗУЛЬТАТ РАСПОЗНАВАНИЯ РЕЧИ =====');
        console.log('📝 [Voice Call] Сырые данные события:', event);
        
        const transcript = event.results[0][0].transcript;
        console.log('🗣️ [Voice Call] Распознанный текст:', {
          transcript: transcript,
          confidence: event.results[0][0].confidence || 'неизвестно',
          length: transcript.length,
          timestamp: new Date().toISOString()
        });
        
        console.log('🔄 [Voice Call] Передаем текст в обработчик сообщений');
        handleUserMessage(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('❌ [Voice Call] ===== ОШИБКА РАСПОЗНАВАНИЯ РЕЧИ =====');
        console.error('🔍 [Voice Call] Детали ошибки:', {
          error: event.error,
          type: event.type,
          timestamp: new Date().toISOString()
        });
        
        setCallState(prev => ({ ...prev, isRecording: false, error: event.error }));
      };

      recognitionRef.current.onend = () => {
        console.log('🏁 [Voice Call] ===== РАСПОЗНАВАНИЕ РЕЧИ ЗАВЕРШЕНО =====');
        console.log('⏱️ [Voice Call] Время завершения:', new Date().toISOString());
        setCallState(prev => ({ ...prev, isRecording: false }));
      };
    }
  }, []);

  const handleUserMessage = async (text: string) => {
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

    // Отправляем в OpenAI без сохранения в чат
    try {
      setCallState(prev => ({ ...prev, isLoading: true }));
      
      console.log('🤖 [Voice Call] Отправляем запрос в OpenAI...');
      const startTime = Date.now();
      
      const response = await OpenAIService.generateRecipe([text], undefined, undefined, true);
      const responseTime = Date.now() - startTime;
      
      console.log('✅ [Voice Call] Ответ от OpenAI получен:', {
        responseTime: responseTime + 'ms',
        hasContent: !!response.content,
        hasTitle: !!response.title,
        timestamp: new Date().toISOString()
      });
      
      const responseText = response.content || response.title || 'Я готов помочь с кулинарными вопросами!';
      console.log('📄 [Voice Call] Текст ответа:', {
        text: responseText,
        length: responseText.length
      });
      
      // Воспроизводим ответ через TTS
      console.log('🔊 [Voice Call] Начинаем воспроизведение через OpenAI TTS...');
      await speakText(responseText);
      
    } catch (error) {
      console.error('❌ [Voice Call] ===== ОШИБКА ОБРАБОТКИ СООБЩЕНИЯ =====');
      console.error('🔍 [Voice Call] Детали ошибки:', error);
      toast({
        title: "Ошибка обработки",
        description: "Не удалось обработать ваше сообщение",
        variant: "destructive",
      });
    } finally {
      setCallState(prev => ({ ...prev, isLoading: false }));
      console.log('🏁 [Voice Call] Состояние загрузки сброшено');
    }
  };

  const speakText = async (text: string) => {
    try {
      console.log('🔊 [Voice Call] ===== НАЧАЛО СИНТЕЗА РЕЧИ =====');
      console.log('📝 [Voice Call] Текст для синтеза:', {
        textLength: text.length,
        textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        fullText: text
      });
      
      setCallState(prev => ({ ...prev, isPlaying: true }));
      
      const startTime = Date.now();
      console.log('⏱️ [Voice Call] Время начала синтеза:', new Date().toISOString());
      
      await OpenAITTS.speak(text, 'alloy');
      
      const duration = Date.now() - startTime;
      console.log('✅ [Voice Call] ===== СИНТЕЗ РЕЧИ ЗАВЕРШЕН =====');
      console.log(`⏱️ [Voice Call] Общее время синтеза: ${duration}ms`);
      console.log('📊 [Voice Call] Статистика:', {
        textLength: text.length,
        synthesisTime: duration + 'ms',
        timestamp: new Date().toISOString()
      });
      
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

  const startCall = async () => {
    try {
      console.log('📞 [TTS] Начинаем голосовой звонок...');
      setCallState(prev => ({ ...prev, isLoading: true }));
      
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
      
      // Приветственное сообщение только в виде речи
      const welcomeText = "Привет! Я ваш AI повар. Говорите, и я помогу с рецептами!";
      console.log('👋 [TTS] Воспроизводим приветствие:', welcomeText);
      
      // Воспроизводим приветствие
      await speakText(welcomeText);
      
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
    console.log('📞 [TTS] Завершаем голосовой звонок...');
    
    // Останавливаем распознавание речи
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    // Останавливаем TTS
    OpenAITTS.stop();
    
    setCallState({
      isConnected: false,
      isRecording: false,
      isPlaying: false,
      isLoading: false,
      error: null
    });
    
    console.log('✅ [TTS] Голосовой звонок завершен');
    toast({
      title: "📞 Звонок завершен",
      description: "Спасибо за общение с AI поваром!",
    });
  };

  const startRecording = () => {
    if (!callState.isConnected) {
      console.log('⚠️ [Voice Call] Попытка записи без подключения');
      return;
    }
    
    try {
      console.log('🎤 [Voice Call] ===== НАЧАЛО ЗАПИСИ РЕЧИ =====');
      console.log('🔍 [Voice Call] Проверяем состояние распознавания:', {
        isConnected: callState.isConnected,
        isRecording: callState.isRecording,
        isLoading: callState.isLoading
      });
      
      recognitionRef.current.start();
      setCallState(prev => ({ ...prev, isRecording: true }));
      
      console.log('✅ [Voice Call] Запись речи начата');
      console.log('⏱️ [Voice Call] Время начала записи:', new Date().toISOString());
      
      toast({
        title: "🎤 Запись начата",
        description: "Говорите в микрофон...",
      });
    } catch (error) {
      console.error('❌ [Voice Call] ===== ОШИБКА НАЧАЛА ЗАПИСИ =====');
      console.error('🔍 [Voice Call] Детали ошибки:', error);
      toast({
        title: "Ошибка записи",
        description: "Не удалось начать запись",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    console.log('🛑 [Voice Call] ===== ОСТАНОВКА ЗАПИСИ РЕЧИ =====');
    console.log('⏱️ [Voice Call] Время остановки записи:', new Date().toISOString());
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      console.log('✅ [Voice Call] Распознавание речи остановлено');
    } else {
      console.log('⚠️ [Voice Call] Распознавание речи не было инициализировано');
    }
    
    setCallState(prev => ({ ...prev, isRecording: false }));
    console.log('🏁 [Voice Call] Состояние записи сброшено');
  };

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
              <Badge variant={callState.isRecording ? "destructive" : "secondary"}>
                {callState.isRecording ? "Запись" : "Готов"}
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

        {/* Status Text */}
        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold text-foreground">
            {callState.isConnected ? 'AI Повар готов помочь!' : 'Начните звонок'}
          </h3>
          <p className="text-muted-foreground max-w-md">
            {callState.isConnected 
              ? 'Говорите в микрофон, и я помогу с рецептами и кулинарными советами'
              : 'Нажмите кнопку звонка, чтобы начать общение с AI поваром'
            }
          </p>
        </div>

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
            <>
              <Button
                onClick={callState.isRecording ? stopRecording : startRecording}
                disabled={callState.isLoading}
                variant={callState.isRecording ? "destructive" : "outline"}
                size="lg"
                className="px-6 py-3"
              >
                {callState.isRecording ? (
                  <>
                    <MicOff className="w-5 h-5 mr-2" />
                    Стоп
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5 mr-2" />
                    Говорить
                  </>
                )}
              </Button>
              
              <Button
                onClick={endCall}
                variant="destructive"
                size="lg"
                className="px-6 py-3"
              >
                <PhoneOff className="w-5 h-5 mr-2" />
                Сбросить
              </Button>
            </>
          )}
        </div>

        {/* Error Display */}
        {callState.error && (
          <Card className="w-full max-w-md border-destructive">
            <CardContent className="p-4">
              <p className="text-destructive text-sm text-center">
                {callState.error}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
