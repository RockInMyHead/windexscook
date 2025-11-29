const puppeteer = require('puppeteer');
const path = require('path');

describe('Voice Chat E2E Flow', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();

    // Set up console logging
    page.on('console', msg => {
      console.log('PAGE LOG:', msg.text());
    });

    // Set up error logging
    page.on('pageerror', error => {
      console.error('PAGE ERROR:', error.message);
    });

    // Mock permissions for media access
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: async () => {
            return {
              getTracks: () => [{
                stop: () => {}
              }]
            };
          }
        }
      });

      // Mock SpeechRecognition
      window.SpeechRecognition = class {
        constructor() {
          this.continuous = false;
          this.interimResults = false;
          this.lang = 'ru-RU';
          this.maxAlternatives = 1;
        }

        start() {
          // Simulate speech recognition result after a delay
          setTimeout(() => {
            if (this.onresult) {
              this.onresult({
                results: [[{
                  transcript: 'расскажи рецепт борща',
                  confidence: 0.9
                }]],
                resultIndex: 0
              });
            }
            if (this.onend) {
              this.onend();
            }
          }, 100);
        }

        stop() {
          if (this.onend) {
            this.onend();
          }
        }
      };

      // Mock Audio
      window.Audio = class {
        constructor(src) {
          this.src = src;
          this.volume = 1;
          this.muted = false;
          this.currentTime = 0;
        }

        play() {
          return Promise.resolve();
        }

        pause() {}

        load() {}
      };

      // Mock fetch for API calls
      window.fetch = async (url, options) => {
        if (url.includes('/api/chat')) {
          return {
            ok: true,
            body: new ReadableStream({
              start(controller) {
                const response = 'Конечно! Вот рецепт классического украинского борща на 4 порции...';
                controller.enqueue(new TextEncoder().encode(response));
                controller.close();
              }
            })
          };
        }

        if (url.includes('/api/openai/tts')) {
          return {
            ok: true,
            blob: () => Promise.resolve(new Blob(['audio data']))
          };
        }

        return {
          ok: false,
          status: 404,
          statusText: 'Not Found'
        };
      };
    });
  });

  afterEach(async () => {
    await page.close();
  });

  test('complete voice chat flow', async () => {
    // Navigate to the voice chat page
    await page.goto('http://localhost:8080/my-chef', {
      waitUntil: 'networkidle0'
    });

    // Wait for the page to load
    await page.waitForSelector('[data-testid="voice-call-interface"]', {
      timeout: 10000
    });

    // Check initial state
    const initialStatus = await page.$eval('[data-testid="status-text"]', el => el.textContent);
    expect(initialStatus).toContain('Нажмите на микрофон');

    // Click the microphone button to start recording
    const micButton = await page.$('[data-testid="mic-button"]');
    await micButton.click();

    // Wait for recording to start
    await page.waitForFunction(() => {
      const statusElement = document.querySelector('[data-testid="status-text"]');
      return statusElement && statusElement.textContent.includes('Слушаю');
    }, { timeout: 5000 });

    // Check that status changed to "listening"
    const listeningStatus = await page.$eval('[data-testid="status-text"]', el => el.textContent);
    expect(listeningStatus).toContain('Слушаю');

    // Wait for speech recognition to complete and response to be processed
    await page.waitForFunction(() => {
      const statusElement = document.querySelector('[data-testid="status-text"]');
      return statusElement && statusElement.textContent.includes('Думаю');
    }, { timeout: 10000 });

    // Check that LLM is processing
    const processingStatus = await page.$eval('[data-testid="status-text"]', el => el.textContent);
    expect(processingStatus).toContain('Думаю');

    // Wait for TTS to start
    await page.waitForFunction(() => {
      const statusElement = document.querySelector('[data-testid="status-text"]');
      return statusElement && statusElement.textContent.includes('Говорю');
    }, { timeout: 15000 });

    // Check that TTS is active
    const speakingStatus = await page.$eval('[data-testid="status-text"]', el => el.textContent);
    expect(speakingStatus).toContain('Говорю');

    // Wait for TTS to complete
    await page.waitForFunction(() => {
      const statusElement = document.querySelector('[data-testid="status-text"]');
      return statusElement && statusElement.textContent.includes('Нажмите на микрофон');
    }, { timeout: 10000 });

    // Verify the conversation was successful
    const finalStatus = await page.$eval('[data-testid="status-text"]', el => el.textContent);
    expect(finalStatus).toContain('Нажмите на микрофон');

    // Check that no errors occurred
    const errorElements = await page.$$('[data-testid="error-message"]');
    expect(errorElements.length).toBe(0);
  });

  test('browser compatibility check', async () => {
    // Navigate to the voice chat page
    await page.goto('http://localhost:8080/my-chef', {
      waitUntil: 'networkidle0'
    });

    // Wait for the compatibility check to complete
    await page.waitForSelector('[data-testid="voice-call-interface"]', {
      timeout: 10000
    });

    // Check that no compatibility warning is shown (assuming modern browser)
    const warningElements = await page.$$('[data-testid="compatibility-warning"]');
    expect(warningElements.length).toBe(0);
  });

  test('interrupt functionality', async () => {
    // Navigate to the voice chat page
    await page.goto('http://localhost:8080/my-chef', {
      waitUntil: 'networkidle0'
    });

    // Start a conversation
    const micButton = await page.$('[data-testid="mic-button"]');
    await micButton.click();

    // Wait for TTS to start
    await page.waitForFunction(() => {
      const statusElement = document.querySelector('[data-testid="status-text"]');
      return statusElement && statusElement.textContent.includes('Говорю');
    }, { timeout: 15000 });

    // Check if interrupt button appears during speech
    const interruptButton = await page.$('[data-testid="interrupt-button"]');
    if (interruptButton) {
      // Click interrupt button
      await interruptButton.click();

      // Verify interruption worked
      await page.waitForFunction(() => {
        const statusElement = document.querySelector('[data-testid="status-text"]');
        return statusElement && statusElement.textContent.includes('Нажмите на микрофон');
      }, { timeout: 5000 });
    }
  });

  test('sound toggle functionality', async () => {
    // Navigate to the voice chat page
    await page.goto('http://localhost:8080/my-chef', {
      waitUntil: 'networkidle0'
    });

    // Find sound toggle button
    const soundButton = await page.$('[data-testid="sound-toggle"]');
    expect(soundButton).toBeTruthy();

    // Click to toggle sound off
    await soundButton.click();

    // Verify visual feedback (button should indicate sound is off)
    const buttonClass = await soundButton.getProperty('className');
    expect(buttonClass.toString()).toContain('destructive');

    // Click to toggle sound back on
    await soundButton.click();

    // Verify sound is back on
    const buttonClassOn = await soundButton.getProperty('className');
    expect(buttonClassOn.toString()).not.toContain('destructive');
  });

  test('error handling - network failure', async () => {
    // Mock network failure
    await page.evaluateOnNewDocument(() => {
      window.fetch = async () => {
        throw new Error('Network error');
      };
    });

    // Navigate to the voice chat page
    await page.goto('http://localhost:8080/my-chef', {
      waitUntil: 'networkidle0'
    });

    // Try to start conversation
    const micButton = await page.$('[data-testid="mic-button"]');
    await micButton.click();

    // Wait for error to be displayed
    await page.waitForSelector('[data-testid="error-message"]', {
      timeout: 10000
    });

    // Verify error message
    const errorMessage = await page.$eval('[data-testid="error-message"]', el => el.textContent);
    expect(errorMessage).toContain('Ошибка');
  });

  test('accessibility features', async () => {
    // Navigate to the voice chat page
    await page.goto('http://localhost:8080/my-chef', {
      waitUntil: 'networkidle0'
    });

    // Check ARIA labels
    const micButton = await page.$('[data-testid="mic-button"]');
    const ariaLabel = await micButton.getProperty('ariaLabel');
    expect(ariaLabel).toBeTruthy();

    // Check keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('performance - response time', async () => {
    const startTime = Date.now();

    // Navigate to the voice chat page
    await page.goto('http://localhost:8080/my-chef', {
      waitUntil: 'networkidle0'
    });

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds

    // Start conversation and measure response time
    const conversationStartTime = Date.now();

    const micButton = await page.$('[data-testid="mic-button"]');
    await micButton.click();

    // Wait for complete response cycle
    await page.waitForFunction(() => {
      const statusElement = document.querySelector('[data-testid="status-text"]');
      return statusElement && statusElement.textContent.includes('Нажмите на микрофон');
    }, { timeout: 30000 });

    const conversationTime = Date.now() - conversationStartTime;
    expect(conversationTime).toBeLessThan(20000); // Should complete within 20 seconds
  });
});
