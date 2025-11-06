// Утилиты для работы с аудио
import { BrowserCompatibility } from './browser-compatibility';

export class AudioUtils {
  private static audioContext: AudioContext | null = null;
  private static audioSupported: boolean | null = null;
  private static processingSoundInterval: number | null = null;
  private static isProcessingSoundActive: boolean = false;

  /**
   * Проверить поддержку аудио
   */
  static isAudioSupported(): boolean {
    if (this.audioSupported === null) {
      const caps = BrowserCompatibility.getCapabilities();
      this.audioSupported = caps.webAudio;
    }
    return this.audioSupported;
  }

  // Инициализация AudioContext
  private static initAudioContext(): AudioContext {
    if (!this.audioContext) {
      if (!this.isAudioSupported()) {
        throw new Error('Web Audio API не поддерживается в этом браузере');
      }

      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }
    return this.audioContext;
  }

  // Запуск непрерывного звука обработки (пик каждые 1.5 секунды)
  static async startProcessingSound(): Promise<void> {
    if (!this.isAudioSupported()) {
      console.log('🔇 [Audio] Web Audio API не поддерживается, звук не воспроизводится');
      return;
    }

    if (this.isProcessingSoundActive) {
      console.log('🔊 [Audio] Звук обработки уже активен');
      return;
    }

    try {
      const audioContext = this.initAudioContext();

      // Если контекст приостановлен, возобновляем
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      this.isProcessingSoundActive = true;
      console.log('🎵 [Audio] Звук обработки запущен - пик каждые 1.5 секунды');

      // Функция воспроизведения одного пика
      const playSingleBeep = () => {
        if (!this.isProcessingSoundActive) return;

        const duration = 0.1; // длительность одного "пика" в секундах
        const frequency = 800; // частота звука в Hz

        // Создаем осциллятор для генерации звука
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        // Подключаем к выходу
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Настраиваем звук
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = 'sine';

        // Настраиваем громкость (плавное нарастание и затухание)
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

        // Запускаем и останавливаем
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);

        console.log(`🔊 [Audio] Пик воспроизведен (${new Date().toISOString()})`);
      };

      // Воспроизводим первый пик сразу
      playSingleBeep();

      // Затем воспроизводим пик каждые 1.5 секунды
      this.processingSoundInterval = window.setInterval(playSingleBeep, 1500);

    } catch (error) {
      console.error('❌ [Audio] Ошибка запуска звука обработки:', error);
      this.isProcessingSoundActive = false;
    }
  }

  // Остановка звука обработки
  static stopProcessingSound(): void {
    if (this.processingSoundInterval) {
      clearInterval(this.processingSoundInterval);
      this.processingSoundInterval = null;
    }
    this.isProcessingSoundActive = false;
    console.log('🔇 [Audio] Звук обработки остановлен');
  }

  // Устаревший метод для обратной совместимости (теперь просто вызывает startProcessingSound)
  static async playProcessingSound(): Promise<void> {
    return this.startProcessingSound();
  }

  // Остановка всех звуков
  static stopAllSounds(): void {
    // Останавливаем звук обработки
    this.stopProcessingSound();

    if (!this.isAudioSupported()) {
      return;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
        this.audioContext = null;
        console.log('🔇 [Audio] Все звуки остановлены');
      } catch (error) {
        console.error('❌ [Audio] Ошибка остановки звуков:', error);
      }
    }
  }
}
