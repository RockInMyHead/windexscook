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
        // Получаем paymentId из URL параметров
        const paymentId = searchParams.get('paymentId');
        
        if (!paymentId) {
          setPaymentStatus('error');
          return;
        }

        // Проверяем статус платежа
        const response = await fetch(`/api/payments/status/${paymentId}`);
        
        if (!response.ok) {
          throw new Error('Не удалось проверить статус платежа');
        }

        const data = await response.json();
        setPaymentData(data);

        if (data.paid && data.status === 'succeeded') {
          // Активируем подписку
          activateSubscription();
          setPaymentStatus('success');
          
          toast({
            title: "🎉 Подписка активирована!",
            description: "Теперь вам доступны все премиум-функции",
          });
        } else {
          setPaymentStatus('error');
        }

      } catch (error) {
        console.error('Payment status check error:', error);
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
