export class OpenAITTS {
  private static currentAudio: HTMLAudioElement | null = null;

  static async speak(text: string, voice: string = 'alloy'): Promise<void> {
    try {
      console.log(`🔊 [OpenAI TTS] Запрос синтеза речи:`, {
        textLength: text.length,
        voice,
        textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
      });

      // Останавливаем предыдущее воспроизведение
      this.stop();

      // Создаем запрос к OpenAI TTS API
      const response = await fetch('/api/openai/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice,
          model: 'tts-1'
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`);
      }

      console.log('✅ [OpenAI TTS] Аудио данные получены, размер:', response.headers.get('content-length') || 'неизвестно');

      // Получаем аудио данные
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      console.log('🎵 [OpenAI TTS] Создаем аудио элемент, размер файла:', audioBlob.size, 'байт');

      // Создаем и воспроизводим аудио
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      return new Promise((resolve, reject) => {
        audio.onended = () => {
          console.log('🏁 [OpenAI TTS] Воспроизведение завершено');
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          resolve();
        };

        audio.onerror = (error) => {
          console.error('❌ [OpenAI TTS] Ошибка воспроизведения аудио:', error);
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          reject(error);
        };

        console.log('▶️ [OpenAI TTS] Начинаем воспроизведение...');
        audio.play().catch(reject);
      });

    } catch (error) {
      console.error('❌ [OpenAI TTS] Ошибка синтеза речи:', error);
      throw error;
    }
  }

  static stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  static isSupported(): boolean {
    return true; // OpenAI TTS поддерживается через API
  }
}
