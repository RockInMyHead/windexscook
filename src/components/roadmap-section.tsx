import { CheckCircle, ArrowRight, Sparkles, ChefHat, Brain, Utensils } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const roadmapSteps = [
  {
    icon: Utensils,
    title: "Добавьте ингредиенты",
    description: "Просто введите то, что есть в вашем холодильнике или кладовке",
    details: "Система распознает даже неточные названия и предложит варианты",
    color: "bg-leaf"
  },
  {
    icon: Brain,
    title: "AI анализирует возможности", 
    description: "Искусственный интеллект обрабатывает ваши ингредиенты",
    details: "Учитывает вкусовые сочетания, время готовки и сложность",
    color: "bg-sage"
  },
  {
    icon: Sparkles,
    title: "Генерация уникального рецепта",
    description: "AI создает персональный рецепт специально для вас",
    details: "Каждый рецепт уникален и адаптирован под ваши ингредиенты",
    color: "bg-mint"
  },
  {
    icon: ChefHat,
    title: "Готовьте и наслаждайтесь!",
    description: "Следуйте пошаговым инструкциям и создавайте кулинарные шедевры",
    details: "Получите детальное описание процесса с советами и лайфхаками",
    color: "bg-primary"
  }
];

export const RoadmapSection = () => {
  return (
    <section className="py-20 px-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-1/4 w-40 h-40 bg-gradient-primary rounded-full animate-pulse-glow opacity-20"></div>
        <div className="absolute bottom-32 right-1/3 w-32 h-32 bg-accent/40 rounded-full animate-float"></div>
        <div className="absolute top-1/2 right-20 w-24 h-24 bg-mint/40 rounded-full animate-bounce-slow"></div>
      </div>

      <div className="container mx-auto max-w-4xl relative z-10">
        <div className="text-center mb-16 space-y-4 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium animate-glow-pulse">
            <Sparkles className="w-4 h-4" />
            Как это работает
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold text-foreground drop-shadow-lg">
            От ингредиентов до шедевра
            <br />
            <span className="text-2xl md:text-3xl text-primary drop-shadow-md">за 4 простых шага</span>
          </h2>
          
          <p className="text-lg text-foreground/90 max-w-2xl mx-auto drop-shadow-md">
            Магия <span className="text-primary drop-shadow-md">Windexs</span> кулинарии: превращаем обычные продукты в необыкновенные блюда
          </p>
        </div>

        <div className="space-y-8">
          {roadmapSteps.map((step, index) => (
            <div 
              key={index}
              className="group animate-slide-in-left"
              style={{ animationDelay: `${index * 0.3}s` }}
            >
              <Card className="relative overflow-hidden border-border/50 hover:shadow-card transition-all duration-500 hover:-translate-y-1 bg-gradient-card">
                {/* Step number */}
                <div className="absolute top-6 left-6 w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm animate-scale-pulse">
                  {index + 1}
                </div>

                <CardContent className="p-8 pl-20">
                  <div className="flex items-start gap-6">
                    {/* Icon */}
                    <div className={`w-16 h-16 ${step.color} rounded-xl flex items-center justify-center group-hover:animate-wiggle transition-all shadow-soft`}>
                      <step.icon className="w-8 h-8 text-background" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-3">
                      <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                        {step.title}
                      </h3>
                      
                      <p className="text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                      
                      <div className="text-sm text-primary/80 italic group-hover:text-primary transition-colors">
                        💡 {step.details}
                      </div>
                    </div>

                    {/* Arrow for non-last items */}
                    {index < roadmapSteps.length - 1 && (
                      <div className="hidden md:flex items-center justify-center w-12 h-12 text-primary/60 group-hover:text-primary transition-colors group-hover:animate-bounce-slow">
                        <ArrowRight className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </CardContent>

                {/* Completion check for final step */}
                {index === roadmapSteps.length - 1 && (
                  <div className="absolute top-6 right-6 text-primary animate-pulse-glow">
                    <CheckCircle className="w-6 h-6 fill-current" />
                  </div>
                )}
              </Card>

              {/* Mobile arrow */}
              {index < roadmapSteps.length - 1 && (
                <div className="md:hidden flex justify-center py-4">
                  <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground animate-bounce-slow">
                    <ArrowRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Call to action */}
        <div className="text-center mt-16 animate-fade-up" style={{ animationDelay: "1.2s" }}>
          <div className="p-8 bg-gradient-hero rounded-2xl shadow-glow border border-border/50 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-background mb-4">
              Готовы начать кулинарное приключение?
            </h3>
            <p className="text-background/90 mb-6">
              Присоединяйтесь к тысячам поваров, которые уже открыли магию <span className="text-primary">Windexs</span> кулинарии
            </p>
            <div className="flex items-center justify-center gap-3 text-background/80 text-sm">
              <CheckCircle className="w-5 h-5 fill-current" />
              <span>Бесплатно</span>
              <CheckCircle className="w-5 h-5 fill-current" />
              <span>Без регистрации</span>
              <CheckCircle className="w-5 h-5 fill-current" />
              <span>Мгновенный результат</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};