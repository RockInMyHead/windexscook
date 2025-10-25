import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={handleGoBack}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Политика конфиденциальности</h1>
              <p className="text-muted-foreground">Последнее обновление: {new Date().toLocaleDateString('ru-RU')}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">1. Общие положения</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Настоящая Политика конфиденциальности (далее — «Политика») определяет порядок обработки 
              персональных данных пользователей сайта WindexsCook (далее — «Сайт»).
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Используя Сайт, Пользователь дает свое согласие на обработку персональных данных 
              в соответствии с настоящей Политикой.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">2. Какие данные мы собираем</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Мы собираем следующие типы персональных данных:
            </p>
            <div className="space-y-3">
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">Данные регистрации:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Имя пользователя</li>
                  <li>Адрес электронной почты</li>
                  <li>Пароль (в зашифрованном виде)</li>
                </ul>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">Данные использования:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Рецепты, созданные пользователем</li>
                  <li>Предпочтения в еде и аллергии</li>
                  <li>История взаимодействия с AI-поваром</li>
                  <li>Голосовые записи (обрабатываются локально)</li>
                </ul>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">Технические данные:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>IP-адрес</li>
                  <li>Тип браузера и операционной системы</li>
                  <li>Время посещения и действия на сайте</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">3. Цели обработки данных</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Мы используем персональные данные для следующих целей:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Предоставления услуг по созданию рецептов</li>
              <li>Персонализации рекомендаций</li>
              <li>Обработки платежей за премиум-подписку</li>
              <li>Улучшения качества сервиса</li>
              <li>Технической поддержки пользователей</li>
              <li>Соблюдения правовых требований</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">4. Правовые основания обработки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Обработка персональных данных осуществляется на основании:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Согласия пользователя</strong> — для маркетинговых коммуникаций</li>
              <li><strong>Исполнения договора</strong> — для предоставления услуг</li>
              <li><strong>Законных интересов</strong> — для улучшения сервиса и безопасности</li>
              <li><strong>Правовых обязательств</strong> — для соблюдения требований законодательства</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">5. Передача данных третьим лицам</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Мы можем передавать персональные данные следующим категориям получателей:
            </p>
            <div className="space-y-3">
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">Платежные системы:</h4>
                <p className="text-sm text-muted-foreground">
                  ЮKassa — для обработки платежей за премиум-подписку
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">AI-сервисы:</h4>
                <p className="text-sm text-muted-foreground">
                  OpenAI — для генерации рецептов и голосового взаимодействия
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">Технические партнеры:</h4>
                <p className="text-sm text-muted-foreground">
                  Хостинг-провайдеры и CDN для обеспечения работы сервиса
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">6. Безопасность данных</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Мы принимаем все необходимые технические и организационные меры для защиты 
              персональных данных:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Шифрование данных при передаче (HTTPS)</li>
              <li>Хеширование паролей с использованием bcrypt</li>
              <li>Регулярные обновления системы безопасности</li>
              <li>Ограничение доступа к данным только авторизованному персоналу</li>
              <li>Мониторинг и логирование доступа к данным</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">7. Сроки хранения данных</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Персональные данные хранятся в течение следующих сроков:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Данные аккаунта</strong> — до удаления пользователем</li>
              <li><strong>Рецепты и предпочтения</strong> — до удаления пользователем</li>
              <li><strong>Логи активности</strong> — 12 месяцев</li>
              <li><strong>Данные платежей</strong> — в соответствии с требованиями налогового законодательства</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">8. Права пользователей</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Пользователь имеет следующие права в отношении своих персональных данных:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Право доступа</strong> — получить информацию об обработке данных</li>
              <li><strong>Право исправления</strong> — исправить неточные данные</li>
              <li><strong>Право удаления</strong> — удалить свои данные</li>
              <li><strong>Право ограничения</strong> — ограничить обработку данных</li>
              <li><strong>Право портабельности</strong> — получить данные в структурированном формате</li>
              <li><strong>Право отзыва согласия</strong> — отозвать согласие на обработку</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">9. Cookies и аналогичные технологии</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Мы используем cookies и аналогичные технологии для:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Запоминания настроек пользователя</li>
              <li>Анализа использования сайта</li>
              <li>Персонализации контента</li>
              <li>Обеспечения безопасности</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              Пользователь может управлять cookies через настройки браузера.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">10. Изменения в Политике</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Мы можем обновлять настоящую Политику конфиденциальности. О существенных изменениях 
              мы уведомим пользователей через сайт или по электронной почте.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Продолжение использования Сайта после внесения изменений означает согласие 
              с обновленной Политикой.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">11. Контактная информация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              По всем вопросам, связанным с обработкой персональных данных, обращайтесь:
            </p>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Email: <a href="mailto:privacy@windexscook.ru" className="text-primary hover:underline">privacy@windexscook.ru</a>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Общие вопросы: <a href="mailto:support@windexscook.ru" className="text-primary hover:underline">support@windexscook.ru</a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              © 2025 WindexsCook. Все права защищены.
            </p>
            <Button variant="outline" onClick={handleGoBack}>
              Вернуться назад
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
