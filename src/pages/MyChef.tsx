import React from 'react';
import { Header } from '@/components/header';
import { AiChefChat } from '@/components/ui/ai-chef-chat';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';

export const MyChef = () => {
  const { user, isAuthenticated } = useUser();

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
      
      {/* Full screen chat */}
      <div className="flex-1 flex flex-col">
        <AiChefChat className="h-full" />
      </div>
    </div>
  );
};

export default MyChef;
