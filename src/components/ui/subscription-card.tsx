import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Sparkles } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { toast } from '@/hooks/use-toast';

export const SubscriptionCard: React.FC = () => {
  const { user, hasActiveSubscription, activateSubscription } = useUser();

  const handleSubscribe = async () => {
    try {
      // Получаем данные пользователя
      const user = JSON.parse(localStorage.getItem('ai-chef-user') || '{}');
      
      if (!user.id || !user.email) {
        toast({
          title: "Ошибка",
          description: "Необходимо войти в систему для оформления подписки",
          variant: "destructive",
        });
        return;
      }

      // Создаем платеж через API
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          returnUrl: `${window.location.origin}/payment-success`
        }),
      });

      if (!response.ok) {
        throw new Error('Не удалось создать платеж');
      }

      const paymentData = await response.json();
      
      // Перенаправляем на страницу оплаты
      window.location.href = paymentData.paymentUrl;
      
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Ошибка оплаты",
        description: "Не удалось создать платеж. Попробуйте еще раз.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-500" />
            <CardTitle>Premium подписка</CardTitle>
          </div>
          {hasActiveSubscription && (
            <Badge className="bg-amber-500 text-white">
              <Sparkles className="w-3 h-3 mr-1" />
              Активна
            </Badge>
          )}
        </div>
        <CardDescription>
          {hasActiveSubscription 
            ? `Действует до ${formatDate(user?.subscription?.expiresAt)}`
            : 'Получите доступ к AI-функциям'
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!hasActiveSubscription && (
          <>
            <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mb-1">
                1 ₽ <span className="text-base font-normal text-muted-foreground">/тест</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Доступ ко всем AI-функциям
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">AI генерация рецептов</p>
                  <p className="text-sm text-muted-foreground">
                    Создавайте уникальные рецепты из ваших ингредиентов
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Подсчет калорий</p>
                  <p className="text-sm text-muted-foreground">
                    Анализ калорийности блюд с фотографии
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Распознавание продуктов</p>
                  <p className="text-sm text-muted-foreground">
                    Определение ингредиентов по фото
                  </p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSubscribe}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white"
              size="lg"
            >
              <Crown className="w-4 h-4 mr-2" />
              Подключить Premium
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Чат с AI-поваром доступен бесплатно
            </p>
          </>
        )}

        {hasActiveSubscription && (
          <div className="space-y-3">
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <p className="font-medium text-green-700 dark:text-green-300 mb-1">
                ✓ У вас есть доступ ко всем функциям
              </p>
              <p className="text-sm text-muted-foreground">
                Подписка автоматически продлится {formatDate(user?.subscription?.expiresAt)}
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Premium активна</p>
                <p className="text-xs text-muted-foreground">
                  Спасибо за поддержку!
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

