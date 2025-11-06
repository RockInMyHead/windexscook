import nodemailer from 'nodemailer';
import { CustomSMTPServer } from './custom-smtp-server.js';

export class CustomEmailService {
  static transporter = null;
  static smtpServer = null;

  /**
   * Инициализация транспортера
   */
  static async initTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    console.log('📧 [CustomEmailService] Инициализируем email транспортер...');

    // Проверяем конфигурацию
    const config = this.getConfig();
    
    // В режиме разработки всегда используем собственный SMTP сервер
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    if (!config.isConfigured || isDevelopment) {
      console.log('⚠️ [CustomEmailService] Email не настроен или режим разработки, запускаем собственный SMTP сервер');
      
      // Запускаем собственный SMTP сервер
      if (!CustomSMTPServer.isServerRunning()) {
        await CustomSMTPServer.start();
      }
      
      // Создаем транспортер для собственного SMTP сервера
      const smtpConfig = {
        host: 'localhost',
        port: 2525,
        secure: false,
        ignoreTLS: true
      };

      // Добавляем аутентификацию если она включена
      if (CustomSMTPServer.authEnabled) {
        smtpConfig.auth = {
          user: CustomSMTPServer.username,
          pass: CustomSMTPServer.password
        };
        console.log(`🔐 [CustomEmailService] Используем аутентификацию: ${CustomSMTPServer.username}`);
      } else {
        smtpConfig.auth = false;
        console.log(`🔓 [CustomEmailService] Аутентификация отключена`);
      }

      this.transporter = nodemailer.createTransport(smtpConfig);
      
      console.log('✅ [CustomEmailService] Подключен к собственному SMTP серверу');
      return this.transporter;
    }

    // Создаем реальный транспортер для внешнего SMTP
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Проверяем соединение
    try {
      await this.transporter.verify();
      console.log('✅ [CustomEmailService] SMTP соединение установлено');
    } catch (error) {
      console.error('❌ [CustomEmailService] Ошибка SMTP соединения:', error);
      throw new Error('Не удалось установить SMTP соединение');
    }

    return this.transporter;
  }

  /**
   * Отправляет письмо для восстановления пароля
   */
  static async sendPasswordReset(email, resetToken) {
    try {
      console.log('📧 [CustomEmailService] Отправляем письмо восстановления пароля на:', email);
      
      const transporter = await this.initTransporter();
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
      
      const mailOptions = {
        from: {
          name: 'WindexsCook',
          address: process.env.SMTP_FROM_EMAIL || 'noreply@windexscook.ru'
        },
        to: email,
        subject: '🔐 Восстановление пароля - WindexsCook',
        html: this.getPasswordResetTemplate(resetUrl, email),
        text: this.getPasswordResetText(resetUrl, email)
      };

      console.log('📧 [CustomEmailService] Отправляем письмо с параметрами:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
      });

      const info = await transporter.sendMail(mailOptions);
      
      console.log('✅ [CustomEmailService] Письмо восстановления пароля отправлено:', info.messageId);
      return true;
      
    } catch (error) {
      console.error('❌ [CustomEmailService] Ошибка отправки письма:', error);
      console.error('❌ [CustomEmailService] Детали ошибки:', {
        message: error.message,
        code: error.code,
        response: error.response
      });
      throw new Error('Не удалось отправить письмо для восстановления пароля');
    }
  }

  /**
   * Отправляет приветственное письмо
   */
  static async sendWelcomeEmail(email, userName) {
    try {
      console.log('📧 [CustomEmailService] Отправляем приветственное письмо на:', email);
      
      const transporter = await this.initTransporter();
      
      const mailOptions = {
        from: {
          name: 'WindexsCook',
          address: process.env.SMTP_FROM_EMAIL || 'noreply@windexscook.ru'
        },
        to: email,
        subject: '🎉 Добро пожаловать в WindexsCook!',
        html: this.getWelcomeTemplate(userName),
        text: this.getWelcomeText(userName)
      };

      const info = await transporter.sendMail(mailOptions);
      
      console.log('✅ [CustomEmailService] Приветственное письмо отправлено:', info.messageId);
      return true;
      
    } catch (error) {
      console.error('❌ [CustomEmailService] Ошибка отправки приветственного письма:', error);
      throw new Error('Не удалось отправить приветственное письмо');
    }
  }

  /**
   * Отправляет письмо подтверждения премиум-подписки
   */
  static async sendPremiumConfirmation(email, userName) {
    try {
      console.log('📧 [CustomEmailService] Отправляем письмо подтверждения премиум-подписки на:', email);
      
      const transporter = await this.initTransporter();
      
      const mailOptions = {
        from: {
          name: 'WindexsCook',
          address: process.env.SMTP_FROM_EMAIL || 'noreply@windexscook.ru'
        },
        to: email,
        subject: '⭐ Премиум-подписка активирована!',
        html: this.getPremiumConfirmationTemplate(userName),
        text: this.getPremiumConfirmationText(userName)
      };

      const info = await transporter.sendMail(mailOptions);
      
      console.log('✅ [CustomEmailService] Письмо подтверждения премиум-подписки отправлено:', info.messageId);
      return true;
      
    } catch (error) {
      console.error('❌ [CustomEmailService] Ошибка отправки письма подтверждения премиум-подписки:', error);
      throw new Error('Не удалось отправить письмо подтверждения премиум-подписки');
    }
  }

  /**
   * Проверяет, настроен ли email сервис
   */
  static isConfigured() {
    const config = this.getConfig();
    return config.isConfigured;
  }

  /**
   * Получает статистику собственного SMTP сервера
   */
  static getSMTPStats() {
    return CustomSMTPServer.getStats();
  }

  /**
   * Получает все письма из собственного SMTP сервера
   */
  static getReceivedEmails() {
    return CustomSMTPServer.getEmails();
  }

  /**
   * Получает последнее полученное письмо
   */
  static getLastReceivedEmail() {
    return CustomSMTPServer.getLastEmail();
  }

  /**
   * Очищает очередь писем в собственном SMTP сервере
   */
  static clearReceivedEmails() {
    CustomSMTPServer.clearEmails();
  }

  /**
   * Останавливает собственный SMTP сервер
   */
  static async stopSMTPServer() {
    await CustomSMTPServer.stop();
  }

  /**
   * Получает конфигурацию
   */
  static getConfig() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    
    // Проверяем, что это не placeholder значения
    const isConfigured = !!(
      smtpHost && 
      smtpUser && 
      smtpPass && 
      smtpUser !== 'your-email@gmail.com' && 
      smtpPass !== 'your-app-password'
    );
    
    return {
      isConfigured,
      smtpHost: smtpHost || 'smtp.gmail.com',
      smtpPort: parseInt(process.env.SMTP_PORT || '587'),
      smtpSecure: process.env.SMTP_SECURE === 'true',
      smtpUser: smtpUser || '',
      smtpPass: smtpPass || '',
      fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@windexscook.ru',
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
    };
  }

  /**
   * HTML шаблон для письма восстановления пароля
   */
  static getPasswordResetTemplate(resetUrl, email) {
    return `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Восстановление пароля</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .button:hover { background: #5a6fd8; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Восстановление пароля</h1>
            <p>WindexsCook - Ваш AI повар</p>
          </div>
          <div class="content">
            <h2>Здравствуйте!</h2>
            <p>Вы запросили восстановление пароля для вашего аккаунта в WindexsCook.</p>
            <p>Для создания нового пароля нажмите на кнопку ниже:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Сбросить пароль</a>
            </div>
            <div class="warning">
              <strong>⚠️ Важно:</strong>
              <ul>
                <li>Ссылка действительна в течение 24 часов</li>
                <li>Если вы не запрашивали восстановление пароля, проигнорируйте это письмо</li>
                <li>Никому не передавайте эту ссылку</li>
              </ul>
            </div>
            <p>Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:</p>
            <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 5px; font-family: monospace;">${resetUrl}</p>
          </div>
          <div class="footer">
            <p>© 2025 WindexsCook. Все права защищены.</p>
            <p>Если у вас есть вопросы, обратитесь в поддержку: <a href="mailto:support@windexscook.ru">support@windexscook.ru</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Текстовый шаблон для письма восстановления пароля
   */
  static getPasswordResetText(resetUrl, email) {
    return `
Восстановление пароля - WindexsCook

Здравствуйте!

Вы запросили восстановление пароля для вашего аккаунта в WindexsCook.

Для создания нового пароля перейдите по ссылке:
${resetUrl}

ВАЖНО:
- Ссылка действительна в течение 24 часов
- Если вы не запрашивали восстановление пароля, проигнорируйте это письмо
- Никому не передавайте эту ссылку

Если у вас есть вопросы, обратитесь в поддержку: support@windexscook.ru

© 2025 WindexsCook. Все права защищены.
    `;
  }

  /**
   * HTML шаблон для приветственного письма
   */
  static getWelcomeTemplate(userName) {
    return `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Добро пожаловать в WindexsCook!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .button:hover { background: #5a6fd8; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .feature { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #667eea; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Добро пожаловать в WindexsCook!</h1>
            <p>Ваш AI повар готов помочь!</p>
          </div>
          <div class="content">
            <h2>Привет, ${userName}!</h2>
            <p>Мы рады приветствовать вас в мире кулинарных возможностей с искусственным интеллектом!</p>
            
            <h3>Что вас ждет:</h3>
            <div class="feature">
              <strong>🍳 Создание рецептов</strong><br>
              Просто укажите имеющиеся ингредиенты, и AI создаст уникальный рецепт
            </div>
            <div class="feature">
              <strong>🎤 Голосовое взаимодействие</strong><br>
              Общайтесь с AI-поваром голосом для получения советов
            </div>
            <div class="feature">
              <strong>📚 Сохранение рецептов</strong><br>
              Создавайте коллекции любимых блюд
            </div>
            <div class="feature">
              <strong>⭐ Премиум-функции</strong><br>
              Расширенные возможности для настоящих гурманов
            </div>

            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">Начать готовить с AI</a>
            </div>
          </div>
          <div class="footer">
            <p>© 2025 WindexsCook. Все права защищены.</p>
            <p>Поддержка: <a href="mailto:support@windexscook.ru">support@windexscook.ru</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Текстовый шаблон для приветственного письма
   */
  static getWelcomeText(userName) {
    return `
Добро пожаловать в WindexsCook!

Привет, ${userName}!

Мы рады приветствовать вас в мире кулинарных возможностей с искусственным интеллектом!

Что вас ждет:
🍳 Создание рецептов - просто укажите имеющиеся ингредиенты
🎤 Голосовое взаимодействие - общайтесь с AI-поваром голосом
📚 Сохранение рецептов - создавайте коллекции любимых блюд
⭐ Премиум-функции - расширенные возможности для гурманов

Начните готовить с AI: ${process.env.FRONTEND_URL || 'http://localhost:5173'}

© 2025 WindexsCook. Все права защищены.
Поддержка: support@windexscook.ru
    `;
  }

  /**
   * HTML шаблон для подтверждения премиум-подписки
   */
  static getPremiumConfirmationTemplate(userName) {
    return `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Премиум-подписка активирована</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); color: #333; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #ffd700; color: #333; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .button:hover { background: #ffed4e; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .premium-feature { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #ffd700; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⭐ Премиум-подписка активирована!</h1>
            <p>Добро пожаловать в мир премиум-кулинарии!</p>
          </div>
          <div class="content">
            <h2>Поздравляем, ${userName}!</h2>
            <p>Ваша премиум-подписка успешно активирована. Теперь вам доступны все расширенные функции!</p>
            
            <h3>Премиум-функции:</h3>
            <div class="premium-feature">
              <strong>🎤 Продвинутое голосовое взаимодействие</strong><br>
              Расширенные возможности общения с AI-поваром
            </div>
            <div class="premium-feature">
              <strong>🍽️ Персональные рекомендации</strong><br>
              AI анализирует ваши предпочтения и предлагает идеальные рецепты
            </div>
            <div class="premium-feature">
              <strong>📊 Детальная аналитика</strong><br>
              Статистика ваших кулинарных экспериментов
            </div>
            <div class="premium-feature">
              <strong>🚀 Приоритетная поддержка</strong><br>
              Быстрые ответы на ваши вопросы
            </div>

            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-chef" class="button">Попробовать премиум-функции</a>
            </div>
          </div>
          <div class="footer">
            <p>© 2025 WindexsCook. Все права защищены.</p>
            <p>Поддержка: <a href="mailto:support@windexscook.ru">support@windexscook.ru</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Текстовый шаблон для подтверждения премиум-подписки
   */
  static getPremiumConfirmationText(userName) {
    return `
Премиум-подписка активирована!

Поздравляем, ${userName}!

Ваша премиум-подписка успешно активирована. Теперь вам доступны все расширенные функции!

Премиум-функции:
🎤 Продвинутое голосовое взаимодействие
🍽️ Персональные рекомендации
📊 Детальная аналитика
🚀 Приоритетная поддержка

Попробовать премиум-функции: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-chef

© 2025 WindexsCook. Все права защищены.
Поддержка: support@windexscook.ru
    `;
  }

  /**
   * Отправка уведомления об успешной оплате (webhook)
   */
  static async sendPaymentSuccessNotification(userId, paymentId) {
    try {
      console.log('📧 [CustomEmailService] Sending payment success notification for user:', userId);

      // В данном примере просто логируем, так как у нас нет базы данных пользователей
      // В реальном приложении нужно получить email пользователя из базы данных

      const subject = '🎉 Оплата премиум-подписки прошла успешно!';
      const html = this.getPremiumActivationTemplate('Пользователь', paymentId);

      console.log('📧 [CustomEmailService] Would send notification email:', {
        subject,
        userId,
        paymentId,
        htmlPreview: html.substring(0, 100) + '...'
      });

      // Пока просто логируем, так как нет способа получить email пользователя
      // В продакшене нужно:
      // 1. Получить email из базы данных по userId
      // 2. Отправить email с помощью this.sendMail()

      return true;
    } catch (error) {
      console.error('📧 [CustomEmailService] Failed to send payment notification:', error);
      throw error;
    }
  }
}