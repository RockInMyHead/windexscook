import React, { useState } from 'react';
import { Header } from '@/components/header';
import { AiChefChat } from '@/components/ui/ai-chef-chat';
import { ElevenLabsMirror } from '@/components/ui/elevenlabs-mirror';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Heart, 
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
      
      <div className="container mx-auto px-4 py-4 sm:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header with Tab Navigation */}
          <div className="mb-4 sm:mb-8">
            <div className="flex justify-center">
              {/* Tab Navigation in Header */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                <TabsList className="grid w-full grid-cols-2 sm:w-auto">
                  <TabsTrigger value="chat" className="flex items-center gap-2 text-xs sm:text-sm">
                    <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Текстовый чат</span>
                    <span className="sm:hidden">Чат</span>
                  </TabsTrigger>
                  <TabsTrigger value="mirror" className="flex items-center gap-2 text-xs sm:text-sm">
                    <Video className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Видеозвонок</span>
                    <span className="sm:hidden">Видео</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 h-[calc(100vh-180px)] sm:h-[calc(100vh-200px)] min-h-[500px] sm:min-h-[600px]">
            {/* Main Content Section */}
            <div className="lg:col-span-2 flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <TabsContent value="chat" className="flex-1 mt-0">
                  <AiChefChat className="h-full" />
                </TabsContent>
                
                <TabsContent value="mirror" className="flex-1 mt-0">
                  <ElevenLabsMirror className="h-full" />
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar - Hidden on Mobile */}
            <div className="hidden lg:block space-y-6 h-fit">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyChef;
