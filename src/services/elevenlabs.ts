// ElevenLabs API Service
export class ElevenLabsService {
  private static readonly BASE_URL = 'https://api.elevenlabs.io/v1';
  private static readonly WEBSOCKET_URL = 'wss://api.elevenlabs.io/v1/convai/conversation';
  private static readonly MIRROR_URL = 'https://app.elevenlabs.io/mirror';
  
  // Конфигурация агента
  private static readonly AGENT_CONFIG = {
    agentId: 'agent_8701k5ywr031f5e86wjzba6m45ed',
    apiKey: 'sk_6fd6eec1a1f22584d4196153f693da3d58c8ca6d6de0248d'
  };

  /**
   * Создает WebSocket соединение с ElevenLabs
   */
  static async createWebSocketConnection(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      console.log('🔌 Создаем WebSocket соединение с ElevenLabs...');
      console.log('URL:', this.WEBSOCKET_URL);
      
      const ws = new WebSocket(this.WEBSOCKET_URL);
      let configSent = false;
      
      ws.onopen = () => {
        console.log('✅ Connected to ElevenLabs WebSocket');
        
        // Отправляем конфигурацию агента - пробуем разные форматы
        const configMessage = {
          type: 'start_conversation',
          payload: {
            agent_id: this.AGENT_CONFIG.agentId,
            api_key: this.AGENT_CONFIG.apiKey
          }
        };
        
        console.log('📤 Отправляем конфигурацию агента:', configMessage);
        ws.send(JSON.stringify(configMessage));
        
        // Если первый формат не работает, пробуем альтернативный
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const altConfigMessage = {
              type: 'init',
              agent_id: this.AGENT_CONFIG.agentId,
              api_key: this.AGENT_CONFIG.apiKey
            };
            console.log('📤 Отправляем альтернативную конфигурацию:', altConfigMessage);
            ws.send(JSON.stringify(altConfigMessage));
          }
        }, 500);
        configSent = true;
        
        // Даем время на обработку конфигурации
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            resolve(ws);
          }
        }, 1000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Получено сообщение от ElevenLabs:', data);
          
          if (data.type === 'error') {
            console.error('❌ ElevenLabs error:', data.message);
            reject(new Error(data.message || 'Ошибка конфигурации агента'));
          } else if (data.type === 'agent_ready' || data.type === 'conversation_started' || data.type === 'ready') {
            console.log('✅ Агент готов к работе');
            resolve(ws);
          } else if (data.type === 'success') {
            console.log('✅ Конфигурация принята');
            resolve(ws);
          }
        } catch (error) {
          console.error('❌ Ошибка парсинга сообщения:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ ElevenLabs WebSocket error:', error);
        reject(new Error('Ошибка подключения к ElevenLabs'));
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket соединение закрыто:', event.code, event.reason);
        if (!configSent) {
          reject(new Error(`WebSocket закрыт до отправки конфигурации: ${event.code} ${event.reason}`));
        }
      };
    });
  }

  /**
   * Получает информацию об агенте
   */
  static async getAgentInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.BASE_URL}/convai/agent/${this.AGENT_CONFIG.agentId}`, {
        headers: {
          'Authorization': `Bearer ${this.AGENT_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching agent info:', error);
      throw error;
    }
  }

  /**
   * Отправляет аудио сообщение агенту
   */
  static async sendAudioMessage(audioBlob: Blob): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('agent_id', this.AGENT_CONFIG.agentId);

      const response = await fetch(`${this.BASE_URL}/convai/conversation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.AGENT_CONFIG.apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error sending audio message:', error);
      throw error;
    }
  }

  /**
   * Получает доступ к камере и микрофону
   */
  static async getMediaStream(): Promise<MediaStream> {
    try {
      console.log('📹 Запрашиваем доступ к медиа устройствам...');
      console.log('Доступные устройства:', await navigator.mediaDevices.enumerateDevices());
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('✅ Получен медиа поток:', stream);
      console.log('Видео треки:', stream.getVideoTracks());
      console.log('Аудио треки:', stream.getAudioTracks());
      
      return stream;
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      throw new Error('Не удалось получить доступ к камере и микрофону');
    }
  }

  /**
   * Создает MediaRecorder для записи аудио
   */
  static createAudioRecorder(stream: MediaStream): MediaRecorder {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error('Аудио трек не найден');
    }

    const audioStream = new MediaStream(audioTracks);
    const recorder = new MediaRecorder(audioStream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    return recorder;
  }

  /**
   * Воспроизводит аудио ответ
   */
  static async playAudioResponse(audioData: string): Promise<void> {
    try {
      // Декодируем base64 аудио данные
      const audioBuffer = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);

      const audio = new Audio(audioUrl);
      audio.volume = 0.8;
      
      await audio.play();
      
      // Очищаем URL после воспроизведения
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    } catch (error) {
      console.error('Error playing audio response:', error);
      throw error;
    }
  }

  /**
   * Проверяет поддержку WebRTC в браузере
   */
  static checkWebRTCSupport(): boolean {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      window.WebSocket &&
      window.MediaRecorder
    );
  }

  /**
   * Получает URL для зеркала ElevenLabs
   */
  static getMirrorUrl(): string {
    // Используем правильный URL для зеркала ElevenLabs
    return `https://elevenlabs.io/app/agents/${this.AGENT_CONFIG.agentId}`;
  }

  /**
   * Создает iframe для встраивания зеркала
   */
  static createMirrorIframe(): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.src = this.getMirrorUrl();
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';
    iframe.allow = 'camera; microphone; autoplay';
    
    return iframe;
  }

  /**
   * Обрабатывает ошибки ElevenLabs API
   */
  static handleError(error: any): string {
    if (error.message) {
      return error.message;
    }
    
    if (error.status) {
      switch (error.status) {
        case 401:
          return 'Неверный API ключ ElevenLabs';
        case 403:
          return 'Доступ запрещен. Проверьте права доступа';
        case 404:
          return 'Агент не найден';
        case 429:
          return 'Превышен лимит запросов. Попробуйте позже';
        case 500:
          return 'Внутренняя ошибка сервера ElevenLabs';
        default:
          return `Ошибка API: ${error.status}`;
      }
    }
    
    return 'Неизвестная ошибка при работе с ElevenLabs';
  }
}
