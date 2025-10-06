import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ChefHat, 
  Menu, 
  X, 
  User, 
  BookOpen, 
  Heart, 
  Users, 
  Settings,
  LogOut,
  Sparkles,
  Activity,
  Shield
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { AuthModal } from "@/components/ui/auth-modal";
import { HealthProfileModal } from "@/components/ui/health-profile-modal";
import { toast } from "@/hooks/use-toast";

interface HeaderProps {
  onRegister: () => void;
  onLogin: () => void;
}

export const Header = ({ onRegister, onLogin }: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const { user, login, logout, isAuthenticated, isAdmin } = useUser();
  const location = useLocation();

  const handleAuthSuccess = (userData: { name: string; email: string }) => {
    login(userData);
    setShowAuthModal(false);
    toast({
      title: "Добро пожаловать!",
      description: `Привет, ${userData.name}!`,
    });
  };

  const handleLogout = () => {
    logout();
    toast({
      title: "До свидания!",
      description: "Вы вышли из аккаунта",
    });
  };

  const navigationItems = [
    { name: "Мои рецепты", href: "/my-recipes", icon: BookOpen },
    { name: "Мой повар", href: "/my-chef", icon: ChefHat },
    { name: "Рецепты", href: "/recipes", icon: Heart },
    { name: "Онлайн коллории", href: "/collaborations", icon: Users },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-foreground"><span className="text-primary">Windex</span> кулинар</h1>
                <p className="text-xs text-muted-foreground">Умный помощник на кухне</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-6">
              {isAuthenticated ? (
                <>
                  {navigationItems.map((item) => (
                    <Button
                      key={item.name}
                      variant="ghost"
                      asChild
                      className={`flex items-center gap-2 hover:bg-primary/10 ${
                        isActive(item.href) 
                          ? "text-primary bg-primary/10" 
                          : "text-foreground hover:text-primary"
                      }`}
                    >
                      <Link to={item.href}>
                        <item.icon className="w-4 h-4" />
                        {item.name}
                      </Link>
                    </Button>
                  ))}
                </>
              ) : null}
            </nav>

            {/* User Menu / Auth Buttons */}
            <div className="flex items-center gap-4">
              {/* Повар-Онлайн Button */}
              <Button
                variant="outline"
                asChild
                className="hidden sm:flex items-center gap-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
              >
                <Link to="/my-chef">
                  <ChefHat className="w-4 h-4 text-primary" />
                  Повар-Онлайн
                </Link>
              </Button>

              {isAuthenticated ? (
                <div className="flex items-center gap-4">
                  {/* User Avatar & Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src="" alt={user?.name} />
                          <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                            {user?.name?.charAt(0).toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                      <div className="flex items-center justify-start gap-2 p-2">
                        <div className="flex flex-col space-y-1 leading-none">
                          <p className="font-medium">{user?.name}</p>
                          <p className="w-[200px] truncate text-sm text-muted-foreground">
                            {user?.email}
                          </p>
                        </div>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/profile">
                          <User className="mr-2 h-4 w-4" />
                          <span>Личный кабинет</span>
                        </Link>
                      </DropdownMenuItem>
                      <HealthProfileModal>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <Activity className="mr-2 h-4 w-4" />
                          <span>Профиль здоровья</span>
                        </DropdownMenuItem>
                      </HealthProfileModal>
                      <DropdownMenuItem asChild>
                        <Link to="/profile">
                          <Settings className="mr-2 h-4 w-4" />
                          <span>Настройки</span>
                        </Link>
                      </DropdownMenuItem>
                      {isAdmin && (
                        <DropdownMenuItem asChild>
                          <Link to="/admin">
                            <Shield className="mr-2 h-4 w-4" />
                            <span>Панель администратора</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Выйти</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Mobile Menu Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                  >
                    {isMenuOpen ? (
                      <X className="h-5 w-5" />
                    ) : (
                      <Menu className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setAuthMode('login');
                      onLogin();
                    }}
                    className="hidden sm:flex text-foreground hover:text-primary"
                  >
                    Войти
                  </Button>
                  <Button
                    onClick={() => {
                      setAuthMode('register');
                      onRegister();
                    }}
                    className="bg-gradient-primary hover:opacity-90 transition-opacity"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Регистрация</span>
                    <span className="sm:hidden">Войти</span>
                  </Button>
                  
                  {/* Mobile Menu Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                  >
                    {isMenuOpen ? (
                      <X className="h-5 w-5" />
                    ) : (
                      <Menu className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="lg:hidden border-t border-border/50 py-4">
              <nav className="flex flex-col space-y-2">
                {isAuthenticated ? (
                  <>
                    <Button
                      variant="outline"
                      asChild
                      className="w-full justify-start border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                    >
                      <Link to="/my-chef" onClick={() => setIsMenuOpen(false)}>
                        <ChefHat className="w-4 h-4 mr-2 text-primary" />
                        Повар-Онлайн
                      </Link>
                    </Button>
                    {navigationItems.map((item) => (
                      <Button
                        key={item.name}
                        variant="ghost"
                        asChild
                        className={`justify-start hover:bg-primary/10 ${
                          isActive(item.href) 
                            ? "text-primary bg-primary/10" 
                            : "text-foreground hover:text-primary"
                        }`}
                      >
                        <Link to={item.href} onClick={() => setIsMenuOpen(false)}>
                          <item.icon className="w-4 h-4 mr-2" />
                          {item.name}
                        </Link>
                      </Button>
                    ))}
                    <div className="pt-2 border-t border-border/50">
                      <Button
                        variant="ghost"
                        asChild
                        className="w-full justify-start text-foreground hover:text-primary hover:bg-primary/10"
                      >
                        <Link to="/profile" onClick={() => setIsMenuOpen(false)}>
                          <User className="w-4 h-4 mr-2" />
                          Личный кабинет
                        </Link>
                      </Button>
                      <HealthProfileModal>
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-foreground hover:text-primary hover:bg-primary/10"
                        >
                          <Activity className="w-4 h-4 mr-2" />
                          Профиль здоровья
                        </Button>
                      </HealthProfileModal>
                      <Button
                        variant="ghost"
                        asChild
                        className="w-full justify-start text-foreground hover:text-primary hover:bg-primary/10"
                      >
                        <Link to="/profile" onClick={() => setIsMenuOpen(false)}>
                          <Settings className="w-4 h-4 mr-2" />
                          Настройки
                        </Link>
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          asChild
                          className="w-full justify-start text-foreground hover:text-primary hover:bg-primary/10"
                        >
                          <Link to="/admin" onClick={() => setIsMenuOpen(false)}>
                            <Shield className="w-4 h-4 mr-2" />
                            Панель администратора
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        onClick={handleLogout}
                        className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Выйти
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      asChild
                      className="w-full justify-start border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                    >
                      <Link to="/my-chef" onClick={() => setIsMenuOpen(false)}>
                        <ChefHat className="w-4 h-4 mr-2 text-primary" />
                        Повар-Онлайн
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setAuthMode('login');
                        onLogin();
                        setIsMenuOpen(false);
                      }}
                      className="w-full justify-start text-foreground hover:text-primary"
                    >
                      Войти
                    </Button>
                    <Button
                      onClick={() => {
                        setAuthMode('register');
                        onRegister();
                        setIsMenuOpen(false);
                      }}
                      className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Регистрация
                    </Button>
                  </div>
                )}
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
};
