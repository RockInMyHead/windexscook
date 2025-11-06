import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Copy, Volume2, ThumbsUp, Bot, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ElevenLabsTTS } from '@/services/elevenlabs-tts';
import { AudioUtils } from '@/lib/audio-utils';

interface CalorieAnalysisResultProps {
  result: string;
  timestamp: Date;
  onLike?: () => void;
}

export const CalorieAnalysisResult: React.FC<CalorieAnalysisResultProps> = ({ 
  result, 
  timestamp, 
  onLike 
}) => {
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
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const text = part.slice(2, -2);
        return (
          <span key={index} className="font-bold text-base">
            {text}
          </span>
        );
      }
      return part;
    });
  };

  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "Скопировано!",
        description: "Результат анализа скопирован в буфер обмена",
      });
    } catch (error) {
      console.error('Error copying message:', error);
      toast({
        title: "Ошибка копирования",
        description: "Не удалось скопировать результат",
        variant: "destructive",
      });
    }
  };

  const handleSpeakMessage = async (content: string) => {
    try {
      // Запускаем непрерывный звук обработки
      AudioUtils.startProcessingSound();
      await ElevenLabsTTS.speak(content);
      // Останавливаем звук обработки
      AudioUtils.stopProcessingSound();
      toast({
        title: "🔊 Воспроизведение",
        description: "Результат анализа озвучен",
      });
    } catch (error) {
      // Останавливаем звук обработки при ошибке
      AudioUtils.stopProcessingSound();
      console.error('Error speaking message:', error);
      toast({
        title: "❌ Ошибка воспроизведения",
        description: "Не удалось воспроизвести результат",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex gap-3 justify-start">
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarFallback className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
          <Bot className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>
      
      <div className="max-w-[80%] space-y-2">
        <div className="px-4 py-3 rounded-2xl bg-muted">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
              <Clock className="w-3 h-3 text-green-500" />
            </div>
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              📊 Анализ калорийности
            </p>
          </div>
          <div className="text-sm whitespace-pre-wrap">
            {formatMessageContent(result)}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {formatTime(timestamp)}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => handleCopyMessage(result)}
              title="Копировать результат"
            >
              <Copy className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => handleSpeakMessage(result)}
              title="Озвучить результат"
            >
              <Volume2 className="w-3 h-3" />
            </Button>
            {onLike && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={onLike}
                title="Понравился анализ"
              >
                <ThumbsUp className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
