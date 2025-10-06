import React, { useState, useRef } from 'react';
import { Header } from "@/components/header";
import { AuthModal } from "@/components/ui/auth-modal";
import { PremiumModal } from "@/components/ui/premium-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";
import { toast } from "@/hooks/use-toast";
import { OpenAIService } from "@/services/openai";

const Collaborations = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login'|'register'>('login');
  const { isAuthenticated, login, hasActiveSubscription } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRegister = () => { setAuthMode('register'); setShowAuthModal(true); };
  const handleLogin = () => { setAuthMode('login'); setShowAuthModal(true); };

  const handleAnalyze = async (file: File) => {
    if (!isAuthenticated) {
      handleLogin();
      return;
    }
    
    if (!hasActiveSubscription) {
      setShowPremiumModal(true);
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await OpenAIService.analyzeCaloriesFromImage(file);
      setAnalysisResult(result);
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleAnalyze(file);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onRegister={handleRegister} onLogin={handleLogin} />
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle>Онлайн калории</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={onFileChange} />
            <Button onClick={() => fileInputRef.current?.click()} className="w-full">
              {isLoading ? 'Анализирую...' : 'Загрузить фото блюда'}
            </Button>
            {analysisResult && (
              <pre className="whitespace-pre-wrap bg-muted/20 p-4 rounded">{analysisResult}</pre>
            )}
          </CardContent>
        </Card>
      </div>
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={(userData) => { login(userData); setShowAuthModal(false); toast({ title: 'Добро пожаловать!', description: `Привет, ${userData.name}!` }); }}
      />
      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        feature="image"
        onSuccess={() => {
          // После успешной подписки можно выполнить дополнительные действия
          console.log('Premium subscription activated for image analysis');
        }}
      />
    </div>
  );
};

export default Collaborations;
