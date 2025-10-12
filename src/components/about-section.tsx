import { Sparkles, Zap, Target, Globe, Users, TrendingUp } from "lucide-react";

const stats = [
  {
    icon: Users,
    number: "50,000+",
    label: "Активных пользователей",
    description: "Растущее сообщество кулинарных энтузиастов"
  },
  {
    icon: Sparkles,
    number: "1M+", 
    label: "Созданных рецептов",
    description: "Уникальные блюда, созданные с помощью AI"
  },
  {
    icon: TrendingUp,
    number: "98%",
    label: "Довольных пользователей",
    description: "Высокий рейтинг удовлетворенности"
  },
  {
    icon: Globe,
    number: "15+",
    label: "Кухонь мира",
    description: "Рецепты различных культур и традиций"
  }
];

const benefits = [
  {
    icon: Zap,
    title: "Мгновенные результаты",
    description: "Получите готовый рецепт за считанные секунды благодаря продвинутым AI алгоритмам",
    highlight: "⚡ Быстрее чем поиск в интернете"
  },
  {
    icon: Target,
    title: "Персонализация",
    description: "AI учитывает ваши предпочтения, диетические ограничения и доступные ингредиенты",
    highlight: "🎯 Рецепты специально для вас"
  },
  {
    icon: Sparkles,
    title: "Бесконечное вдохновение",
    description: "Никогда не закончатся идеи для новых блюд - AI генерирует миллионы уникальных комбинаций",
    highlight: "✨ Каждый раз что-то новое"
  }
];

export const AboutSection = () => {
  return (
    <section className="py-12 sm:py-16 md:py-20 px-4 bg-gradient-to-br from-sage/5 to-mint/10 relative overflow-hidden">
      {/* Decorative floating elements */}
      <div className="absolute top-16 right-20 w-20 h-20 bg-gradient-primary rounded-full opacity-20 animate-float"></div>
      <div className="absolute bottom-24 left-16 w-32 h-32 bg-accent/20 rounded-full animate-spin-slow"></div>
      <div className="absolute top-1/3 left-1/3 w-4 h-4 bg-primary rounded-full animate-bounce-slow"></div>
      <div className="absolute bottom-1/3 right-1/4 w-6 h-6 bg-mint rounded-full animate-wiggle"></div>

      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16 space-y-4 sm:space-y-6 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-primary/10 rounded-full text-primary font-medium animate-glow-pulse text-sm sm:text-base">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            О платформе <span className="text-primary">Windexs</span> кулинар
          </div>
          
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight drop-shadow-lg">
            Революция в мире
            <br />
            <span className="text-primary drop-shadow-md">домашней кулинарии</span>
          </h2>
          
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-foreground/90 max-w-3xl mx-auto leading-relaxed drop-shadow-md">
            Мы создали первого в мире AI помощника, который понимает кулинарию как искусство. 
            Наша цель — сделать готовку доступной, вдохновляющей и бесконечно творческой для каждого.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12 sm:mb-16 lg:mb-20">
          {stats.map((stat, index) => (
            <div 
              key={index}
              className="text-center p-4 sm:p-6 bg-gradient-card rounded-xl border border-border/50 hover:shadow-card transition-all duration-300 hover:-translate-y-1 animate-slide-in-left group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-primary rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:animate-scale-pulse">
                <stat.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
              </div>
              
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-primary mb-1 group-hover:animate-glow-pulse">
                {stat.number}
              </div>
              
              <div className="text-xs sm:text-sm font-semibold text-foreground mb-2">
                {stat.label}
              </div>
              
              <div className="text-xs sm:text-xs text-muted-foreground">
                {stat.description}
              </div>
            </div>
          ))}
        </div>

        {/* Benefits */}
        <div className="space-y-6 sm:space-y-8">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-center text-foreground mb-8 sm:mb-12 animate-fade-up px-4">
            Почему <span className="text-primary">Windexs</span> кулинар меняет правила игры
          </h3>

          {benefits.map((benefit, index) => (
            <div 
              key={index}
              className="group animate-slide-in-right"
              style={{ animationDelay: `${index * 0.2}s` }}
            >
              <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-8 bg-gradient-card rounded-2xl border border-border/50 hover:shadow-card transition-all duration-500 hover:-translate-y-2">
                <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-primary rounded-xl flex items-center justify-center shrink-0 group-hover:animate-wiggle shadow-soft mx-auto sm:mx-0">
                    <benefit.icon className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-primary-foreground" />
                  </div>
                  
                  <div className="flex-1 space-y-2 sm:space-y-3 text-center sm:text-left">
                    <h4 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                      {benefit.title}
                    </h4>
                    
                    <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
                      {benefit.description}
                    </p>
                    
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 rounded-full text-primary text-xs sm:text-sm font-medium animate-pulse-glow">
                      {benefit.highlight}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mission Statement */}
        <div className="mt-12 sm:mt-16 md:mt-20 text-center animate-fade-up" style={{ animationDelay: "0.6s" }}>
          <div className="max-w-4xl mx-auto p-6 sm:p-8 bg-gradient-hero rounded-2xl shadow-glow text-background relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-4 left-4 w-8 h-8 border-2 border-background rounded-full animate-spin-slow"></div>
              <div className="absolute bottom-4 right-4 w-6 h-6 bg-background rounded-full animate-bounce-slow"></div>
              <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-background/50 rounded-full animate-float"></div>
            </div>
            
            <div className="relative z-10 space-y-3 sm:space-y-4">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-black">
                Наша миссия
              </h3>
              
              <p className="text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed opacity-95 px-2 text-black">
                Мы верим, что каждый человек способен создавать кулинарные шедевры. 
                <span className="text-primary">Windexs</span> кулинар — это мост между вашими ингредиентами и безграничными возможностями кулинарии. 
                Мы делаем готовку не просто процессом, а увлекательным творческим путешествием.
              </p>
              
              <div className="text-black/80 text-xs sm:text-sm italic">
                "Искусственный интеллект + человеческое творчество = кулинарная магия"
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};