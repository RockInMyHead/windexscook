import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Sparkles, X } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { toast } from '@/hooks/use-toast';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string; // Какая функция требует Premium
}

export const PremiumModal: React.FC<PremiumModalProps> = ({ isOpen, onClose, feature }) => {
  const { hasActiveSubscription, activateSubscription } = useUser();

  const handleSubscribe = () => {
    activateSubscription();
    toast({
      title: "Подписка активирована!",
      description: "Теперь вам доступны все премиум-функции",
    });
    onClose();
  };

  const getFeatureDescription = () => {
    switch (feature) {
      case 'recipe':
        return 'AI генерация рецептов';
      case 'image':
        return 'Распознавание продуктов по фото';
      default:
        return 'премиум-функции';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-amber-500" />
              <DialogTitle>Premium подписка</DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Для использования {getFeatureDescription()} требуется Premium подписка
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mb-1">
              250 ₽ <span className="text-base font-normal text-muted-foreground">/месяц</span>
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

          <div className="flex gap-2">
            <Button 
              onClick={handleSubscribe}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
              size="lg"
            >
              <Crown className="w-4 h-4 mr-2" />
              Подключить Premium
            </Button>
            <Button 
              variant="outline"
              onClick={onClose}
              size="lg"
            >
              Позже
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Чат с AI-поваром доступен бесплатно
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
