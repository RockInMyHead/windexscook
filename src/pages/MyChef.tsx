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
    <div className="min-h-screen bg-background flex flex-col">
      <Header onRegister={() => {}} onLogin={() => {}} />
      
      {/* Tab Navigation */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Текстовый чат</span>
                <span className="sm:hidden">Чат</span>
              </TabsTrigger>
              <TabsTrigger value="mirror" className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                <span className="hidden sm:inline">Видеозвонок</span>
                <span className="sm:hidden">Видео</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      
      {/* Full screen chat */}
      <div className="flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsContent value="chat" className="flex-1 mt-0">
            <AiChefChat className="h-full" />
          </TabsContent>
          
          <TabsContent value="mirror" className="flex-1 mt-0">
            <ElevenLabsMirror className="h-full" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MyChef;
