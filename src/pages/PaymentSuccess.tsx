import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { toast } from '@/hooks/use-toast';

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { activateSubscription } = useUser();
  const [paymentStatus, setPaymentStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [paymentData, setPaymentData] = useState<any>(null);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        console.log('🔍 PaymentSuccess: ===== COMPONENT MOUNTED =====');
        console.log('🔍 PaymentSuccess: Component loaded, checking payment status...');
        console.log('🔍 PaymentSuccess: ===== STARTING PAYMENT CHECK =====');
        console.log('🔍 PaymentSuccess: Current URL:', window.location.href);
        console.log('🔍 PaymentSuccess: URL hash:', window.location.hash);
        console.log('🔍 PaymentSuccess: URL pathname:', window.location.pathname);
        console.log('🔍 PaymentSuccess: URL hostname:', window.location.hostname);
        console.log('🔍 PaymentSuccess: URL port:', window.location.port);
        console.log('🔍 PaymentSuccess: Full URL:', window.location.href);
        console.log('🔍 PaymentSuccess: Hash starts with #:', window.location.hash.startsWith('#'));
        console.log('🔍 PaymentSuccess: Hash length:', window.location.hash.length);
        console.log('🔍 PaymentSuccess: Cookies:', document.cookie);
        console.log('🔍 PaymentSuccess: localStorage available:', typeof localStorage !== 'undefined');
        console.log('🔍 PaymentSuccess: Window test data:', (window as any).__testPaymentData);
        console.log('🔍 PaymentSuccess: URL search string:', window.location.search);
        console.log('🔍 PaymentSuccess: React Router state:', location.state);
        console.log('🔍 PaymentSuccess: ===== INITIALIZING PAYMENT SEARCH =====');

        // Сначала проверяем React Router state (самый надежный способ)
        let paymentId = null;
        let userId = null;

        console.log('🔍 PaymentSuccess: Checking React Router state...');
        console.log('🔍 PaymentSuccess: location.state exists:', !!location.state);
        console.log('🔍 PaymentSuccess: location.state type:', typeof location.state);

        if (location.state) {
          paymentId = location.state.paymentId;
          userId = location.state.userId;
          console.log('✅ PaymentSuccess: Found data in React Router state:', {
            paymentId,
            userId,
            isTest: location.state.isTest,
            fromLocalhost: location.state.fromLocalhost,
            fullState: location.state
          });
        } else {
          console.log('❌ PaymentSuccess: No data in React Router state');
        }

        // Если не нашли в state, проверяем URL параметры
        if (!paymentId) {
          paymentId = searchParams.get('paymentId') ||
                     searchParams.get('orderId') ||
                     searchParams.get('payment_id') ||
                     searchParams.get('id'); // иногда YooKassa возвращает просто id

          console.log('🔍 PaymentSuccess: Searched URL params for paymentId, found:', paymentId);
        }

        console.log('🔍 PaymentSuccess: URL params:', Object.fromEntries(searchParams.entries()));
        console.log('🔍 PaymentSuccess: Initial paymentId from URL params:', paymentId);
        console.log('🔍 PaymentSuccess: Checking individual params:');
        console.log('🔍 PaymentSuccess: paymentId param:', searchParams.get('paymentId'));
        console.log('🔍 PaymentSuccess: userId param:', searchParams.get('userId'));

        // Проверяем URL hash (YooKassa возвращает данные здесь)
        console.log('🔍 PaymentSuccess: Checking URL hash condition:', {
          hasHash: !!window.location.hash,
          hashValue: window.location.hash,
          hashLength: window.location.hash.length
        });

        if (window.location.hash) {
          console.log('🔍 PaymentSuccess: ===== PROCESSING URL HASH =====');
          console.log('🔍 PaymentSuccess: Raw hash:', window.location.hash);
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          console.log('🔍 PaymentSuccess: Parsed hash params:', Object.fromEntries(hashParams.entries()));
          paymentId = hashParams.get('paymentId');
          console.log('🔍 PaymentSuccess: paymentId from hash:', paymentId);
          if (!userId) {
            userId = hashParams.get('userId');
            console.log('🔍 PaymentSuccess: userId from hash:', userId);
          }
          console.log('🔍 PaymentSuccess: Hash parsing results:', {
            paymentId,
            userId,
            allHashParams: Object.fromEntries(hashParams.entries())
          });
          console.log('🔍 PaymentSuccess: ===== URL HASH PROCESSED =====');
        } else {
          console.log('🔍 PaymentSuccess: No URL hash found, skipping hash processing');
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

        // Проверяем localStorage для тестовых платежей
        if (!paymentId) {
          try {
            console.log('🔍 PaymentSuccess: ===== CHECKING TEST PAYMENT DATA =====');
            // Сначала проверяем test ключи (для тестовой оплаты)
            paymentId = localStorage.getItem('testPaymentId') || sessionStorage.getItem('testPaymentId');
            const testUserId = localStorage.getItem('testUserId') || sessionStorage.getItem('testUserId');
            console.log('🔍 PaymentSuccess: Checked testPaymentId, found:', paymentId);
            console.log('🔍 PaymentSuccess: Checked testUserId, found:', testUserId);
            if (paymentId && !userId && testUserId) {
              userId = testUserId;
            }
            // НЕ очищаем test ключи здесь - они будут очищены после успешной обработки
          } catch (storageError) {
            console.error('🔍 PaymentSuccess: Storage error:', storageError);
          }
        }

        // Проверяем localStorage для paymentFlow данных (новые ключи для локального тестирования)
        if (!paymentId) {
          try {
            console.log('🔍 PaymentSuccess: ===== CHECKING PAYMENT FLOW DATA =====');
            paymentId = localStorage.getItem('paymentFlow_paymentId');
            const paymentFlowUserId = localStorage.getItem('paymentFlow_userId');
            console.log('🔍 PaymentSuccess: Checked localStorage (paymentFlow_paymentId), found:', paymentId);
            console.log('🔍 PaymentSuccess: Checked localStorage (paymentFlow_userId), found:', paymentFlowUserId);
            if (paymentId && !userId && paymentFlowUserId) {
              userId = paymentFlowUserId;
            }
            // Очищаем эти ключи после использования
            if (paymentId) {
              localStorage.removeItem('paymentFlow_paymentId');
              localStorage.removeItem('paymentFlow_userId');
              console.log('🔍 PaymentSuccess: Cleared paymentFlow data from localStorage');
            }
          } catch (storageError) {
            console.error('🔍 PaymentSuccess: paymentFlow localStorage error:', storageError);
            paymentId = null;
          }
        }

        // Проверяем localStorage для pendingPaymentId (основной способ для production)
        if (!paymentId) {
          try {
            console.log('🔍 PaymentSuccess: ===== CHECKING PENDING PAYMENT DATA =====');
            console.log('🔍 PaymentSuccess: All localStorage keys:', Object.keys(localStorage));
            paymentId = localStorage.getItem('pendingPaymentId');
            const pendingUserId = localStorage.getItem('pendingUserId');
            console.log('🔍 PaymentSuccess: Checked localStorage (pendingPaymentId), found:', paymentId);
            console.log('🔍 PaymentSuccess: Checked localStorage (pendingUserId), found:', pendingUserId);
            if (paymentId && !userId && pendingUserId) {
              userId = pendingUserId;
            }
          } catch (storageError) {
            console.error('🔍 PaymentSuccess: localStorage error:', storageError);
            paymentId = null;
          }
        }

        // Проверяем sessionStorage для pendingPaymentId
        if (!paymentId) {
          try {
            paymentId = sessionStorage.getItem('pendingPaymentId');
            console.log('🔍 PaymentSuccess: Checked sessionStorage (pendingPaymentId), found:', paymentId);
          } catch (storageError) {
            console.error('🔍 PaymentSuccess: sessionStorage error:', storageError);
            paymentId = null;
          }
        }

        // Для тестирования проверяем testPaymentId (резервный вариант)
        if (!paymentId) {
          console.log('🔍 PaymentSuccess: Checking localhost data sources...');

          // Сначала проверяем window данные (самый надежный способ)
          const windowData = (window as any).__testPaymentData;
          console.log('🔍 PaymentSuccess: Window data object:', windowData);
          if (windowData && windowData.paymentId) {
            paymentId = windowData.paymentId;
            console.log('🔍 PaymentSuccess: Found paymentId in window data:', paymentId);
          }

          // Затем localStorage для paymentFlow (новые ключи)
          if (!paymentId) {
            try {
              const lsValue = localStorage.getItem('paymentFlow_paymentId');
              console.log('🔍 PaymentSuccess: Raw localStorage paymentFlow_paymentId value:', lsValue);
              paymentId = lsValue;
              console.log('🔍 PaymentSuccess: Set paymentId from paymentFlow localStorage:', paymentId);
            } catch (storageError) {
              console.error('🔍 PaymentSuccess: paymentFlow_paymentId localStorage error:', storageError);
            }
          }

          // Затем sessionStorage для paymentFlow
          if (!paymentId) {
            try {
              const ssValue = sessionStorage.getItem('paymentFlow_paymentId');
              console.log('🔍 PaymentSuccess: Raw sessionStorage paymentFlow_paymentId value:', ssValue);
              paymentId = ssValue;
              console.log('🔍 PaymentSuccess: Set paymentId from paymentFlow sessionStorage:', paymentId);
            } catch (storageError) {
              console.error('🔍 PaymentSuccess: paymentFlow_paymentId sessionStorage error:', storageError);
            }
          }

          // Затем старые ключи для совместимости
          if (!paymentId) {
            try {
              const lsValue = localStorage.getItem('testPaymentId');
              console.log('🔍 PaymentSuccess: Raw localStorage testPaymentId value (legacy):', lsValue);
              paymentId = lsValue;
              console.log('🔍 PaymentSuccess: Set paymentId from legacy localStorage:', paymentId);
            } catch (storageError) {
              console.error('🔍 PaymentSuccess: testPaymentId localStorage error:', storageError);
            }
          }

          // Затем sessionStorage для старых ключей
          if (!paymentId) {
            try {
              const ssValue = sessionStorage.getItem('testPaymentId');
              console.log('🔍 PaymentSuccess: Raw sessionStorage testPaymentId value (legacy):', ssValue);
              paymentId = ssValue;
              console.log('🔍 PaymentSuccess: Set paymentId from legacy sessionStorage:', paymentId);
            } catch (storageError) {
              console.error('🔍 PaymentSuccess: testPaymentId sessionStorage error:', storageError);
            }
          }
        }

        // Если userId не найден в state, проверяем другие источники
        if (!userId) {
          userId = searchParams.get('userId') ||
                   searchParams.get('user_id') ||
                   searchParams.get('userid');
        }

        // Проверяем userId в URL hash
        if (!userId && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          userId = hashParams.get('userId');
          console.log('🔍 PaymentSuccess: Checked URL hash for userId, found:', userId);
        }

        if (!userId) {
          // Сначала проверяем window данные
          const windowData = (window as any).__testPaymentData;
          if (windowData && windowData.userId) {
            userId = windowData.userId;
            console.log('🔍 PaymentSuccess: Found userId in window data:', userId);
          }

          // Затем localStorage
          if (!userId) {
            try {
              userId = localStorage.getItem('testUserId');
              console.log('🔍 PaymentSuccess: Checked localStorage (testUserId for localhost), found:', userId);
            } catch (storageError) {
              console.error('🔍 PaymentSuccess: testUserId localStorage error:', storageError);
            }
          }

          // Затем sessionStorage
          if (!userId) {
            try {
              userId = sessionStorage.getItem('testUserId');
              console.log('🔍 PaymentSuccess: Checked sessionStorage (testUserId for localhost), found:', userId);
            } catch (storageError) {
              console.error('🔍 PaymentSuccess: testUserId sessionStorage error:', storageError);
            }
          }
        }

        console.log('🔍 PaymentSuccess: Final paymentId to use:', paymentId);

        if (!paymentId) {
          console.error('❌ PaymentSuccess: No payment ID found in URL parameters or storage');

          // Попробуем найти последний платеж пользователя по userId
        console.log('🔍 PaymentSuccess: userId from URL/localStorage:', userId);
        console.log('🔍 PaymentSuccess: All searchParams:', Object.fromEntries(searchParams.entries()));
        console.log('🔍 PaymentSuccess: Current state summary:', {
          paymentId,
          userId,
          hasSearchParams: searchParams.toString().length > 0,
          hasHash: window.location.hash.length > 0,
          hashValue: window.location.hash,
          fullUrl: window.location.href
        });

          if (userId) {
            console.log('🔍 PaymentSuccess: Trying to find recent payment for userId:', userId);
            try {
              const backendUrl = window.location.origin;
              console.log('🔍 PaymentSuccess: Calling API:', `${backendUrl}/api/payments/user/${userId}/recent`);
              const recentPaymentsResponse = await fetch(`${backendUrl}/api/payments/user/${userId}/recent`);
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

        // Проверяем статус платежа (используем backend сервер)
        console.log('🔍 PaymentSuccess: Checking payment status for:', paymentId);

        // Проверяем статус платежа через API
        console.log('🔍 PaymentSuccess: Checking real payment status');
        const backendUrl = window.location.origin;

        let data;

          try {
            // Сначала пытаемся получить статус платежа
            const statusResponse = await fetch(`${backendUrl}/api/payments/status/${paymentId}`);
            console.log('🔍 PaymentSuccess: Status API response:', statusResponse.status);

            if (!statusResponse.ok) {
              const errorText = await statusResponse.text();
              console.error('❌ PaymentSuccess: Status API error:', statusResponse.status, errorText);
              throw new Error(`Не удалось проверить статус платежа: ${statusResponse.status}`);
            }

            const paymentInfo = await statusResponse.json();
            console.log('🔍 PaymentSuccess: Payment info from API:', paymentInfo);

            // Проверяем статус платежа
            if (paymentInfo.status === 'succeeded' && paymentInfo.paid) {
              console.log('✅ PaymentSuccess: Payment confirmed as successful');

              // Подтверждаем платеж и активируем подписку
              const confirmResponse = await fetch(`${backendUrl}/api/payments/confirm`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  paymentId: paymentId,
                  userId: userId || paymentInfo.metadata?.userId
                })
              });

              if (confirmResponse.ok) {
                const confirmData = await confirmResponse.json();
                console.log('✅ PaymentSuccess: Payment confirmed on server:', confirmData);
                data = {
                  success: true,
                  paymentId: paymentId,
                  status: 'succeeded',
                  paid: true,
                  amount: paymentInfo.amount?.value || '1.00',
                  currency: paymentInfo.amount?.currency || 'RUB',
                  metadata: paymentInfo.metadata,
                  confirmed: true
                };
              } else {
                console.error('❌ PaymentSuccess: Failed to confirm payment on server');
                throw new Error('Не удалось подтвердить платеж на сервере');
              }
            } else if (paymentInfo.status === 'pending') {
              console.log('⏳ PaymentSuccess: Payment is still pending');
              data = {
                success: false,
                paymentId: paymentId,
                status: 'pending',
                paid: false,
                message: 'Платеж находится в обработке'
              };
            } else {
              console.error('❌ PaymentSuccess: Payment failed or canceled');
              data = {
                success: false,
                paymentId: paymentId,
                status: paymentInfo.status,
                paid: false,
                message: 'Платеж не был завершен успешно'
              };
            }

            setPaymentData(data);

          } catch (apiError) {
            console.error('❌ PaymentSuccess: API error during payment check:', apiError);
            // Fallback - показываем сообщение об ошибке
            data = {
              success: false,
              paymentId: paymentId,
              status: 'error',
              paid: false,
              message: 'Не удалось проверить статус платежа. Обратитесь в поддержку.',
              error: apiError.message
            };
            setPaymentData(data);
        }

        if (data.success && data.paid && data.status === 'succeeded') {
          // Активируем подписку
          console.log('✅ PaymentSuccess: Payment successful, activating subscription');
          activateSubscription();
          setPaymentStatus('success');

          // Очищаем сохраненные paymentId из всех хранилищ
          localStorage.removeItem('pendingPaymentId');
          localStorage.removeItem('pendingUserId');
          localStorage.removeItem('paymentFlow_paymentId');
          localStorage.removeItem('paymentFlow_userId');
          localStorage.removeItem('testPaymentId');
          localStorage.removeItem('testUserId');
          sessionStorage.removeItem('pendingPaymentId');
          sessionStorage.removeItem('pendingUserId');
          sessionStorage.removeItem('testPaymentId');
          sessionStorage.removeItem('testUserId');
          console.log('✅ PaymentSuccess: Cleared all payment data from storage');

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
  }, [searchParams, location, activateSubscription]);

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
