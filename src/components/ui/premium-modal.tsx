import React, { useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Sparkles, Loader2 } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { toast } from '@/hooks/use-toast';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: 'recipe' | 'image' | 'calorie' | string; // Какая функция требует Premium
  onSuccess?: () => void; // Callback после успешной подписки
}

export const PremiumModal: React.FC<PremiumModalProps> = ({ 
  isOpen, 
  onClose, 
  feature, 
  onSuccess 
}) => {
  const { hasActiveSubscription, activateSubscription } = useUser();
  const [isLoading, setIsLoading] = React.useState(false);

  // Мемоизированное описание функции
  const featureDescription = useMemo(() => {
    const descriptions = {
      recipe: 'AI генерация рецептов',
      image: 'Распознавание продуктов по фото',
      calorie: 'Подсчет калорий по фото',
      default: 'премиум-функции'
    };
    return descriptions[feature as keyof typeof descriptions] || descriptions.default;
  }, [feature]);

  // Мемоизированные преимущества Premium
  const premiumFeatures = useMemo(() => [
    {
      icon: Sparkles,
      title: 'AI генерация рецептов',
      description: 'Создавайте уникальные рецепты из ваших ингредиентов',
      highlight: feature === 'recipe'
    },
    {
      icon: Check,
      title: 'Подсчет калорий',
      description: 'Анализ калорийности блюд с фотографии',
      highlight: feature === 'calorie'
    },
    {
      icon: Check,
      title: 'Распознавание продуктов',
      description: 'Определение ингредиентов по фото',
      highlight: feature === 'image'
    }
  ], [feature]);

  // Оптимизированная функция подписки
  const handleSubscribe = useCallback(async () => {
    console.log('💰 PremiumModal: handleSubscribe called');

    if (isLoading) {
      console.log('💰 PremiumModal: Already loading, skipping');
      return;
    }

    setIsLoading(true);
    try {
      // Получаем данные пользователя
      const user = JSON.parse(localStorage.getItem('ai-chef-user') || '{}');
      console.log('💰 PremiumModal: Retrieved user from localStorage:', user);

      if (!user.id || !user.email) {
        console.log('💰 PremiumModal: User validation failed - missing id or email');
        toast({
          title: "Ошибка",
          description: "Необходимо войти в систему для оформления подписки",
          variant: "destructive",
        });
        return;
      }

      console.log('💰 PremiumModal: Starting payment creation for user:', user.id, user.email);

      // Создаем платеж через API
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          returnUrl: `${window.location.origin}/payment-success?userId=${user.id}`
        }),
      });

      if (!response.ok) {
        throw new Error('Не удалось создать платеж');
      }

      const paymentData = await response.json();

      console.log('💰 PremiumModal: Payment created successfully:', paymentData);
      console.log('💰 PremiumModal: Saving paymentId to localStorage:', paymentData.paymentId);

      // Сохраняем paymentId в localStorage для восстановления на странице успеха
      try {
        localStorage.setItem('pendingPaymentId', paymentData.paymentId);
        console.log('💰 PremiumModal: Successfully saved to localStorage');
        console.log('💰 PremiumModal: localStorage contents after save:', localStorage.getItem('pendingPaymentId'));
      } catch (storageError) {
        console.error('💰 PremiumModal: Failed to save to localStorage:', storageError);
      }

      // Перенаправляем на страницу оплаты
      console.log('💰 PremiumModal: Redirecting to payment URL:', paymentData.paymentUrl);
      window.location.href = paymentData.paymentUrl;
      
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Ошибка оплаты",
        description: "Не удалось создать платеж. Попробуйте еще раз.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, onSuccess, onClose]);

  // Обработка закрытия модального окна
  const handleClose = useCallback(() => {
    if (!isLoading) {
      onClose();
    }
  }, [isLoading, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-500" />
            <DialogTitle>Premium подписка</DialogTitle>
          </div>
          <DialogDescription>
            Для использования {featureDescription} требуется Premium подписка
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ценовая карточка */}
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mb-1">
              1 ₽ <span className="text-base font-normal text-muted-foreground">/тест</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Доступ ко всем AI-функциям
            </p>
            <Badge className="mt-2 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              Популярный выбор
            </Badge>
          </div>

          {/* Список преимуществ */}
          <div className="space-y-3">
            {premiumFeatures.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div 
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                    feature.highlight 
                      ? 'bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800' 
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <IconComponent className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    feature.highlight ? 'text-amber-500' : 'text-green-500'
                  }`} />
                  <div className="flex-1">
                    <p className={`font-medium ${feature.highlight ? 'text-amber-700 dark:text-amber-300' : ''}`}>
                      {feature.title}
                      {feature.highlight && (
                        <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">
                          Требуется
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Кнопки действий */}
          <div className="flex gap-2">
            <Button 
              onClick={handleSubscribe}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Активируем...
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4 mr-2" />
                  Подключить Premium
                </>
              )}
            </Button>
            <Button 
              variant="outline"
              onClick={handleClose}
              size="lg"
              disabled={isLoading}
            >
              Позже
            </Button>
          </div>

          {/* Дополнительная информация */}
          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Чат с AI-поваром доступен бесплатно
            </p>
            <p className="text-xs text-muted-foreground">
              Отменить подписку можно в любое время
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
