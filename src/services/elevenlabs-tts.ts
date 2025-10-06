// ElevenLabs Text-to-Speech Service
export class ElevenLabsTTS {
  private static readonly BASE_URL = '/api/elevenlabs';
  // API ключ теперь добавляется автоматически на сервере через прокси

  /**
   * Получает список доступных голосов
   */
  static async getVoices(): Promise<any[]> {
    try {
      console.log('🔍 Запрашиваем список голосов через прокси...');
      const response = await fetch(`${this.BASE_URL}/voices`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Error fetching voices:', error);
      throw error;
    }
  }

  /**
   * Синтезирует речь из текста (для тестов)
   */
  static async synthesizeSpeech(text: string, voiceId: string = 'JBFqnCBsd6RMkjVDRZzb'): Promise<Buffer> {
    try {
      console.log('📤 Отправляем запрос в ElevenLabs через прокси...');
      console.log('🎯 URL:', `${this.BASE_URL}/text-to-speech/${voiceId}`);
      console.log('📝 Текст:', text);
      
      const response = await fetch(`${this.BASE_URL}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });

      console.log('📡 Статус ответа:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Ошибка ответа:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log('✅ Получен аудио buffer, размер:', buffer.length, 'bytes');
      return buffer;
    } catch (error) {
      console.error('❌ Ошибка синтеза речи:', error);
      throw error;
    }
  }

  /**
   * Получает настройки голоса
   */
  static async getVoiceSettings(voiceId: string): Promise<any> {
    try {
      const response = await fetch(`${this.BASE_URL}/voices/${voiceId}/settings`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching voice settings:', error);
      throw error;
    }
  }

  /**
   * Преобразует текст в речь
   */
  static async textToSpeech(text: string, voiceId: string = 'pNInz6obpgDQGcFmaJgB'): Promise<Blob> {
    try {
      console.log('📤 Отправляем запрос в ElevenLabs через прокси...');
      console.log('🎯 URL:', `${this.BASE_URL}/text-to-speech/${voiceId}`);
      console.log('📝 Текст:', text);
      
      const response = await fetch(`${this.BASE_URL}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      });

      console.log('📡 Статус ответа:', response.status);
      console.log('📡 Заголовки ответа:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Ошибка ответа:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const blob = await response.blob();
      console.log('✅ Получен аудио blob, размер:', blob.size, 'bytes');
      return blob;
    } catch (error) {
      console.error('❌ Ошибка преобразования текста в речь:', error);
      throw error;
    }
  }

  /**
   * Воспроизводит аудио из blob
   */
  static async playAudio(audioBlob: Blob): Promise<void> {
    try {
      console.log('🔊 Начинаем воспроизведение аудио...');
      console.log('📊 Размер аудио:', audioBlob.size, 'bytes');
      console.log('📊 Тип аудио:', audioBlob.type);
      
      const audioUrl = URL.createObjectURL(audioBlob);
      console.log('🔗 Создан URL для аудио:', audioUrl);
      
      const audio = new Audio(audioUrl);
      console.log('🎵 Создан Audio элемент');
      
      // Добавляем обработчики событий для отладки
      audio.onloadstart = () => console.log('📥 Аудио начало загружаться');
      audio.onloadeddata = () => console.log('📥 Аудио данные загружены');
      audio.oncanplay = () => console.log('▶️ Аудио готово к воспроизведению');
      audio.onplay = () => console.log('▶️ Аудио воспроизводится');
      audio.onended = () => {
        console.log('🏁 Аудио закончилось');
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = (e) => console.error('❌ Ошибка воспроизведения аудио:', e);
      
      await audio.play();
      console.log('✅ Аудио запущено успешно');
    } catch (error) {
      console.error('❌ Ошибка воспроизведения аудио:', error);
      throw error;
    }
  }

  /**
   * Преобразует текст в речь и сразу воспроизводит
   */
  static async speak(text: string, voiceId?: string): Promise<void> {
    try {
      console.log('🎤 Преобразуем текст в речь через прокси:', text);
      
      const audioBlob = await this.textToSpeech(text, voiceId);
      console.log('🔊 Воспроизводим аудио, размер:', audioBlob.size, 'bytes');
      await this.playAudio(audioBlob);
      console.log('✅ Аудио воспроизведено успешно');
    } catch (error) {
      console.error('❌ Ошибка в функции speak:', error);
      throw error;
    }
  }

  /**
   * Получает информацию о голосе по ID
   */
  static async getVoiceInfo(voiceId: string): Promise<any> {
    try {
      const response = await fetch(`${this.BASE_URL}/voices/${voiceId}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching voice info:', error);
      throw error;
    }
  }

  /**
   * Тестирует API ключ, получая список голосов
   */
  static async testApiKey(): Promise<boolean> {
    try {
      console.log('🧪 Тестируем подключение к ElevenLabs через прокси...');
      const voices = await this.getVoices();
      console.log('✅ Подключение работает! Доступно голосов:', voices.length);
      return true;
    } catch (error) {
      console.error('❌ Подключение не работает:', error);
      return false;
    }
  }
}
