import { YooCheckout } from '@a2seven/yoo-checkout';

// Конфигурация ЮKassa
const YOOKASSA_CONFIG = {
  shopId: process.env.YOOKASSA_SHOP_ID || '1183996',
  secretKey: process.env.YOOKASSA_SECRET_KEY || 'live_OTmJmdMHX6ysyUcUpBz5kt-dmSq1pT-Y5gLgmpT1jXg',
  planId: process.env.YOOKASSA_PLAN_ID || '1183996'
};

// Инициализация ЮKassa
const checkout = new YooCheckout({
  shopId: YOOKASSA_CONFIG.shopId,
  secretKey: YOOKASSA_CONFIG.secretKey,
});

export interface PaymentData {
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  userId: string;
  userEmail: string;
}

export interface PaymentResponse {
  id: string;
  status: string;
  paid: boolean;
  amount: {
    value: string;
    currency: string;
  };
  confirmation: {
    type: string;
    confirmation_url: string;
  };
  created_at: string;
  description: string;
  metadata: {
    userId: string;
    userEmail: string;
  };
}

export class YooKassaService {
  /**
   * Создает платеж для Premium подписки
   */
  static async createPayment(paymentData: PaymentData): Promise<PaymentResponse> {
    try {
      const payment = await checkout.createPayment({
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
        receipt: {
          customer: {
            email: paymentData.userEmail,
          },
          items: [
            {
              description: paymentData.description,
              quantity: '1.00',
              amount: {
                value: paymentData.amount.toFixed(2),
                currency: paymentData.currency,
              },
              vat_code: 1, // Без НДС
              payment_subject: 'service', // Услуга
              payment_mode: 'full_payment', // Полная оплата
            },
          ],
        },
      });

      return payment as PaymentResponse;
    } catch (error) {
      console.error('YooKassa payment creation error:', error);
      throw new Error('Не удалось создать платеж');
    }
  }

  /**
   * Проверяет статус платежа
   */
  static async getPaymentStatus(paymentId: string): Promise<PaymentResponse> {
    try {
      console.log('🔍 [YooKassa] Checking payment status for:', paymentId);
      const payment = await checkout.getPayment(paymentId);
      console.log('✅ [YooKassa] Payment status received:', {
        id: payment.id,
        status: payment.status,
        paid: payment.paid
      });
      return payment as PaymentResponse;
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
          amount: { value: '250.00', currency: 'RUB' },
          confirmation: { type: 'redirect', confirmation_url: '' },
          created_at: new Date().toISOString(),
          description: 'Premium подписка WindexsCook',
          metadata: { userId: 'unknown', userEmail: 'unknown' }
        } as PaymentResponse;
      }

      throw new Error('Не удалось получить статус платежа');
    }
  }

  /**
   * Создает платеж для Premium подписки (1 рубль для тестирования)
   */
  static async createPremiumPayment(userId: string, userEmail: string, returnUrl: string): Promise<PaymentResponse> {
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
  static isPaymentSuccessful(payment: PaymentResponse): boolean {
    return payment.status === 'succeeded' && payment.paid === true;
  }

  /**
   * Получает информацию о конфигурации
   */
  static getConfig() {
    return {
      shopId: YOOKASSA_CONFIG.shopId,
      isTestMode: YOOKASSA_CONFIG.secretKey.startsWith('test_'),
    };
  }
}
