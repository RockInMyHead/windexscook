import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Clock, MessageCircle, ChefHat } from 'lucide-react';

const Premium: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Clock className="w-5 h-5" />,
      title: "Неограниченное время",
      description: "Говорите с шеф-поваром сколько угодно времени"
    },
    {
      icon: <MessageCircle className="w-5 h-5" />,
      title: "Расширенные рецепты",
      description: "Доступ к премиум коллекции рецептов"
    },
    {
      icon: <ChefHat className="w-5 h-5" />,
      title: "Персональные консультации",
      description: "Индивидуальные советы от шеф-повара"
    },
    {
      icon: <Star className="w-5 h-5" />,
      title: "Приоритетная поддержка",
      description: "Быстрая помощь и обратная связь"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Windexs Cook <span className="text-orange-500">Premium</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Неограниченное кулинарное приключение с вашим личным шеф-поваром
          </p>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex items-center justify-center mb-4">
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-lg">
                🎯 Ваше бесплатное время вышло!
              </Badge>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Вы использовали 1 час бесплатного голосового общения с шеф-поваром.
              Перейдите на Premium для продолжения кулинарных бесед!
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Free Plan */}
          <Card className="relative">
            <CardHeader>
              <CardTitle className="text-center">Бесплатный план</CardTitle>
              <div className="text-center">
                <span className="text-3xl font-bold">₽0</span>
                <span className="text-gray-500">/месяц</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-3" />
                  <span>1 час голосового общения</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-3" />
                  <span>Базовые рецепты</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-3" />
                  <span>Стандартная поддержка</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Premium Plan */}
          <Card className="relative border-orange-500 border-2">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-orange-500 text-white px-4 py-1">Популярный</Badge>
            </div>

            <CardHeader>
              <CardTitle className="text-center text-orange-600">Premium план</CardTitle>
              <div className="text-center">
                <span className="text-3xl font-bold text-orange-600">₽299</span>
                <span className="text-gray-500">/месяц</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 mb-6">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start">
                    <div className="text-orange-500 mr-3 mt-1">
                      {feature.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{feature.title}</h4>
                      <p className="text-gray-600 dark:text-gray-400 text-xs">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => navigate('/settings?tab=subscription')}
              >
                Перейти на Premium
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12">
          <Button
            variant="outline"
            onClick={() => navigate('/my-chef')}
            className="mr-4"
          >
            Вернуться к рецептам
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/')}
          >
            На главную
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Premium;