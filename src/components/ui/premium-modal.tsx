import React, { useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Sparkles, Loader2 } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useNavigate } from 'react-router-dom';
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
  console.log('🔄 PremiumModal rendered - isOpen:', isOpen, 'feature:', feature);

  const { user, isAuthenticated, hasActiveSubscription, hasActiveTrial, hasPremiumAccess, activateSubscription, activateTrialPeriod, trialDaysLeft } = useUser();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isActivatingTrial, setIsActivatingTrial] = React.useState(false);

  // Активация пробного периода
  const handleActivateTrial = useCallback(async () => {
    setIsActivatingTrial(true);
    try {
      activateTrialPeriod();
      toast({
        title: "🎉 Пробный период активирован!",
        description: "У вас есть 3 дня бесплатного доступа к премиум-функциям",
      });
      onClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось активировать пробный период",
        variant: "destructive",
      });
    } finally {
      setIsActivatingTrial(false);
    }
  }, [activateTrialPeriod, onClose, onSuccess]);

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
    console.log('🚀🚀🚀 BUTTON CLICKED! handleSubscribe called 🚀🚀🚀');
    console.log('💰 PremiumModal: ===== PAYMENT CREATION STARTED =====');
    console.log('💰 PremiumModal: handleSubscribe called at:', new Date().toISOString());
    console.log('💰 PremiumModal: Current hostname:', window.location.hostname);
    console.log('💰 PremiumModal: Current URL:', window.location.href);
    console.log('💰 PremiumModal: Current domain:', window.location.hostname);
    console.log('💰 PremiumModal: window.location object:', {
      hostname: window.location.hostname,
      host: window.location.host,
      origin: window.location.origin,
      pathname: window.location.pathname
    });

    // Временный alert для диагностики
    alert('НАЧАЛО СОЗДАНИЯ ПЛАТЕЖА! Проверьте консоль для подробных логов.');

    if (isLoading) {
      console.log('💰 PremiumModal: Already loading, skipping');
      return;
    }

    setIsLoading(true);
    console.log('💰 PremiumModal: Set loading state to true');

    try {
      // Проверяем авторизацию через UserContext
      console.log('💰 PremiumModal: ===== CHECKING AUTHENTICATION =====');
      console.log('💰 PremiumModal: isAuthenticated:', isAuthenticated);
      console.log('💰 PremiumModal: User from context:', user);

      if (!isAuthenticated || !user || !user.id || !user.email) {
        console.error('💰 PremiumModal: ❌ User not authenticated!');
        console.error('💰 PremiumModal: user object:', user);
        console.error('💰 PremiumModal: user.id exists:', !!user?.id);
        console.error('💰 PremiumModal: user.email exists:', !!user?.email);

        toast({
          title: "Ошибка",
          description: "Необходимо войти в систему для оформления подписки",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      console.log('✅ PremiumModal: User validation PASSED for user:', user.id, user.email);
      console.log('💰 PremiumModal: Starting payment creation for user:', user.id, user.email);

      // Создаем платеж через API
      const backendUrl = window.location.origin;
      const response = await fetch(`${backendUrl}/api/payments/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          returnUrl: `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}/payment-success`
        }),
      });

      if (!response.ok) {
        throw new Error('Не удалось создать платеж');
      }

      const paymentData = await response.json();

      console.log('💰 PremiumModal: Payment created successfully:', paymentData);
      console.log('💰 PremiumModal: Payment URL:', paymentData.paymentUrl);

      // Сохраняем paymentId в нескольких местах для надежности
      const paymentId = paymentData.paymentId;
      console.log('💰 PremiumModal: Extracted paymentId:', paymentId);

      // 1. localStorage (может не работать между доменами)
      try {
        localStorage.setItem('pendingPaymentId', paymentId);
        console.log('💰 PremiumModal: Saved to localStorage');
      } catch (storageError) {
        console.error('💰 PremiumModal: localStorage failed:', storageError);
      }

      // 2. sessionStorage (тоже может не работать)
      try {
        sessionStorage.setItem('pendingPaymentId', paymentId);
        console.log('💰 PremiumModal: Saved to sessionStorage');
      } catch (storageError) {
        console.error('💰 PremiumModal: sessionStorage failed:', storageError);
      }

      // 3. Cookies (должны работать между доменами)
      try {
        document.cookie = `pendingPaymentId=${paymentId}; path=/; max-age=3600; SameSite=None; Secure`;
        console.log('💰 PremiumModal: Saved to cookies');
      } catch (cookieError) {
        console.error('💰 PremiumModal: Cookies failed:', cookieError);
      }

      // 4. URL hash для передачи paymentId (надежный способ)
      const paymentUrlWithHash = `${paymentData.paymentUrl}#paymentId=${paymentId}`;
      console.log('💰 PremiumModal: Original payment URL:', paymentData.paymentUrl);
      console.log('💰 PremiumModal: Modified payment URL with hash:', paymentUrlWithHash);

      // Всегда перенаправляем на YooKassa (теперь у нас настоящие ключи)
      console.log('💰 PremiumModal: ===== REDIRECTING TO YOOKASSA =====');
      console.log('💰 PremiumModal: Payment URL:', paymentUrlWithHash);
      console.log('💰 PremiumModal: Current hostname:', window.location.hostname);
      console.log('💰 PremiumModal: Current port:', window.location.port);

      // Сохраняем данные перед редиректом на YooKassa
      try {
        localStorage.setItem('pendingPaymentId', paymentId);
        localStorage.setItem('pendingUserId', user.id);
        console.log('💰 PremiumModal: Saved payment data for YooKassa redirect');
        console.log('💰 PremiumModal: Saved pendingPaymentId:', paymentId);
        console.log('💰 PremiumModal: Saved pendingUserId:', user.id);
      } catch (e) {
        console.error('💰 PremiumModal: Failed to save data before YooKassa redirect:', e);
      }

      window.location.href = paymentUrlWithHash;
      
    } catch (error) {
      console.error('💰 PremiumModal: Payment error:', error);
      alert(`ОШИБКА СОЗДАНИЯ ПЛАТЕЖА: ${error.message}`);
      toast({
        title: "Ошибка оплаты",
        description: "Не удалось создать платеж. Попробуйте еще раз.",
        variant: "destructive",
      });
    } finally {
      console.log('💰 PremiumModal: Finally block - setting loading to false');
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
                    <div className={`font-medium ${feature.highlight ? 'text-amber-700 dark:text-amber-300' : ''}`}>
                      <span>{feature.title}</span>
                      {feature.highlight && (
                        <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">
                          Требуется
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Кнопка пробного периода */}
          {!hasActiveTrial && !hasActiveSubscription && (
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">🎁 Бесплатный пробный период</p>
                  <p className="text-sm text-green-600 dark:text-green-400">3 дня полного доступа к Premium</p>
                </div>
                <Button
                  onClick={handleActivateTrial}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                  disabled={isActivatingTrial}
                >
                  {isActivatingTrial ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Активация...
                    </>
                  ) : (
                    'Попробовать'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Статус пробного периода */}
          {hasActiveTrial && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-200">✅ Пробный период активен</p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    Осталось {trialDaysLeft} {trialDaysLeft === 1 ? 'день' : trialDaysLeft < 5 ? 'дня' : 'дней'}
                  </p>
                </div>
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  Premium
                </Badge>
              </div>
            </div>
          )}

          {/* Кнопки действий */}
          <div className="flex gap-2">
            <Button
              onClick={handleSubscribe}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg"
              size="lg"
              disabled={isLoading || isActivatingTrial}
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
              disabled={isLoading || isActivatingTrial}
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
