import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import PaymentSuccess from '../../../src/pages/PaymentSuccess';

// Mock dependencies
jest.mock('react-router-dom', () => ({
  useSearchParams: () => {
    const mockSearchParams = new URLSearchParams();
    mockSearchParams.set('paymentId', 'test-payment-123');
    mockSearchParams.set('userId', 'test-user-456');
    return [mockSearchParams];
  },
  useNavigate: () => jest.fn()
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock fetch
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('PaymentSuccess Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock window.location
    delete (window as any).location;
    window.location = {
      origin: 'https://cook.windexs.ru',
      href: 'https://cook.windexs.ru/payment-success?paymentId=test-payment-123&userId=test-user-456'
    } as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders loading state initially', () => {
    render(<PaymentSuccess />);

    expect(screen.getByText('Проверяем платеж...')).toBeInTheDocument();
    expect(screen.getByText('Подождите, пожалуйста, мы проверяем статус вашего платежа.')).toBeInTheDocument();
  });

  test('handles successful payment verification', async () => {
    const mockPaymentResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: 'succeeded',
        paid: true,
        amount: { value: '1000.00', currency: 'RUB' },
        metadata: { userId: 'test-user-456', userEmail: 'test@example.com' }
      })
    };

    const mockConfirmResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true })
    };

    mockFetch
      .mockResolvedValueOnce(mockPaymentResponse as any)
      .mockResolvedValueOnce(mockConfirmResponse as any);

    render(<PaymentSuccess />);

    await waitFor(() => {
      expect(screen.getByText('🎉 Оплата прошла успешно!')).toBeInTheDocument();
    });

    expect(screen.getByText('Ваш платеж был успешно обработан.')).toBeInTheDocument();
    expect(screen.getByText('Спасибо за использование нашего сервиса!')).toBeInTheDocument();
  });

  test('handles pending payment status', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: 'pending',
        paid: false,
        message: 'Платеж находится в обработке'
      })
    };
    mockFetch.mockResolvedValue(mockResponse as any);

    render(<PaymentSuccess />);

    await waitFor(() => {
      expect(screen.getByText('⏳ Платеж в обработке')).toBeInTheDocument();
    });

    expect(screen.getByText('Платеж находится в обработке')).toBeInTheDocument();
  });

  test('handles failed payment status', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: 'failed',
        paid: false,
        message: 'Платеж не был завершен успешно'
      })
    };
    mockFetch.mockResolvedValue(mockResponse as any);

    render(<PaymentSuccess />);

    await waitFor(() => {
      expect(screen.getByText('❌ Ошибка платежа')).toBeInTheDocument();
    });

    expect(screen.getByText('Платеж не был завершен успешно')).toBeInTheDocument();
  });

  test('handles API errors gracefully', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    };
    mockFetch.mockResolvedValue(mockResponse as any);

    render(<PaymentSuccess />);

    await waitFor(() => {
      expect(screen.getByText('❌ Ошибка проверки платежа')).toBeInTheDocument();
    });

    expect(screen.getByText('Не удалось проверить статус платежа. Обратитесь в поддержку.')).toBeInTheDocument();
  });

  test('handles network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<PaymentSuccess />);

    await waitFor(() => {
      expect(screen.getByText('❌ Ошибка проверки платежа')).toBeInTheDocument();
    });
  });

  test('recovers paymentId from localStorage if not in URL', async () => {
    // Remove paymentId from URL
    jest.mock('react-router-dom', () => ({
      useSearchParams: () => {
        const mockSearchParams = new URLSearchParams();
        return [mockSearchParams];
      },
      useNavigate: () => jest.fn()
    }));

    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'pendingPaymentId') return 'stored-payment-123';
      if (key === 'pendingUserId') return 'stored-user-456';
      return null;
    });

    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: 'succeeded',
        paid: true,
        amount: { value: '500.00', currency: 'RUB' },
        metadata: { userId: 'stored-user-456' }
      })
    };
    mockFetch.mockResolvedValue(mockResponse as any);

    render(<PaymentSuccess />);

    await waitFor(() => {
      expect(screen.getByText('🎉 Оплата прошла успешно!')).toBeInTheDocument();
    });
  });

  test('shows error when no paymentId found', async () => {
    // No paymentId in URL or localStorage
    jest.mock('react-router-dom', () => ({
      useSearchParams: () => {
        const mockSearchParams = new URLSearchParams();
        return [mockSearchParams];
      },
      useNavigate: () => jest.fn()
    }));

    mockLocalStorage.getItem.mockReturnValue(null);

    render(<PaymentSuccess />);

    await waitFor(() => {
      expect(screen.getByText('❌ Ошибка')).toBeInTheDocument();
    });

    expect(screen.getByText('Не удалось найти информацию о платеже.')).toBeInTheDocument();
  });

  test('clears localStorage after successful payment', async () => {
    const mockPaymentResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: 'succeeded',
        paid: true,
        amount: { value: '1000.00', currency: 'RUB' },
        metadata: { userId: 'test-user-456' }
      })
    };

    const mockConfirmResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true })
    };

    mockFetch
      .mockResolvedValueOnce(mockPaymentResponse as any)
      .mockResolvedValueOnce(mockConfirmResponse as any);

    render(<PaymentSuccess />);

    await waitFor(() => {
      expect(screen.getByText('🎉 Оплата прошла успешно!')).toBeInTheDocument();
    });

    // Verify localStorage cleanup
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('pendingPaymentId');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('pendingUserId');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('paymentFlow_paymentId');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('paymentFlow_userId');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('testPaymentId');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('testUserId');
  });

  test('displays payment details correctly', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: 'succeeded',
        paid: true,
        amount: { value: '1500.50', currency: 'RUB' },
        metadata: { userId: 'test-user-456', userEmail: 'user@example.com' }
      })
    };
    mockFetch.mockResolvedValue(mockResponse as any);

    render(<PaymentSuccess />);

    await waitFor(() => {
      expect(screen.getByText('🎉 Оплата прошла успешно!')).toBeInTheDocument();
    });

    expect(screen.getByText('1500.50 ₽')).toBeInTheDocument();
    expect(screen.getByText('ID платежа: test-payment-123')).toBeInTheDocument();
  });

  test('handles payment confirmation failure', async () => {
    const mockPaymentResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: 'succeeded',
        paid: true,
        amount: { value: '1000.00', currency: 'RUB' },
        metadata: { userId: 'test-user-456' }
      })
    };

    const mockConfirmResponse = {
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValue({ error: 'Confirmation failed' })
    };

    mockFetch
      .mockResolvedValueOnce(mockPaymentResponse as any)
      .mockResolvedValueOnce(mockConfirmResponse as any);

    render(<PaymentSuccess />);

    await waitFor(() => {
      expect(screen.getByText('❌ Ошибка платежа')).toBeInTheDocument();
    });

    expect(screen.getByText('Не удалось подтвердить платеж на сервере')).toBeInTheDocument();
  });
});
