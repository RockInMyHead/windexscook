// Утилиты для проверки совместимости браузера и предоставления fallback'ов

export interface BrowserCapabilities {
  // Аудио
  webAudio: boolean;
  mediaDevices: boolean;
  getUserMedia: boolean;

  // Распознавание речи
  speechRecognition: boolean;
  webkitSpeechRecognition: boolean;

  // Синтез речи
  speechSynthesis: boolean;

  // Fetch API
  fetch: boolean;

  // Другие возможности
  localStorage: boolean;
  sessionStorage: boolean;
  indexedDB: boolean;
  serviceWorker: boolean;

  // Современные API
  intersectionObserver: boolean;
  mutationObserver: boolean;
  resizeObserver: boolean;
}

export class BrowserCompatibility {
  private static capabilities: BrowserCapabilities | null = null;

  /**
   * Получить возможности браузера
   */
  static getCapabilities(): BrowserCapabilities {
    if (this.capabilities) {
      return this.capabilities;
    }

    const win = window as any;

    this.capabilities = {
      // Аудио API
      webAudio: !!(win.AudioContext || win.webkitAudioContext),
      mediaDevices: !!navigator.mediaDevices,
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),

      // Распознавание речи
      speechRecognition: !!win.SpeechRecognition,
      webkitSpeechRecognition: !!win.webkitSpeechRecognition,

      // Синтез речи
      speechSynthesis: !!win.speechSynthesis,

      // Fetch API
      fetch: !!win.fetch,

      // Хранилища
      localStorage: this.checkLocalStorage(),
      sessionStorage: this.checkSessionStorage(),
      indexedDB: !!win.indexedDB,

      // Service Worker
      serviceWorker: !!navigator.serviceWorker,

      // Современные API
      intersectionObserver: !!win.IntersectionObserver,
      mutationObserver: !!win.MutationObserver,
      resizeObserver: !!win.ResizeObserver,
    };

    return this.capabilities;
  }

  /**
   * Проверить localStorage
   */
  private static checkLocalStorage(): boolean {
    try {
      const test = '__browser_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Проверить sessionStorage
   */
  private static checkSessionStorage(): boolean {
    try {
      const test = '__browser_test__';
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Получить информацию о браузере
   */
  static getBrowserInfo() {
    const ua = navigator.userAgent;
    const browser = {
      isChrome: /Chrome/.test(ua) && !/Edg/.test(ua),
      isFirefox: /Firefox/.test(ua),
      isSafari: /Safari/.test(ua) && !/Chrome/.test(ua),
      isEdge: /Edg/.test(ua),
      isOpera: /Opera/.test(ua) || /OPR/.test(ua),
      isIE: /MSIE|Trident/.test(ua),
      isMobile: /Mobile|Mobi|Android|iPhone|iPad|iPod/.test(ua),
      version: this.getBrowserVersion(ua)
    };

    return {
      userAgent: ua,
      ...browser,
      capabilities: this.getCapabilities()
    };
  }

  /**
   * Получить версию браузера
   */
  private static getBrowserVersion(ua: string): string {
    const browsers = [
      { name: 'Chrome', regex: /Chrome\/(\d+)/ },
      { name: 'Firefox', regex: /Firefox\/(\d+)/ },
      { name: 'Safari', regex: /Version\/(\d+)/ },
      { name: 'Edge', regex: /Edg\/(\d+)/ },
      { name: 'Opera', regex: /OPR\/(\d+)/ },
      { name: 'IE', regex: /MSIE (\d+)/ }
    ];

    for (const browser of browsers) {
      const match = ua.match(browser.regex);
      if (match) {
        return match[1];
      }
    }

    return 'unknown';
  }

  /**
   * Проверить минимальные требования для работы приложения
   */
  static checkMinimumRequirements(): { passed: boolean; issues: string[] } {
    const caps = this.getCapabilities();
    const issues: string[] = [];

    // Обязательные возможности
    if (!caps.fetch) {
      issues.push('Fetch API не поддерживается. Обновите браузер.');
    }

    if (!caps.webAudio) {
      issues.push('Web Audio API не поддерживается. Используйте современный браузер.');
    }

    if (!caps.localStorage) {
      issues.push('LocalStorage недоступен. Возможно, включен приватный режим.');
    }

    // Рекомендуемые возможности
    if (!caps.getUserMedia) {
      issues.push('getUserMedia не поддерживается. Голосовые функции могут не работать.');
    }

    if (!caps.speechRecognition && !caps.webkitSpeechRecognition) {
      issues.push('Speech Recognition API не поддерживается. Голосовые команды недоступны.');
    }

    return {
      passed: issues.length === 0,
      issues
    };
  }

  /**
   * Создать полифиллы для устаревших браузеров
   */
  static applyPolyfills() {
    // Полифилл для requestAnimationFrame
    if (!window.requestAnimationFrame) {
      (window as any).requestAnimationFrame = (callback: Function) => {
        return setTimeout(callback, 16); // ~60fps
      };
    }

    // Полифилл для performance.now
    if (!window.performance) {
      (window as any).performance = {};
    }

    if (!window.performance.now) {
      const start = Date.now();
      window.performance.now = () => Date.now() - start;
    }

    // Полифилл для Object.assign
    if (!Object.assign) {
      Object.assign = function(target: any, ...sources: any[]) {
        for (const source of sources) {
          if (source) {
            for (const key in source) {
              if (source.hasOwnProperty(key)) {
                target[key] = source[key];
              }
            }
          }
        }
        return target;
      };
    }
  }

  /**
   * Создать безопасный fetch с fallback'ом
   */
  static async safeFetch(url: string, options?: RequestInit): Promise<Response> {
    const caps = this.getCapabilities();

    if (caps.fetch) {
      return fetch(url, options);
    }

    // Fallback для очень старых браузеров (XMLHttpRequest)
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.onload = () => {
        // Создаем Response-like объект
        const response = {
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          statusText: xhr.statusText,
          text: () => Promise.resolve(xhr.responseText),
          json: () => Promise.resolve(JSON.parse(xhr.responseText)),
          blob: () => Promise.resolve(new Blob([xhr.response])),
          headers: {
            get: (name: string) => xhr.getResponseHeader(name)
          }
        } as any;

        resolve(response);
      };

      xhr.onerror = () => reject(new Error('Network request failed'));
      xhr.ontimeout = () => reject(new Error('Request timeout'));

      xhr.open(options?.method || 'GET', url);

      if (options?.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
          xhr.setRequestHeader(key, value as string);
        }
      }

      xhr.send(options?.body as any);
    });
  }
}
