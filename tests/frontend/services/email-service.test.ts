import { sendEmail } from '../../../src/services/email';

// Mock fetch
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendEmail', () => {
    test('should send email successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true, messageId: 'test-123' })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>'
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: 'test@example.com',
          subject: 'Test Subject',
          html: '<p>Test content</p>'
        })
      });

      expect(result).toEqual({
        success: true,
        messageId: 'test-123'
      });
    });

    test('should send email with text content', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Plain text content'
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: 'test@example.com',
          subject: 'Test Subject',
          text: 'Plain text content'
        })
      });
    });

    test('should handle email sending errors', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockResolvedValue({ error: 'SMTP connection failed' })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>'
      })).rejects.toThrow('SMTP connection failed');
    });

    test('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>'
      })).rejects.toThrow('Network error');
    });

    test('should validate email parameters', async () => {
      await expect(sendEmail({
        to: '',
        subject: 'Test Subject',
        html: '<p>Test</p>'
      })).rejects.toThrow();

      await expect(sendEmail({
        to: 'test@example.com',
        subject: '',
        html: '<p>Test</p>'
      })).rejects.toThrow();

      await expect(sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: ''
      })).rejects.toThrow();
    });

    test('should send welcome email template', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await sendEmail({
        to: 'newuser@example.com',
        subject: 'Добро пожаловать в AI шеф-повар!',
        html: `
          <h1>Добро пожаловать!</h1>
          <p>Спасибо за регистрацию в нашем сервисе AI шеф-повара.</p>
          <p>Теперь вы можете общаться с искусственным интеллектом и получать рецепты на любой вкус!</p>
        `
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/email/send', expect.objectContaining({
        body: expect.stringContaining('Добро пожаловать')
      }));
    });

    test('should send payment confirmation email', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await sendEmail({
        to: 'user@example.com',
        subject: 'Оплата прошла успешно',
        html: `
          <h1>Оплата подтверждена</h1>
          <p>Ваш платеж на сумму 1000 ₽ успешно обработан.</p>
          <p>Спасибо за использование нашего сервиса!</p>
        `
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/email/send', expect.objectContaining({
        body: expect.stringContaining('Оплата подтверждена')
      }));
    });
  });
});
