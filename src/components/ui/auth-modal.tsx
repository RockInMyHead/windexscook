import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Mail, Lock, User, ChefHat, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: { name: string; email: string }) => void;
}

export const AuthModal = ({ isOpen, onClose, onSuccess }: AuthModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ 
    name: "", 
    email: "", 
    password: "", 
    confirmPassword: "" 
  });
  const [resetEmail, setResetEmail] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Проверка на администратора
    if (loginData.email === "admin@cook.windexs.ru" && loginData.password === "admin123") {
      onSuccess({ 
        name: "Администратор", 
        email: "admin@cook.windexs.ru",
        role: "admin"
      });
      toast({
        title: "Добро пожаловать, Администратор!",
        description: "Вы вошли с правами администратора",
      });
      onClose();
      setIsLoading(false);
      return;
    }

    // Симуляция API вызова для обычных пользователей
    setTimeout(() => {
      if (loginData.email && loginData.password) {
        onSuccess({ 
          name: loginData.email.split('@')[0], 
          email: loginData.email 
        });
        toast({
          title: "Добро пожаловать!",
          description: "Вы успешно вошли в личный кабинет",
        });
        onClose();
      } else {
        toast({
          title: "Ошибка входа",
          description: "Пожалуйста, заполните все поля",
          variant: "destructive",
        });
      }
      setIsLoading(false);
    }, 1000);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (registerData.password !== registerData.confirmPassword) {
      toast({
        title: "Ошибка регистрации",
        description: "Пароли не совпадают",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (!acceptTerms) {
      toast({
        title: "Ошибка регистрации",
        description: "Необходимо принять пользовательское соглашение",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Симуляция API вызова
    setTimeout(() => {
      onSuccess({ 
        name: registerData.name, 
        email: registerData.email 
      });
      toast({
        title: "Регистрация успешна!",
        description: "Добро пожаловать в кулинар!",
      });
      onClose();
      setIsLoading(false);
    }, 1000);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!resetEmail) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, введите email",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      console.log('🔐 [Auth] Отправляем запрос восстановления пароля для:', resetEmail);
      
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Письмо отправлено!",
          description: data.message || `На адрес ${resetEmail} отправлена ссылка для восстановления пароля`,
        });
        setShowResetPassword(false);
        setResetEmail("");
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось отправить письмо",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ [Auth] Ошибка восстановления пароля:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось отправить письмо. Попробуйте позже.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md bg-gradient-card border-border/50 shadow-glow">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
          
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <ChefHat className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              Добро пожаловать в <span className="text-primary">Windexs</span> кулинар!
            </CardTitle>
            <p className="text-muted-foreground">
              Сохраняйте рецепты, создавайте коллекции и получайте персональные рекомендации
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="your@email.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Пароль</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="text-right">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setShowResetPassword(true)}
                    className="text-sm text-primary hover:text-primary/80 p-0 h-auto"
                  >
                    Забыли пароль?
                  </Button>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                      Входим...
                    </>
                  ) : (
                    "Войти"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Имя</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Ваше имя"
                      value={registerData.name}
                      onChange={(e) => setRegisterData({...registerData, name: e.target.value})}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="your@email.com"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password">Пароль</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="••••••••"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-confirm">Подтвердите пароль</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={registerData.confirmPassword}
                      onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="accept-terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                    className="mt-1"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="accept-terms"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Я принимаю{" "}
                      <Button
                        type="button"
                        variant="link"
                        className="p-0 h-auto text-primary hover:text-primary/80 underline"
                        onClick={() => {
                          window.open('/terms', '_blank');
                        }}
                      >
                        пользовательское соглашение
                      </Button>{" "}
                      и{" "}
                      <Button
                        type="button"
                        variant="link"
                        className="p-0 h-auto text-primary hover:text-primary/80 underline"
                        onClick={() => {
                          window.open('/privacy', '_blank');
                        }}
                      >
                        политику конфиденциальности
                      </Button>
                    </Label>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
                  disabled={isLoading || !acceptTerms}
                >
                  {isLoading ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                      Регистрируем...
                    </>
                  ) : (
                    "Зарегистрироваться"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Продолжая, вы соглашаетесь с нашими условиями использования
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Модальное окно восстановления пароля */}
      {showResetPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-60">
          <Card className="w-full max-w-md bg-gradient-card border-border/50 shadow-glow">
            <CardHeader className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowResetPassword(false);
                  setResetEmail("");
                }}
                className="absolute top-4 right-4 hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
              
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-2xl font-bold text-foreground">
                  Восстановление пароля
                </CardTitle>
                <p className="text-muted-foreground">
                  Введите ваш email для получения ссылки восстановления
                </p>
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="your@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowResetPassword(false);
                      setResetEmail("");
                    }}
                    className="flex-1"
                  >
                    Отмена
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        Отправляем...
                      </>
                    ) : (
                      "Отправить"
                    )}
                  </Button>
                </div>
              </form>

              <div className="mt-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Ссылка для восстановления будет действительна в течение 24 часов
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};



