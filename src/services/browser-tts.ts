// Browser Text-to-Speech Service (Fallback)
export class BrowserTTS {
  /**
   * Проверяет поддержку браузерного TTS
   */
  static isSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  /**
   * Получает список доступных голосов
   */
  static getVoices(): SpeechSynthesisVoice[] {
    return speechSynthesis.getVoices();
  }

  /**
   * Преобразует текст в речь и воспроизводит
   */
  static async speak(text: string, options?: {
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: SpeechSynthesisVoice;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        reject(new Error('Браузер не поддерживает синтез речи'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Настройки по умолчанию
      utterance.rate = options?.rate || 1;
      utterance.pitch = options?.pitch || 1;
      utterance.volume = options?.volume || 1;
      
      if (options?.voice) {
        utterance.voice = options.voice;
      }

      utterance.onend = () => {
        console.log('✅ Браузерный TTS завершен');
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('❌ Ошибка браузерного TTS:', event.error);
        reject(new Error(`Ошибка синтеза речи: ${event.error}`));
      };

      console.log('🔊 Воспроизводим через браузерный TTS:', text);
      speechSynthesis.speak(utterance);
    });
  }

  /**
   * Останавливает текущее воспроизведение
   */
  static stop(): void {
    speechSynthesis.cancel();
  }

  /**
   * Проверяет, воспроизводится ли речь
   */
  static isSpeaking(): boolean {
    return speechSynthesis.speaking;
  }
}

