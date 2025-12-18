import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Mail, Lock, User, ChefHat, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Пароль теперь хэшируется на сервере с bcrypt

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: { id: number | string; name: string; email: string; role?: string }) => void;
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

    try {
      // Отправляем обычный пароль (хэширование происходит на сервере)
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: loginData.email,
          password: loginData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        const isAdmin = data.role === 'admin';
        onSuccess({
          id: data.id.toString(),
          name: data.name,
          email: data.email,
          role: data.role
        });

        if (isAdmin) {
          toast({
            title: "Добро пожаловать, Администратор!",
            description: "Вы вошли с правами администратора",
          });
        } else {
          toast({
            title: "Добро пожаловать!",
            description: "Вы успешно вошли в личный кабинет",
          });
        }
        onClose();
      } else {
        toast({
          title: "Ошибка входа",
          description: data.error || "Неверный email или пароль",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Ошибка входа",
        description: "Произошла ошибка при входе. Попробуйте еще раз.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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

    try {
      // Отправляем обычный пароль (хэширование происходит на сервере)
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: registerData.name,
          email: registerData.email,
          password: registerData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess({
          id: data.id.toString(),
          name: data.name,
          email: data.email,
          role: data.role
        });
        toast({
          title: "Регистрация успешна!",
          description: "Добро пожаловать в кулинар!",
        });
        onClose();
      } else {
        toast({
          title: "Ошибка регистрации",
          description: data.error || "Не удалось зарегистрироваться",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: "Ошибка регистрации",
        description: "Произошла ошибка при регистрации. Попробуйте еще раз.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-md bg-gradient-card border-border/50 shadow-glow my-auto">
        <CardHeader className="relative p-4 sm:p-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 hover:bg-destructive/10 hover:text-destructive w-8 h-8 sm:w-10 sm:h-10"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          
          <div className="text-center space-y-2 pt-2 sm:pt-0">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <ChefHat className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-lg sm:text-2xl font-bold text-foreground px-2 sm:px-0">
              Добро пожаловать в <span className="text-primary">Windexs</span> кулинар!
            </CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground px-2 sm:px-0">
              Сохраняйте рецепты, создавайте коллекции и получайте персональные рекомендации
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-10 sm:h-11">
              <TabsTrigger value="login" className="text-sm sm:text-base">Вход</TabsTrigger>
              <TabsTrigger value="register" className="text-sm sm:text-base">Регистрация</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
              <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="login-email" className="text-sm sm:text-base">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="your@email.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                      className="pl-10 sm:pl-12 h-10 sm:h-11 text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="login-password" className="text-sm sm:text-base">Пароль</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                      className="pl-10 sm:pl-12 h-10 sm:h-11 text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div className="text-right">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setShowResetPassword(true)}
                    className="text-xs sm:text-sm text-primary hover:text-primary/80 p-0 h-auto"
                  >
                    Забыли пароль?
                  </Button>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary hover:opacity-90 transition-opacity h-10 sm:h-11 text-sm sm:text-base font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                      Входим...
                    </>
                  ) : (
                    "Войти"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
              <form onSubmit={handleRegister} className="space-y-3 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="register-name" className="text-sm sm:text-base">Имя</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Ваше имя"
                      value={registerData.name}
                      onChange={(e) => setRegisterData({...registerData, name: e.target.value})}
                      className="pl-10 sm:pl-12 h-10 sm:h-11 text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="register-email" className="text-sm sm:text-base">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="your@email.com"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                      className="pl-10 sm:pl-12 h-10 sm:h-11 text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="register-password" className="text-sm sm:text-base">Пароль</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="••••••••"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                      className="pl-10 sm:pl-12 h-10 sm:h-11 text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="register-confirm" className="text-sm sm:text-base">Подтвердите пароль</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <Input
                      id="register-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={registerData.confirmPassword}
                      onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                      className="pl-10 sm:pl-12 h-10 sm:h-11 text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-start space-x-2 sm:space-x-3">
                  <Checkbox
                    id="accept-terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                    className="mt-0.5 sm:mt-1 w-4 h-4 sm:w-5 sm:h-5"
                  />
                  <div className="grid gap-1 leading-none flex-1">
                    <Label
                      htmlFor="accept-terms"
                      className="text-xs sm:text-sm font-medium leading-relaxed peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Я принимаю{" "}
                      <Button
                        type="button"
                        variant="link"
                        className="p-0 h-auto text-primary hover:text-primary/80 underline text-xs sm:text-sm"
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
                        className="p-0 h-auto text-primary hover:text-primary/80 underline text-xs sm:text-sm"
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
                  className="w-full bg-gradient-primary hover:opacity-90 transition-opacity h-10 sm:h-11 text-sm sm:text-base font-medium"
                  disabled={isLoading || !acceptTerms}
                >
                  {isLoading ? (
                    <>
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                      Регистрируем...
                    </>
                  ) : (
                    "Зарегистрироваться"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-4 sm:mt-6 text-center px-2 sm:px-0">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Продолжая, вы соглашаетесь с нашими условиями использования
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Модальное окно восстановления пароля */}
      {showResetPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-60 overflow-y-auto">
          <Card className="w-full max-w-md bg-gradient-card border-border/50 shadow-glow my-auto">
            <CardHeader className="relative p-4 sm:p-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowResetPassword(false);
                  setResetEmail("");
                }}
                className="absolute top-2 right-2 sm:top-4 sm:right-4 hover:bg-destructive/10 hover:text-destructive w-8 h-8 sm:w-10 sm:h-10"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              
              <div className="text-center space-y-2 pt-2 sm:pt-0">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-lg sm:text-2xl font-bold text-foreground px-2 sm:px-0">
                  Восстановление пароля
                </CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground px-2 sm:px-0">
                  Введите ваш email для получения ссылки восстановления
                </p>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              <form onSubmit={handleResetPassword} className="space-y-3 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="reset-email" className="text-sm sm:text-base">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="your@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="pl-10 sm:pl-12 h-10 sm:h-11 text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowResetPassword(false);
                      setResetEmail("");
                    }}
                    className="flex-1 h-10 sm:h-11 text-sm sm:text-base"
                  >
                    Отмена
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity h-10 sm:h-11 text-sm sm:text-base font-medium"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                        Отправляем...
                      </>
                    ) : (
                      "Отправить"
                    )}
                  </Button>
                </div>
              </form>

              <div className="mt-4 sm:mt-6 text-center px-2 sm:px-0">
                <p className="text-xs sm:text-sm text-muted-foreground">
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



