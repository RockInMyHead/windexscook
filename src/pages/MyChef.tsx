import React, { useState } from 'react';
import { Header } from '@/components/header';
import { AiChefChat } from '@/components/ui/ai-chef-chat';
import VoiceCallNew from '@/components/ui/voice-call-new';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, MessageCircle } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';

export const MyChef = () => {
  const { user, isAuthenticated } = useUser();
  const [isVoiceCall, setIsVoiceCall] = useState(false);

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
      
      {/* Mode toggle buttons */}
      <div className="flex justify-center gap-4 p-4 bg-muted/30 border-b border-border/50">
        <Button
          variant={!isVoiceCall ? "default" : "outline"}
          onClick={() => setIsVoiceCall(false)}
          className="flex items-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          Чат с AI поваром
        </Button>
        <Button
          variant={isVoiceCall ? "default" : "outline"}
          onClick={() => setIsVoiceCall(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
        >
          <Phone className="w-4 h-4" />
          Голосовой звонок
        </Button>
      </div>
      
      {/* Content area */}
      <div className="flex-1 flex flex-col">
        {isVoiceCall ? (
          <VoiceCallNew className="h-full" />
        ) : (
          <AiChefChat className="h-full" />
        )}
      </div>
    </div>
  );
};

export default MyChef;
