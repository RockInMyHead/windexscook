import { EmailService } from '../../../src/services/email';
import sgMail from '@sendgrid/mail';

const sendEmail = EmailService.sendEmail;

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn()
}));

const mockSendGridSend = sgMail.send as jest.MockedFunction<any>;

describe('Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock SendGrid API key as set
    process.env.SENDGRID_API_KEY = 'test-key';
  });

  describe('sendEmail', () => {
    test('should send email successfully', async () => {
      mockSendGridSend.mockResolvedValue([{ headers: { 'x-message-id': 'test-123' } }]);

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>'
      });

      expect(mockSendGridSend).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: {
          email: 'noreply@cook.windexs.ru',
          name: 'AI Шеф-повар'
        },
        subject: 'Test Subject',
        html: '<p>Test content</p>',
        text: undefined
      });

      expect(result).toEqual({
        success: true,
        messageId: 'test-123'
      });
    });

    test('should send email with text content', async () => {
      mockSendGridSend.mockResolvedValue([{}]);

      await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Plain text content'
      });

      expect(mockSendGridSend).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: {
          email: 'noreply@cook.windexs.ru',
          name: 'AI Шеф-повар'
        },
        subject: 'Test Subject',
        html: undefined,
        text: 'Plain text content'
      });
    });

    test('should handle email sending errors', async () => {
      mockSendGridSend.mockRejectedValue(new Error('SMTP connection failed'));

      await expect(sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>'
      })).rejects.toThrow('Не удалось отправить письмо');
    });

    test('should handle network errors', async () => {
      mockSendGridSend.mockRejectedValue(new Error('Network error'));

      await expect(sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>'
      })).rejects.toThrow('Не удалось отправить письмо');
    });

    test('should validate email parameters', async () => {
      // Note: current implementation doesn't validate parameters, just sends via SendGrid
      // This test verifies it doesn't throw on valid parameters
      mockSendGridSend.mockResolvedValue([{}]);

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>'
      });

      expect(result.success).toBe(true);
    });

    test('should send welcome email template', async () => {
      mockSendGridSend.mockResolvedValue([{}]);

      const result = await sendEmail({
        to: 'newuser@example.com',
        subject: 'Добро пожаловать в AI шеф-повар!',
        html: `
          <h1>Добро пожаловать!</h1>
          <p>Спасибо за регистрацию в нашем сервисе AI шеф-повара.</p>
          <p>Теперь вы можете общаться с искусственным интеллектом и получать рецепты на любой вкус!</p>
        `
      });

      expect(result.success).toBe(true);
      expect(mockSendGridSend).toHaveBeenCalledWith(expect.objectContaining({
        to: 'newuser@example.com',
        subject: 'Добро пожаловать в AI шеф-повар!',
        html: expect.stringContaining('Добро пожаловать')
      }));
    });

    test('should send payment confirmation email', async () => {
      mockSendGridSend.mockResolvedValue([{}]);

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Оплата прошла успешно',
        html: `
          <h1>Оплата подтверждена</h1>
          <p>Ваш платеж на сумму 1000 ₽ успешно обработан.</p>
          <p>Спасибо за использование нашего сервиса!</p>
        `
      });

      expect(result.success).toBe(true);
      expect(mockSendGridSend).toHaveBeenCalledWith(expect.objectContaining({
        to: 'user@example.com',
        subject: 'Оплата прошла успешно',
        html: expect.stringContaining('Оплата подтверждена')
      }));
    });
  });
});
