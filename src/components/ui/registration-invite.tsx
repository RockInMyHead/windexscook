import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChefHat, Star, Heart, BookOpen, Sparkles } from "lucide-react";

interface RegistrationInviteProps {
  onRegister: () => void;
  onLogin: () => void;
  onSkip: () => void;
}

export const RegistrationInvite = ({ onRegister, onLogin, onSkip }: RegistrationInviteProps) => {
  const benefits = [
    {
      icon: BookOpen,
      title: "Сохраняйте рецепты",
      description: "Создавайте личную коллекцию любимых блюд"
    },
    {
      icon: Star,
      title: "Персональные рекомендации",
      description: "AI изучает ваши предпочтения и предлагает идеальные рецепты"
    },
    {
      icon: Heart,
      title: "Планируйте меню",
      description: "Составляйте планы питания на неделю"
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl bg-gradient-card border-border/50 shadow-glow">
        <CardContent className="p-8">
          <div className="text-center space-y-6">
            {/* Header */}
            <div className="space-y-4">
              <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto">
                <ChefHat className="w-10 h-10 text-primary-foreground" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-foreground">
                  🎉 Рецепт готов!
                </h2>
                <p className="text-lg text-muted-foreground">
                  Хотите сохранить этот рецепт и получить еще больше возможностей?
                </p>
              </div>
            </div>

            {/* Benefits */}
            <div className="grid md:grid-cols-3 gap-4 my-8">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="p-4 bg-secondary/30 rounded-lg text-center space-y-2 hover:bg-secondary/50 transition-colors"
                >
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mx-auto">
                    <benefit.icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">
                    {benefit.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="bg-primary/10 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-center gap-2 text-primary font-semibold">
                <Sparkles className="w-4 h-4" />
                <span>50,000+ поваров уже с нами!</span>
              </div>
              <p className="text-sm text-primary/80">
                Присоединяйтесь к сообществу кулинарных энтузиастов
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={onRegister}
                className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity text-lg py-6"
              >
                <ChefHat className="w-5 h-5 mr-2" />
                Создать аккаунт бесплатно
              </Button>
              
              <Button
                onClick={onLogin}
                variant="secondary"
                className="flex-1 text-lg py-6"
              >
                У меня уже есть аккаунт
              </Button>
            </div>

            <Button
              onClick={onSkip}
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
            >
              Продолжить без регистрации
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};



