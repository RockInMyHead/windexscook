import sgMail from '@sendgrid/mail';

// Инициализация SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export class EmailService {
  /**
   * Отправляет письмо для восстановления пароля
   */
  static async sendPasswordReset(email, resetToken) {
    try {
      console.log('📧 [EmailService] Отправляем письмо восстановления пароля на:', email);
      
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
      
      const msg = {
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@windexscook.ru',
          name: 'WindexsCook'
        },
        subject: '🔐 Восстановление пароля - WindexsCook',
        html: this.getPasswordResetTemplate(resetUrl, email),
        text: this.getPasswordResetText(resetUrl, email)
      };

      await sgMail.send(msg);
      
      console.log('✅ [EmailService] Письмо восстановления пароля отправлено успешно');
      return true;
      
    } catch (error) {
      console.error('❌ [EmailService] Ошибка отправки письма:', error);
      throw new Error('Не удалось отправить письмо для восстановления пароля');
    }
  }

  /**
   * Отправляет письмо приветствия для новых пользователей
   */
  static async sendWelcomeEmail(email, userName) {
    try {
      console.log('📧 [EmailService] Отправляем приветственное письмо на:', email);
      
      const msg = {
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@windexscook.ru',
          name: 'WindexsCook'
        },
        subject: '🎉 Добро пожаловать в WindexsCook!',
        html: this.getWelcomeTemplate(userName),
        text: this.getWelcomeText(userName)
      };

      await sgMail.send(msg);
      
      console.log('✅ [EmailService] Приветственное письмо отправлено успешно');
      return true;
      
    } catch (error) {
      console.error('❌ [EmailService] Ошибка отправки приветственного письма:', error);
      throw new Error('Не удалось отправить приветственное письмо');
    }
  }

  /**
   * Отправляет письмо подтверждения премиум-подписки
   */
  static async sendPremiumConfirmation(email, userName) {
    try {
      console.log('📧 [EmailService] Отправляем письмо подтверждения премиум-подписки на:', email);
      
      const msg = {
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@windexscook.ru',
          name: 'WindexsCook'
        },
        subject: '⭐ Премиум-подписка активирована!',
        html: this.getPremiumConfirmationTemplate(userName),
        text: this.getPremiumConfirmationText(userName)
      };

      await sgMail.send(msg);
      
      console.log('✅ [EmailService] Письмо подтверждения премиум-подписки отправлено успешно');
      return true;
      
    } catch (error) {
      console.error('❌ [EmailService] Ошибка отправки письма подтверждения премиум-подписки:', error);
      throw new Error('Не удалось отправить письмо подтверждения премиум-подписки');
    }
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
   * Проверяет, настроен ли SendGrid
   */
  static isConfigured() {
    const apiKey = process.env.SENDGRID_API_KEY;
    return !!(apiKey && apiKey !== 'your_sendgrid_api_key_here' && apiKey.startsWith('SG.'));
  }

  /**
   * Получает информацию о конфигурации
   */
  static getConfig() {
    return {
      isConfigured: this.isConfigured(),
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@windexscook.ru',
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
    };
  }
}
