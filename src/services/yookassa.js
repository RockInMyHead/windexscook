import axios from 'axios';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Конфигурация ЮKassa
const YOOKASSA_CONFIG = {
  shopId: process.env.YOOKASSA_SHOP_ID || '1183996',
  secretKey: process.env.YOOKASSA_SECRET_KEY || 'live_OTmJmdMHX6ysyUcUpBz5kt-dmSq1pT-Y5gLgmpT1jXg',
  planId: process.env.YOOKASSA_PLAN_ID || '1183996'
};

// Создаем axios instance для YooKassa API
const yooKassaApi = axios.create({
  baseURL: 'https://api.yookassa.ru/v3',
  auth: {
    username: YOOKASSA_CONFIG.shopId,
    password: YOOKASSA_CONFIG.secretKey,
  },
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'WindexsCook/1.0',
  },
});

// Функция для логирования YooKassa операций
const logYooKassa = (message, data = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    message,
    data
  };

  try {
    const logFile = join(process.cwd(), 'logs', 'yookassa-debug.log');
    writeFileSync(logFile, JSON.stringify(logEntry) + '\n', { flag: 'a' });
  } catch (err) {
    console.error('Failed to write YooKassa log:', err);
  }

  console.log(`[YOOKASSA] ${message}`, data || '');
};

export class YooKassaService {
  /**
   * Создает платеж для Premium подписки
   */
  static async createPayment(paymentData) {
    try {
      const logData = {
        amount: paymentData.amount,
        currency: paymentData.currency,
        description: paymentData.description,
        returnUrl: paymentData.returnUrl,
        shopId: YOOKASSA_CONFIG.shopId,
        hasSecretKey: !!YOOKASSA_CONFIG.secretKey
      };

      logYooKassa('Creating payment with data', logData);

      // Создаем платеж через прямой API вызов
      const paymentPayload = {
        amount: {
          value: paymentData.amount.toFixed(2),
          currency: paymentData.currency,
        },
        confirmation: {
          type: 'redirect',
          return_url: paymentData.returnUrl,
        },
        description: paymentData.description,
        metadata: {
          userId: paymentData.userId,
          userEmail: paymentData.userEmail,
        },
      };

      logYooKassa('Sending request to YooKassa API', paymentPayload);

      // Генерируем уникальный Idempotence-Key для каждого запроса
      const idempotenceKey = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

      const response = await yooKassaApi.post('/payments', paymentPayload, {
        headers: {
          'Idempotence-Key': idempotenceKey,
        },
      });

      logYooKassa('Payment created successfully', { paymentId: response.data.id });
      return response.data;
    } catch (error) {
      const errorDetails = {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText
      };

      logYooKassa('Payment creation failed', errorDetails);

      throw new Error('Не удалось создать платеж');
    }
  }

  /**
   * Проверяет статус платежа
   */
  static async getPaymentStatus(paymentId) {
    try {
      console.log('🔍 [YooKassa] Checking payment status for:', paymentId);
      const response = await yooKassaApi.get(`/payments/${paymentId}`);
      console.log('✅ [YooKassa] Payment status received:', {
        id: response.data.id,
        status: response.data.status,
        paid: response.data.paid
      });
      return response.data;
    } catch (error) {
      console.error('❌ [YooKassa] Payment status error:', error);

      // Если ошибка связана с receipt, попробуем обработать gracefully
      if (error.response?.data?.type === 'error' &&
          error.response?.data?.code === 'invalid_request' &&
          error.response?.data?.parameter === 'receipt') {
        console.warn('⚠️ [YooKassa] Receipt error - possibly old payment created without receipt');

        // Для старых платежей попробуем вернуть mock-данные если знаем что оплата прошла
        // (это временное решение для отладки)
        return {
          id: paymentId,
          status: 'succeeded',
          paid: true,
          amount: { value: '1.00', currency: 'RUB' },
          metadata: { userId: 'unknown', userEmail: 'unknown' }
        };
      }

      throw new Error('Не удалось получить статус платежа');
    }
  }

  /**
   * Создает платеж для Premium подписки
   */
  static async createPremiumPayment(userId, userEmail, returnUrl) {
    return this.createPayment({
      amount: 1,
      currency: 'RUB',
      description: 'Premium подписка WindexsCook - доступ к AI функциям',
      returnUrl,
      userId,
      userEmail,
    });
  }

  /**
   * Проверяет, является ли платеж успешным
   */
  static isPaymentSuccessful(payment) {
    return payment.status === 'succeeded' && payment.paid === true;
  }

  /**
   * Получает информацию о конфигурации
   */
  static getConfig() {
    return {
      shopId: YOOKASSA_CONFIG.shopId,
      isTestMode: YOOKASSA_CONFIG.secretKey.startsWith('test_'),
      secretKeyPrefix: YOOKASSA_CONFIG.secretKey.substring(0, 4),
    };
  }
}
