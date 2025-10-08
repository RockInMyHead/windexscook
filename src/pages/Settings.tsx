import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useUser } from '@/contexts/UserContext';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Bell, Shield, Globe, Palette } from 'lucide-react';
import { Link } from 'react-router-dom';

const Settings: React.FC = () => {
  const { user, updateUser } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  
  // Настройки уведомлений
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    recipeUpdates: true,
    weeklyDigest: true,
  });

  // Настройки конфиденциальности
  const [privacy, setPrivacy] = useState({
    profileVisibility: 'public',
    showEmail: false,
    allowMessages: true,
  });

  // Настройки приложения
  const [appSettings, setAppSettings] = useState({
    language: 'ru',
    theme: 'system',
    autoSave: true,
    showTips: true,
  });

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      // Здесь можно добавить логику сохранения настроек
      await new Promise(resolve => setTimeout(resolve, 1000)); // Имитация API запроса
      
      toast({
        title: "Настройки сохранены",
        description: "Ваши настройки успешно обновлены",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/profile">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к профилю
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Настройки</h1>
            <p className="text-muted-foreground">Управляйте настройками вашего аккаунта</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Уведомления */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Уведомления
              </CardTitle>
              <CardDescription>
                Настройте, какие уведомления вы хотите получать
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email уведомления</Label>
                  <p className="text-sm text-muted-foreground">
                    Получать уведомления на email
                  </p>
                </div>
                <Switch
                  checked={notifications.email}
                  onCheckedChange={(checked) =>
                    setNotifications(prev => ({ ...prev, email: checked }))
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Push уведомления</Label>
                  <p className="text-sm text-muted-foreground">
                    Получать push уведомления в браузере
                  </p>
                </div>
                <Switch
                  checked={notifications.push}
                  onCheckedChange={(checked) =>
                    setNotifications(prev => ({ ...prev, push: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Обновления рецептов</Label>
                  <p className="text-sm text-muted-foreground">
                    Уведомления о новых рецептах и обновлениях
                  </p>
                </div>
                <Switch
                  checked={notifications.recipeUpdates}
                  onCheckedChange={(checked) =>
                    setNotifications(prev => ({ ...prev, recipeUpdates: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Еженедельная сводка</Label>
                  <p className="text-sm text-muted-foreground">
                    Получать еженедельную сводку активности
                  </p>
                </div>
                <Switch
                  checked={notifications.weeklyDigest}
                  onCheckedChange={(checked) =>
                    setNotifications(prev => ({ ...prev, weeklyDigest: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Конфиденциальность */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Конфиденциальность
              </CardTitle>
              <CardDescription>
                Управляйте видимостью вашего профиля
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Видимость профиля</Label>
                <Select
                  value={privacy.profileVisibility}
                  onValueChange={(value) =>
                    setPrivacy(prev => ({ ...prev, profileVisibility: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Публичный</SelectItem>
                    <SelectItem value="friends">Только друзья</SelectItem>
                    <SelectItem value="private">Приватный</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Показывать email</Label>
                  <p className="text-sm text-muted-foreground">
                    Разрешить другим пользователям видеть ваш email
                  </p>
                </div>
                <Switch
                  checked={privacy.showEmail}
                  onCheckedChange={(checked) =>
                    setPrivacy(prev => ({ ...prev, showEmail: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Разрешить сообщения</Label>
                  <p className="text-sm text-muted-foreground">
                    Позволить другим пользователям отправлять вам сообщения
                  </p>
                </div>
                <Switch
                  checked={privacy.allowMessages}
                  onCheckedChange={(checked) =>
                    setPrivacy(prev => ({ ...prev, allowMessages: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Настройки приложения */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Приложение
              </CardTitle>
              <CardDescription>
                Настройки интерфейса и поведения приложения
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Язык</Label>
                <Select
                  value={appSettings.language}
                  onValueChange={(value) =>
                    setAppSettings(prev => ({ ...prev, language: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ru">Русский</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Тема</Label>
                <Select
                  value={appSettings.theme}
                  onValueChange={(value) =>
                    setAppSettings(prev => ({ ...prev, theme: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Светлая</SelectItem>
                    <SelectItem value="dark">Темная</SelectItem>
                    <SelectItem value="system">Системная</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Автосохранение</Label>
                  <p className="text-sm text-muted-foreground">
                    Автоматически сохранять изменения в рецептах
                  </p>
                </div>
                <Switch
                  checked={appSettings.autoSave}
                  onCheckedChange={(checked) =>
                    setAppSettings(prev => ({ ...prev, autoSave: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Показывать подсказки</Label>
                  <p className="text-sm text-muted-foreground">
                    Отображать подсказки и советы по использованию
                  </p>
                </div>
                <Switch
                  checked={appSettings.showTips}
                  onCheckedChange={(checked) =>
                    setAppSettings(prev => ({ ...prev, showTips: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Кнопка сохранения */}
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={isLoading}>
              <Save className="w-4 h-4 mr-2" />
              {isLoading ? 'Сохранение...' : 'Сохранить настройки'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
