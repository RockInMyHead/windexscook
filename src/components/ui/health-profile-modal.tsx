import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Textarea } from './textarea';
import { Label } from './label';
import { Checkbox } from './checkbox';
import { Separator } from './separator';
import { useUser } from '../../contexts/UserContext';
import { UserHealthProfile, HEALTH_CONDITIONS, DIETARY_RESTRICTIONS, COMMON_ALLERGIES } from '../../types/health';
import { Heart, Shield, AlertTriangle, Utensils } from 'lucide-react';

interface HealthProfileModalProps {
  children: React.ReactNode;
}

export const HealthProfileModal: React.FC<HealthProfileModalProps> = ({ children }) => {
  const { user, updateHealthProfile } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [healthProfile, setHealthProfile] = useState<UserHealthProfile>({
    conditions: [],
    dietaryRestrictions: [],
    allergies: [],
    preferences: [],
    notes: ''
  });

  useEffect(() => {
    if (user?.healthProfile) {
      setHealthProfile(user.healthProfile);
    }
  }, [user]);

  const handleConditionToggle = (conditionId: string) => {
    const condition = HEALTH_CONDITIONS.find(c => c.id === conditionId);
    if (!condition) return;

    setHealthProfile(prev => ({
      ...prev,
      conditions: prev.conditions.some(c => c.id === conditionId)
        ? prev.conditions.filter(c => c.id !== conditionId)
        : [...prev.conditions, condition]
    }));
  };

  const handleDietaryRestrictionToggle = (restriction: string) => {
    setHealthProfile(prev => ({
      ...prev,
      dietaryRestrictions: prev.dietaryRestrictions.includes(restriction)
        ? prev.dietaryRestrictions.filter(r => r !== restriction)
        : [...prev.dietaryRestrictions, restriction]
    }));
  };

  const handleAllergyToggle = (allergy: string) => {
    setHealthProfile(prev => ({
      ...prev,
      allergies: prev.allergies.includes(allergy)
        ? prev.allergies.filter(a => a !== allergy)
        : [...prev.allergies, allergy]
    }));
  };

  const handleSave = () => {
    updateHealthProfile(healthProfile);
    setIsOpen(false);
  };

  const getConditionIcon = (conditionId: string) => {
    switch (conditionId) {
      case 'diabetes':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'gastritis':
        return <Shield className="h-4 w-4 text-orange-500" />;
      case 'hypertension':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Heart className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Профиль здоровья
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Состояния здоровья */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Состояния здоровья
              </CardTitle>
              <CardDescription>
                Выберите состояния, которые влияют на ваше питание
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {HEALTH_CONDITIONS.map((condition) => (
                <div key={condition.id} className="space-y-2">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id={condition.id}
                      checked={healthProfile.conditions.some(c => c.id === condition.id)}
                      onCheckedChange={() => handleConditionToggle(condition.id)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={condition.id} className="flex items-center gap-2 cursor-pointer">
                        {getConditionIcon(condition.id)}
                        <span className="font-medium">{condition.name}</span>
                      </Label>
                      {condition.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {condition.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {healthProfile.conditions.some(c => c.id === condition.id) && (
                    <div className="ml-6 space-y-2">
                      <div>
                        <h4 className="text-sm font-medium text-red-600 mb-1">Ограничения:</h4>
                        <div className="flex flex-wrap gap-1">
                          {condition.restrictions.map((restriction, index) => (
                            <Badge key={index} variant="destructive" className="text-xs">
                              {restriction}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-green-600 mb-1">Рекомендации:</h4>
                        <div className="flex flex-wrap gap-1">
                          {condition.recommendations.map((recommendation, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {recommendation}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Диетические ограничения */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5" />
                Диетические предпочтения
              </CardTitle>
              <CardDescription>
                Выберите диеты или стили питания, которых вы придерживаетесь
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {DIETARY_RESTRICTIONS.map((restriction) => (
                  <div key={restriction} className="flex items-center space-x-2">
                    <Checkbox
                      id={restriction}
                      checked={healthProfile.dietaryRestrictions.includes(restriction)}
                      onCheckedChange={() => handleDietaryRestrictionToggle(restriction)}
                    />
                    <Label htmlFor={restriction} className="text-sm cursor-pointer">
                      {restriction}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Аллергии */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Аллергии и непереносимости
              </CardTitle>
              <CardDescription>
                Укажите продукты, на которые у вас аллергия или непереносимость
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {COMMON_ALLERGIES.map((allergy) => (
                  <div key={allergy} className="flex items-center space-x-2">
                    <Checkbox
                      id={allergy}
                      checked={healthProfile.allergies.includes(allergy)}
                      onCheckedChange={() => handleAllergyToggle(allergy)}
                    />
                    <Label htmlFor={allergy} className="text-sm cursor-pointer">
                      {allergy}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Дополнительные заметки */}
          <Card>
            <CardHeader>
              <CardTitle>Дополнительные заметки</CardTitle>
              <CardDescription>
                Добавьте любую дополнительную информацию о ваших пищевых потребностях
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Например: не люблю острое, предпочитаю мягкую пищу, нужно больше белка..."
                value={healthProfile.notes || ''}
                onChange={(e) => setHealthProfile(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </CardContent>
          </Card>

          <Separator />

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave}>
              Сохранить профиль
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};



