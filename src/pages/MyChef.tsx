import React, { useState } from 'react';
import { Header } from '@/components/header';
import { AiChefChat } from '@/components/ui/ai-chef-chat';
import { ElevenLabsMirror } from '@/components/ui/elevenlabs-mirror';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChefHat, 
  Heart, 
  BookOpen,
  Users,
  Utensils,
  MessageSquare,
  Video
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';

export const MyChef = () => {
  const { user, isAuthenticated } = useUser();
  const [activeTab, setActiveTab] = useState('chat');

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <ChefHat className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Войдите в аккаунт</h2>
            <p className="text-muted-foreground mb-4">
              Чтобы общаться с <span className="text-primary">Windexs</span> кулинаром, необходимо войти в аккаунт
            </p>
            <Button className="bg-gradient-primary hover:opacity-90 transition-opacity">
              Войти
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onRegister={() => {}} onLogin={() => {}} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
              <ChefHat className="w-8 h-8 text-primary" />
              <span className="text-primary">Windexs</span> кулинар
            </h1>
            <p className="text-muted-foreground">
              Ваш персональный кулинарный помощник готов ответить на любые вопросы о готовке
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
            {/* Main Content Section */}
            <div className="lg:col-span-2 flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="chat" className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Текстовый чат
                  </TabsTrigger>
                  <TabsTrigger value="mirror" className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Видеозвонок
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="chat" className="flex-1 mt-0">
                  <AiChefChat className="h-full min-h-[500px] max-h-[calc(100vh-300px)]" />
                </TabsContent>
                
                <TabsContent value="mirror" className="flex-1 mt-0">
                  <ElevenLabsMirror className="h-full min-h-[500px] max-h-[calc(100vh-300px)]" />
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar */}
            <div className="space-y-6 h-fit">

              {/* Health Profile Status */}
              {user?.healthProfile && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="w-5 h-5 text-red-500" />
                      Ваш профиль здоровья
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {user.healthProfile.conditions.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Состояния:</p>
                        <div className="flex flex-wrap gap-1">
                          {user.healthProfile.conditions.map((condition, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {condition.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {user.healthProfile.dietaryRestrictions.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Диеты:</p>
                        <div className="flex flex-wrap gap-1">
                          {user.healthProfile.dietaryRestrictions.map((diet, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {diet}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      AI учитывает ваши особенности при даче советов
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-green-500" />
                    Быстрые действия
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => window.location.href = '/my-recipes'}
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Мои рецепты
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => window.location.href = '/recipes'}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Все рецепты
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyChef;
