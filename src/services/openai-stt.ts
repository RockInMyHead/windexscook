import { AudioUtils } from '@/lib/audio-utils';
import { BrowserCompatibility } from '@/lib/browser-compatibility';

export class OpenAISTT {
  private static mediaRecorder: MediaRecorder | null = null;
  private static audioChunks: Blob[] = [];
  private static isRecording = false;

  /**
   * Проверяет поддержку записи аудио в браузере
   */
  static isSupported(): boolean {
    const caps = BrowserCompatibility.getCapabilities();
    return !!(caps.mediaRecorder && caps.getUserMedia);
  }

  /**
   * Начинает запись аудио
   */
  static async startRecording(): Promise<void> {
    if (this.isRecording) {
      throw new Error('Запись уже идет');
    }

    // Проверяем поддержку
    if (!this.isSupported()) {
      throw new Error('Браузер не поддерживает запись аудио');
    }

    try {
      console.log('🎤 [OpenAI STT] Запрашиваем доступ к микрофону...');

      // Запрашиваем доступ к микрофону
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000 // Оптимально для Whisper
        }
      });

      console.log('✅ [OpenAI STT] Доступ к микрофону получен');

      // Создаем MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus' // Современный формат для Whisper
      });

      this.audioChunks = [];
      this.isRecording = true;

      // Обрабатываем chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log(`📦 [OpenAI STT] Получен аудио chunk: ${event.data.size} bytes`);
        }
      };

      // Обрабатываем остановку
      this.mediaRecorder.onstop = () => {
        console.log('⏹️ [OpenAI STT] Запись остановлена');
        // Останавливаем все tracks
        stream.getTracks().forEach(track => track.stop());
      };

      // Начинаем запись
      this.mediaRecorder.start(100); // Сохраняем chunks каждые 100ms
      console.log('🎬 [OpenAI STT] Запись начата');

    } catch (error) {
      console.error('❌ [OpenAI STT] Ошибка при начале записи:', error);
      this.isRecording = false;
      throw new Error('Не удалось получить доступ к микрофону. Проверьте разрешения.');
    }
  }

  /**
   * Останавливает запись и возвращает транскрибацию
   */
  static async stopRecording(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.isRecording || !this.mediaRecorder) {
        reject(new Error('Запись не была начата'));
        return;
      }

      console.log('⏹️ [OpenAI STT] Останавливаем запись...');

      // Обрабатываем окончание записи
      this.mediaRecorder!.onstop = async () => {
        try {
          console.log(`📦 [OpenAI STT] Всего chunks: ${this.audioChunks.length}`);

          // Создаем Blob из chunks
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          console.log(`🎵 [OpenAI STT] Создан аудио файл: ${audioBlob.size} bytes`);

          // Конвертируем в WAV для лучшей совместимости с Whisper
          const wavBlob = await this.convertToWav(audioBlob);
          console.log(`🎵 [OpenAI STT] Конвертирован в WAV: ${wavBlob.size} bytes`);

          // Отправляем на транскрибацию
          const transcription = await this.transcribeAudio(wavBlob);
          console.log(`✅ [OpenAI STT] Транскрибация завершена: "${transcription}"`);

          this.isRecording = false;
          this.mediaRecorder = null;
          this.audioChunks = [];

          resolve(transcription);

        } catch (error) {
          console.error('❌ [OpenAI STT] Ошибка при обработке записи:', error);
          this.isRecording = false;
          this.mediaRecorder = null;
          this.audioChunks = [];
          reject(error);
        }
      };

      // Останавливаем запись
      this.mediaRecorder!.stop();
    });
  }

  /**
   * Отменяет запись без транскрибации
   */
  static cancelRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      console.log('🚫 [OpenAI STT] Отмена записи');

      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());

      this.isRecording = false;
      this.mediaRecorder = null;
      this.audioChunks = [];
    }
  }

  /**
   * Возвращает статус записи
   */
  static isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Конвертирует WebM в WAV для лучшей совместимости с Whisper
   */
  private static async convertToWav(webmBlob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const fileReader = new FileReader();

      fileReader.onload = async (event) => {
        try {
          const arrayBuffer = event.target!.result as ArrayBuffer;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Конвертируем в WAV
          const wavBlob = this.audioBufferToWav(audioBuffer);
          audioContext.close();
          resolve(wavBlob);
        } catch (error) {
          audioContext.close();
          reject(error);
        }
      };

      fileReader.onerror = () => reject(new Error('Ошибка чтения аудио файла'));
      fileReader.readAsArrayBuffer(webmBlob);
    });
  }

  /**
   * Конвертирует AudioBuffer в WAV Blob
   */
  private static audioBufferToWav(buffer: AudioBuffer): Blob {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // PCM data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Отправляет аудио на транскрибацию через OpenAI API
   */
  private static async transcribeAudio(audioBlob: Blob): Promise<string> {
    console.log('🌐 [OpenAI STT] Отправляем аудио на транскрибацию...');

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', 'ru');
    formData.append('response_format', 'text');

    const response = await fetch('/api/openai/v1/audio/transcriptions', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [OpenAI STT] Ошибка транскрибации:', errorText);
      throw new Error(`Ошибка транскрибации: ${response.status}`);
    }

    const transcription = await response.text();
    return transcription.trim();
  }

  /**
   * Записывает аудио и возвращает транскрибацию (удобный метод)
   */
  static async recordAndTranscribe(): Promise<string> {
    try {
      console.log('🎤 [OpenAI STT] Начинаем запись и транскрибацию...');
      AudioUtils.startProcessingSound();

      await this.startRecording();

      // Ждем немного для начала записи
      await new Promise(resolve => setTimeout(resolve, 500));

      // Здесь нужно внешнее управление остановкой записи
      // В реальном приложении это делается через UI

      return await this.stopRecording();

    } catch (error) {
      AudioUtils.stopProcessingSound();
      throw error;
    }
  }
}
