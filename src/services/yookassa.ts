import { YooCheckout } from '@a2seven/yoo-checkout';

// Конфигурация ЮKassa
const YOOKASSA_CONFIG = {
  shopId: process.env.YOOKASSA_SHOP_ID || '1178504',
  secretKey: process.env.YOOKASSA_SECRET_KEY || 'test_UbyQ0yDUnXyAXtkBcMBhkdIkY-FqdK75waGmHAvlF9M',
  planId: process.env.YOOKASSA_PLAN_ID || '1178504'
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
      const payment = await checkout.getPayment(paymentId);
      return payment as PaymentResponse;
    } catch (error) {
      console.error('YooKassa payment status error:', error);
      throw new Error('Не удалось получить статус платежа');
    }
  }

  /**
   * Создает платеж для Premium подписки (250 рублей)
   */
  static async createPremiumPayment(userId: string, userEmail: string, returnUrl: string): Promise<PaymentResponse> {
    return this.createPayment({
      amount: 250,
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
