import { AudioUtils } from '@/lib/audio-utils';
import { BrowserCompatibility } from '@/lib/browser-compatibility';

export class OpenAITTS {
  private static currentAudio: HTMLAudioElement | null = null;
  private static requestId = 0;

  static async generateAudio(text: string, voice: string = 'alloy'): Promise<{blob: Blob, duration?: number}> {
    const requestId = ++this.requestId;
    const startTime = Date.now();

    // Проверяем совместимость браузера
    const caps = BrowserCompatibility.getCapabilities();
    if (!caps.fetch) {
      throw new Error('Браузер не поддерживает Fetch API. Обновите браузер для использования TTS.');
    }

    try {
      console.log(`🔊 [OpenAI TTS #${requestId}] ===== НАЧАЛО ГЕНЕРАЦИИ АУДИО =====`);
      console.log(`📝 [OpenAI TTS #${requestId}] Текст для генерации:`, {
        textLength: text.length,
        voice,
        model: 'tts-1-hd',
        textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        fullText: text
      });

      console.log(`🌐 [OpenAI TTS #${requestId}] Отправляем запрос к API: /api/openai/tts`);

      // Создаем запрос к OpenAI TTS API
      const response = await fetch('/api/openai/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice,
          model: 'tts-1-hd'
        }),
      });

      const requestTime = Date.now() - startTime;
      console.log(`📡 [OpenAI TTS #${requestId}] Ответ получен за ${requestTime}ms:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        // Пытаемся получить детали ошибки от сервера
        let errorDetails = `TTS API error: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.details) {
            errorDetails += ` - ${JSON.stringify(errorData.details)}`;
          }
          if (errorData.openai_status) {
            errorDetails += ` (OpenAI status: ${errorData.openai_status})`;
          }
        } catch (parseError) {
          // Игнорируем ошибки парсинга
        }
        throw new Error(errorDetails);
      }

      console.log('✅ [OpenAI TTS #' + requestId + '] Аудио данные получены успешно');

      // Получаем аудио данные
      const audioBlob = await response.blob();

      console.log('🎵 [OpenAI TTS #' + requestId + '] Аудио файл создан:', {
        blobSize: audioBlob.size,
        blobType: audioBlob.type,
        blobSizeKB: Math.round(audioBlob.size / 1024) + ' KB'
      });

      const requestDuration = Date.now() - startTime;
      console.log(`⏱️ [OpenAI TTS #${requestId}] Время генерации: ${requestDuration}ms`);

      return { blob: audioBlob };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error('❌ [OpenAI TTS #' + requestId + '] ===== ОШИБКА ГЕНЕРАЦИИ АУДИО =====');
      console.error(`⏱️ [OpenAI TTS #${requestId}] Время до ошибки: ${totalTime}ms`);
      console.error('🔍 [OpenAI TTS #' + requestId + '] Детали ошибки:', error);
      throw error;
    }
  }

  static async speak(text: string, voice: string = 'alloy'): Promise<void> {
    const requestId = ++this.requestId;
    const startTime = Date.now();

    // Проверяем совместимость браузера
    const caps = BrowserCompatibility.getCapabilities();
    if (!caps.fetch) {
      throw new Error('Браузер не поддерживает Fetch API. Обновите браузер для использования TTS.');
    }

    try {
      console.log(`🔊 [OpenAI TTS #${requestId}] ===== НАЧАЛО СИНТЕЗА РЕЧИ =====`);
      console.log(`📝 [OpenAI TTS #${requestId}] Текст для синтеза:`, {
        textLength: text.length,
        voice,
        model: 'tts-1-hd',
        textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        fullText: text
      });

      // Останавливаем предыдущее воспроизведение
      if (this.currentAudio) {
        console.log(`⏹️ [OpenAI TTS #${requestId}] Останавливаем предыдущее воспроизведение`);
        this.stop();
      }

      // Запускаем звук обработки во время синтеза речи (запрос к API)
      AudioUtils.startProcessingSound();

      console.log(`🌐 [OpenAI TTS #${requestId}] Отправляем запрос к API: /api/openai/tts`);

      // Создаем запрос к OpenAI TTS API
      const response = await fetch('/api/openai/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice,
          model: 'tts-1-hd'
        }),
      });

      const requestTime = Date.now() - startTime;
      console.log(`📡 [OpenAI TTS #${requestId}] Ответ получен за ${requestTime}ms:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        // Пытаемся получить детали ошибки от сервера
        let errorDetails = `TTS API error: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.details) {
            errorDetails += ` - ${JSON.stringify(errorData.details)}`;
          }
          if (errorData.openai_status) {
            errorDetails += ` (OpenAI status: ${errorData.openai_status})`;
          }
        } catch (parseError) {
          // Игнорируем ошибки парсинга
        }
        throw new Error(errorDetails);
      }

      console.log('✅ [OpenAI TTS #' + requestId + '] Аудио данные получены успешно');

      // Получаем аудио данные
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      console.log('🎵 [OpenAI TTS #' + requestId + '] Аудио файл создан:', {
        blobSize: audioBlob.size,
        blobType: audioBlob.type,
        audioUrl: audioUrl.substring(0, 50) + '...',
        blobSizeKB: Math.round(audioBlob.size / 1024) + ' KB'
      });

      // Создаем и воспроизводим аудио
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      console.log('🎧 [OpenAI TTS #' + requestId + '] Аудио элемент создан, готовимся к воспроизведению');

      return new Promise((resolve, reject) => {
        audio.onloadstart = () => {
          console.log('📥 [OpenAI TTS #' + requestId + '] Начало загрузки аудио');
        };

        audio.oncanplay = () => {
          console.log('🎵 [OpenAI TTS #' + requestId + '] Аудио готово к воспроизведению');
        };

        audio.onplay = () => {
          console.log('▶️ [OpenAI TTS #' + requestId + '] Воспроизведение началось');
          // Останавливаем звук обработки, так как теперь идет только воспроизведение
          AudioUtils.stopProcessingSound();
        };

        audio.onpause = () => {
          console.log('⏸️ [OpenAI TTS #' + requestId + '] Воспроизведение приостановлено');
        };

        audio.onended = () => {
          const totalTime = Date.now() - startTime;
          console.log('🏁 [OpenAI TTS #' + requestId + '] ===== ВОСПРОИЗВЕДЕНИЕ ЗАВЕРШЕНО =====');
          console.log(`⏱️ [OpenAI TTS #${requestId}] Общее время: ${totalTime}ms`);
          console.log(`📊 [OpenAI TTS #${requestId}] Статистика:`, {
            requestTime: requestTime + 'ms',
            totalTime: totalTime + 'ms',
            audioDuration: audio.duration ? Math.round(audio.duration * 1000) + 'ms' : 'неизвестно',
            textLength: text.length,
            voice: voice
          });
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          resolve();
        };

        audio.onerror = (error) => {
          console.error('❌ [OpenAI TTS #' + requestId + '] Ошибка воспроизведения аудио:', error);
          console.error('🔍 [OpenAI TTS #' + requestId + '] Детали ошибки:', {
            error: error,
            audioSrc: audio.src,
            audioReadyState: audio.readyState,
            audioNetworkState: audio.networkState
          });
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          reject(error);
        };

        console.log('🚀 [OpenAI TTS #' + requestId + '] Запускаем воспроизведение...');
        audio.play().catch((playError) => {
          console.error('❌ [OpenAI TTS #' + requestId + '] Ошибка запуска воспроизведения:', playError);
          reject(playError);
        });
      });

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error('❌ [OpenAI TTS #' + requestId + '] ===== ОШИБКА СИНТЕЗА РЕЧИ =====');
      console.error(`⏱️ [OpenAI TTS #${requestId}] Время до ошибки: ${totalTime}ms`);
      console.error('🔍 [OpenAI TTS #' + requestId + '] Детали ошибки:', error);
      // Останавливаем звук обработки при ошибке
      AudioUtils.stopProcessingSound();
      throw error;
    }
  }

  static stop(): void {
    if (this.currentAudio) {
      console.log('⏹️ [OpenAI TTS] Принудительная остановка воспроизведения');
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
      console.log('✅ [OpenAI TTS] Воспроизведение остановлено');
    } else {
      console.log('ℹ️ [OpenAI TTS] Нет активного воспроизведения для остановки');
    }
  }

  static isSupported(): boolean {
    console.log('🔍 [OpenAI TTS] Проверка поддержки: поддерживается через API');
    return true; // OpenAI TTS поддерживается через API
  }
}
