import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { toast } from '@/hooks/use-toast';

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activateSubscription } = useUser();
  const [paymentStatus, setPaymentStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [paymentData, setPaymentData] = useState<any>(null);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        console.log('🔍 PaymentSuccess: Component loaded, checking payment status...');
        console.log('🔍 PaymentSuccess: Current URL:', window.location.href);
        console.log('🔍 PaymentSuccess: URL hash:', window.location.hash);
        console.log('🔍 PaymentSuccess: Cookies:', document.cookie);
        console.log('🔍 PaymentSuccess: localStorage available:', typeof localStorage !== 'undefined');

        // Получаем paymentId из различных возможных источников
        let paymentId = searchParams.get('paymentId') ||
                       searchParams.get('orderId') ||
                       searchParams.get('payment_id') ||
                       searchParams.get('id'); // иногда YooKassa возвращает просто id

        console.log('🔍 PaymentSuccess: URL params:', Object.fromEntries(searchParams.entries()));
        console.log('🔍 PaymentSuccess: Initial paymentId from URL params:', paymentId);

        // Проверяем URL hash
        if (!paymentId && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          paymentId = hashParams.get('paymentId');
          console.log('🔍 PaymentSuccess: Checked URL hash, found:', paymentId);
        }

        // Проверяем cookies
        if (!paymentId) {
          try {
            const cookies = document.cookie.split(';');
            const paymentIdCookie = cookies.find(cookie => cookie.trim().startsWith('pendingPaymentId='));
            if (paymentIdCookie) {
              paymentId = paymentIdCookie.split('=')[1];
              console.log('🔍 PaymentSuccess: Found in cookies:', paymentId);
            }
          } catch (cookieError) {
            console.error('🔍 PaymentSuccess: Cookie error:', cookieError);
          }
        }

        // Проверяем localStorage
        if (!paymentId) {
          try {
            paymentId = localStorage.getItem('pendingPaymentId');
            console.log('🔍 PaymentSuccess: Checked localStorage, found:', paymentId);
          } catch (storageError) {
            console.error('🔍 PaymentSuccess: localStorage error:', storageError);
            paymentId = null;
          }
        }

        // Проверяем sessionStorage
        if (!paymentId) {
          try {
            paymentId = sessionStorage.getItem('pendingPaymentId');
            console.log('🔍 PaymentSuccess: Checked sessionStorage, found:', paymentId);
          } catch (storageError) {
            console.error('🔍 PaymentSuccess: sessionStorage error:', storageError);
            paymentId = null;
          }
        }

        console.log('🔍 PaymentSuccess: Final paymentId to use:', paymentId);

        if (!paymentId) {
          console.error('❌ PaymentSuccess: No payment ID found in URL parameters or storage');

          // Попробуем найти последний платеж пользователя по userId
          const userId = searchParams.get('userId');
          console.log('🔍 PaymentSuccess: userId from URL:', userId);
          console.log('🔍 PaymentSuccess: All searchParams:', Object.fromEntries(searchParams.entries()));

          if (userId) {
            console.log('🔍 PaymentSuccess: Trying to find recent payment for userId:', userId);
            try {
              console.log('🔍 PaymentSuccess: Calling API:', `/api/payments/user/${userId}/recent`);
              const recentPaymentsResponse = await fetch(`/api/payments/user/${userId}/recent`);
              console.log('🔍 PaymentSuccess: API response status:', recentPaymentsResponse.status);

              if (recentPaymentsResponse.ok) {
                const recentPayment = await recentPaymentsResponse.json();
                console.log('🔍 PaymentSuccess: API response data:', recentPayment);
                if (recentPayment && recentPayment.id) {
                  paymentId = recentPayment.id;
                  console.log('✅ PaymentSuccess: Found recent payment:', paymentId);
                } else {
                  console.warn('⚠️ PaymentSuccess: Recent payment not found in response');
                }
              } else {
                const errorText = await recentPaymentsResponse.text();
                console.error('❌ PaymentSuccess: API error response:', errorText);
              }
            } catch (recentError) {
              console.error('❌ PaymentSuccess: Failed to find recent payment:', recentError);
            }
          } else {
            console.warn('⚠️ PaymentSuccess: No userId found in URL, cannot search for recent payments');
          }

          if (!paymentId) {
            console.error('❌ PaymentSuccess: Still no paymentId found, showing error');
            setPaymentStatus('error');
            return;
          }
        }

        // Проверяем статус платежа
        console.log('🔍 PaymentSuccess: Checking payment status for:', paymentId);
        const response = await fetch(`/api/payments/status/${paymentId}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ PaymentSuccess: API response not ok:', response.status, errorText);
          throw new Error(`Не удалось проверить статус платежа: ${response.status}`);
        }

        const data = await response.json();
        console.log('🔍 PaymentSuccess: Payment data received:', data);
        setPaymentData(data);

        if (data.success && data.paid && data.status === 'succeeded') {
          // Активируем подписку
          console.log('✅ PaymentSuccess: Payment successful, activating subscription');
          activateSubscription();
          setPaymentStatus('success');

          // Очищаем сохраненный paymentId из localStorage
          localStorage.removeItem('pendingPaymentId');

          toast({
            title: "🎉 Подписка активирована!",
            description: "Теперь вам доступны все премиум-функции",
          });
        } else {
          console.error('❌ PaymentSuccess: Payment not successful:', {
            success: data.success,
            paid: data.paid,
            status: data.status
          });
          setPaymentStatus('error');
        }

      } catch (error) {
        console.error('❌ PaymentSuccess: Error checking payment status:', error);
        setPaymentStatus('error');
      }
    };

    checkPaymentStatus();
  }, [searchParams, activateSubscription]);

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoToProfile = () => {
    navigate('/profile');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {paymentStatus === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-primary" />
              <CardTitle>Проверяем платеж...</CardTitle>
              <CardDescription>
                Пожалуйста, подождите, мы проверяем статус вашего платежа
              </CardDescription>
            </>
          )}

          {paymentStatus === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <CardTitle className="text-green-700">Платеж успешен!</CardTitle>
              <CardDescription>
                Ваша Premium подписка активирована
              </CardDescription>
            </>
          )}

          {paymentStatus === 'error' && (
            <>
              <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
              <CardTitle className="text-red-700">Ошибка платежа</CardTitle>
              <CardDescription>
                Не удалось подтвердить платеж. Обратитесь в поддержку
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {paymentData && paymentStatus === 'success' && (
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
              <h3 className="font-medium text-green-800 dark:text-green-200 mb-2">
                Детали платежа:
              </h3>
              <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                <p>Сумма: {paymentData.amount} {paymentData.currency}</p>
                <p>Статус: {paymentData.status}</p>
                <p>ID платежа: {paymentData.paymentId}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={handleGoHome}
              className="flex-1"
              variant={paymentStatus === 'success' ? 'default' : 'outline'}
            >
              На главную
            </Button>
            
            {paymentStatus === 'success' && (
              <Button 
                onClick={handleGoToProfile}
                className="flex-1"
                variant="outline"
              >
                Профиль
              </Button>
            )}
          </div>

          {paymentStatus === 'success' && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Теперь вам доступны все AI-функции!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
