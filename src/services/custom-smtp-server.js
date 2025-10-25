import { SMTPServer } from 'smtp-server';
import { createWriteStream } from 'fs';
import { join } from 'path';

export class CustomSMTPServer {
  static server = null;
  static isRunning = false;
  static port = 2525; // Стандартный порт для тестовых SMTP серверов
  static emails = []; // Хранилище полученных писем
  static authEnabled = false; // Включена ли аутентификация
  static username = ''; // Имя пользователя для аутентификации
  static password = ''; // Пароль для аутентификации

  /**
   * Запускает собственный SMTP сервер
   */
  static async start() {
    if (this.isRunning) {
      console.log('📧 [CustomSMTP] Сервер уже запущен');
      return;
    }

    console.log('🚀 [CustomSMTP] Запускаем собственный SMTP сервер...');

    // Загружаем настройки аутентификации
    this.loadAuthConfig();

    this.server = new SMTPServer({
      // Настройка аутентификации
      authOptional: !this.authEnabled,
      authMethods: this.authEnabled ? ['PLAIN', 'LOGIN'] : [],
      
      // Обработчик аутентификации
      onAuth: this.authEnabled ? this.handleAuth.bind(this) : undefined,
      
      // Поддержка STARTTLS
      secure: false,
      allowInsecureAuth: true,
      
      // Обработчик входящих писем
      onData(stream, session, callback) {
        console.log('📨 [CustomSMTP] Получено новое письмо от:', session.envelope.mailFrom);
        console.log('📨 [CustomSMTP] Получатель:', session.envelope.rcptTo);
        
        let emailData = '';
        
        stream.on('data', (chunk) => {
          emailData += chunk.toString();
        });
        
        stream.on('end', () => {
          // Сохраняем письмо
          const email = {
            id: Date.now(),
            from: session.envelope.mailFrom,
            to: session.envelope.rcptTo,
            data: emailData,
            receivedAt: new Date().toISOString(),
            session: {
              remoteAddress: session.remoteAddress,
              hostname: session.hostnameAppearsAs,
              heloHostname: session.heloHostname
            }
          };
          
          CustomSMTPServer.emails.push(email);
          
          // Сохраняем в файл для отладки
          const emailFile = join(process.cwd(), 'logs', `email_${email.id}.eml`);
          const writeStream = createWriteStream(emailFile);
          writeStream.write(emailData);
          writeStream.end();
          
          console.log('✅ [CustomSMTP] Письмо сохранено:', emailFile);
          console.log('📊 [CustomSMTP] Всего писем в очереди:', CustomSMTPServer.emails.length);
          
          callback();
        });
      },
      
      // Обработчик ошибок
      onError(err) {
        console.error('❌ [CustomSMTP] Ошибка SMTP сервера:', err);
      }
    });

    // Запускаем сервер
    this.server.listen(this.port, () => {
      this.isRunning = true;
      console.log(`✅ [CustomSMTP] SMTP сервер запущен на порту ${this.port}`);
      console.log(`📧 [CustomSMTP] Адрес сервера: smtp://localhost:${this.port}`);
      
      if (this.authEnabled) {
        console.log(`🔐 [CustomSMTP] Аутентификация: включена`);
        console.log(`👤 [CustomSMTP] Пользователь: ${this.username}`);
        console.log(`🔑 [CustomSMTP] Методы: PLAIN, LOGIN`);
      } else {
        console.log(`🔓 [CustomSMTP] Аутентификация: не требуется`);
      }
    });

    // Обработка ошибок запуска
    this.server.on('error', (err) => {
      console.error('❌ [CustomSMTP] Ошибка запуска сервера:', err);
      this.isRunning = false;
    });
  }

  /**
   * Останавливает SMTP сервер
   */
  static async stop() {
    if (!this.isRunning || !this.server) {
      console.log('📧 [CustomSMTP] Сервер не запущен');
      return;
    }

    console.log('🛑 [CustomSMTP] Останавливаем SMTP сервер...');
    
    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        this.server = null;
        console.log('✅ [CustomSMTP] SMTP сервер остановлен');
        resolve();
      });
    });
  }

  /**
   * Получает все полученные письма
   */
  static getEmails() {
    return this.emails;
  }

  /**
   * Получает последнее письмо
   */
  static getLastEmail() {
    return this.emails.length > 0 ? this.emails[this.emails.length - 1] : null;
  }

  /**
   * Очищает очередь писем
   */
  static clearEmails() {
    this.emails = [];
    console.log('🗑️ [CustomSMTP] Очередь писем очищена');
  }

  /**
   * Получает статистику сервера
   */
  static getStats() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      emailsCount: this.emails.length,
      lastEmailAt: this.emails.length > 0 ? this.emails[this.emails.length - 1].receivedAt : null
    };
  }

  /**
   * Загружает конфигурацию аутентификации из переменных окружения
   */
  static loadAuthConfig() {
    this.authEnabled = process.env.SMTP_SERVER_REQUIRE_AUTH === 'true';
    this.username = process.env.SMTP_SERVER_USERNAME || 'admin';
    this.password = process.env.SMTP_SERVER_PASSWORD || 'password';
    
    console.log(`🔧 [CustomSMTP] Конфигурация аутентификации:`);
    console.log(`   - Включена: ${this.authEnabled}`);
    console.log(`   - Пользователь: ${this.username}`);
    console.log(`   - Пароль: ${this.password ? '***' + this.password.slice(-3) : 'не установлен'}`);
  }

  /**
   * Обновляет конфигурацию аутентификации
   */
  static updateAuthConfig(username, password, authEnabled) {
    this.username = username;
    this.password = password;
    this.authEnabled = authEnabled;
    
    console.log(`🔧 [CustomSMTP] Конфигурация аутентификации обновлена:`);
    console.log(`   - Включена: ${this.authEnabled}`);
    console.log(`   - Пользователь: ${this.username}`);
    console.log(`   - Пароль: ${this.password ? '***' + this.password.slice(-3) : 'не установлен'}`);
  }

  /**
   * Обработчик аутентификации SMTP
   */
  static handleAuth(auth, session, callback) {
    console.log(`🔐 [CustomSMTP] Попытка аутентификации:`);
    console.log(`   - Метод: ${auth.method}`);
    console.log(`   - Пользователь: ${auth.username}`);
    console.log(`   - IP: ${session.remoteAddress}`);
    
    // Проверяем учетные данные
    if (auth.username === this.username && auth.password === this.password) {
      console.log(`✅ [CustomSMTP] Аутентификация успешна для пользователя: ${auth.username}`);
      callback(null, { user: auth.username });
    } else {
      console.log(`❌ [CustomSMTP] Неверные учетные данные для пользователя: ${auth.username}`);
      callback(new Error('Неверные учетные данные'));
    }
  }

  /**
   * Проверяет, запущен ли сервер
   */
  static isServerRunning() {
    return this.isRunning;
  }
}
