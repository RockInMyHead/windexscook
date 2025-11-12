import React, { useState, useRef } from 'react';
import { Header } from "@/components/header";
import { AuthModal } from "@/components/ui/auth-modal";
import { PremiumModal } from "@/components/ui/premium-modal";
import { CalorieAnalysisResult } from "@/components/ui/calorie-analysis-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";
import { toast } from "@/hooks/use-toast";
import { OpenAIService } from "@/services/openai";
import { AudioUtils } from "@/lib/audio-utils";
import { X } from "lucide-react";

const Collaborations = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisTimestamp, setAnalysisTimestamp] = useState<Date | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login'|'register'>('login');
  const { isAuthenticated, login, hasPremiumAccess } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRegister = () => { setAuthMode('register'); setShowAuthModal(true); };
  const handleLogin = () => { setAuthMode('login'); setShowAuthModal(true); };

  const handleAnalyze = async (file: File) => {
    if (!isAuthenticated) {
      handleLogin();
      return;
    }
    
    if (!hasPremiumAccess) {
      setShowPremiumModal(true);
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await OpenAIService.analyzeCaloriesFromImage(file);
      setAnalysisResult(result);
      setAnalysisTimestamp(new Date());
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Проверяем размер файла
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'Файл слишком большой',
          description: 'Пожалуйста, выберите изображение меньше 10MB',
          variant: 'destructive'
        });
        return;
      }
      handleAnalyze(file);
    }
  };

  const clearResults = () => {
    setAnalysisResult(null);
    setAnalysisTimestamp(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Новый обработчик клика по кнопке загрузки фото
  const handleUploadClick = () => {
    if (!isAuthenticated) {
      handleLogin();
      return;
    }
    if (!hasPremiumAccess) {
      setShowPremiumModal(true);
      return;
    }
    fileInputRef.current?.click();
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
            <Button onClick={handleUploadClick} className="w-full">
              {isLoading ? 'Анализирую...' : 'Загрузить фото блюда'}
            </Button>
          </CardContent>
        </Card>
        
        {/* Результаты анализа в стиле чата */}
        {analysisResult && analysisTimestamp && (
          <div className="max-w-4xl mx-auto mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Результат анализа</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearResults}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4 mr-1" />
                Очистить
              </Button>
            </div>
            <div className="space-y-4">
              <CalorieAnalysisResult 
                result={analysisResult}
                timestamp={analysisTimestamp}
                onLike={() => {
                  toast({
                    title: "👍 Спасибо!",
                    description: "Ваша оценка помогает улучшить анализ",
                  });
                }}
              />
            </div>
          </div>
        )}
      </div>
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={(userData) => {
          login({
            ...userData,
            id: userData.id.toString() // Ensure id is string for User type
          });
          setShowAuthModal(false);
          toast({ title: 'Добро пожаловать!', description: `Привет, ${userData.name}!` });
        }}
      />
      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        feature="image"
        onSuccess={() => console.log('Premium subscription activated for image analysis')}
      />
    </div>
  );
};

export default Collaborations;
