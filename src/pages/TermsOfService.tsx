import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText } from 'lucide-react';

const TermsOfService: React.FC = () => {
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
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Пользовательское соглашение</h1>
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
              Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует отношения между 
              администрацией сайта WindexsCook (далее — «Сайт») и пользователем (далее — «Пользователь») 
              при использовании сервиса.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Используя Сайт, Пользователь выражает свое согласие с условиями настоящего Соглашения. 
              Если Пользователь не согласен с условиями Соглашения, он должен прекратить использование Сайта.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">2. Описание сервиса</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              WindexsCook — это платформа для создания кулинарных рецептов с использованием искусственного интеллекта. 
              Сервис предоставляет пользователям возможность:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Создавать рецепты на основе имеющихся ингредиентов</li>
              <li>Получать персональные рекомендации по приготовлению блюд</li>
              <li>Сохранять и организовывать свои рецепты</li>
              <li>Использовать голосовые функции для взаимодействия с AI-поваром</li>
              <li>Получать доступ к премиум-функциям при оформлении подписки</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">3. Регистрация и учетная запись</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Для использования некоторых функций Сайта Пользователь должен пройти процедуру регистрации 
              и создать учетную запись.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Пользователь обязуется:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Предоставлять достоверную и актуальную информацию</li>
              <li>Поддерживать безопасность своей учетной записи</li>
              <li>Нести ответственность за все действия, совершенные под его учетной записью</li>
              <li>Немедленно уведомлять администрацию о любом несанкционированном использовании</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">4. Интеллектуальная собственность</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Все материалы Сайта, включая тексты, изображения, дизайн, программное обеспечение, 
              являются объектами интеллектуальной собственности и защищены законодательством об авторском праве.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Пользователь не имеет права:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Копировать, распространять или использовать материалы Сайта без разрешения</li>
              <li>Создавать производные произведения на основе материалов Сайта</li>
              <li>Использовать материалы в коммерческих целях</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">5. Платные услуги</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Некоторые функции Сайта предоставляются на платной основе. Условия предоставления 
              платных услуг описаны в соответствующих разделах Сайта.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Оплата производится через платежную систему ЮKassa. Возврат средств осуществляется 
              в соответствии с политикой возврата платежной системы.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">6. Ответственность</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Администрация Сайта не несет ответственности за:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Временные технические сбои в работе Сайта</li>
              <li>Действия третьих лиц</li>
              <li>Ущерб, причиненный в результате использования рецептов</li>
              <li>Аллергические реакции на ингредиенты</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">7. Изменения в Соглашении</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Администрация оставляет за собой право в любое время изменять условия настоящего Соглашения. 
              Изменения вступают в силу с момента их публикации на Сайте.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Продолжение использования Сайта после внесения изменений означает согласие Пользователя 
              с новыми условиями.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl">8. Контактная информация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              По всем вопросам, связанным с настоящим Соглашением, Пользователь может обратиться 
              к администрации Сайта:
            </p>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Email: <a href="mailto:support@windexscook.ru" className="text-primary hover:underline">support@windexscook.ru</a>
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

export default TermsOfService;
