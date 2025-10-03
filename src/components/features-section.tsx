import { Sparkles, Brain, Clock, Heart } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Умный AI помощник",
    description: "Передовые алгоритмы машинного обучения создают персонализированные рецепты на основе ваших ингредиентов"
  },
  {
    icon: Clock,
    title: "Мгновенные рецепты",
    description: "Получите идеальный рецепт за секунды - просто укажите что у вас есть в холодильнике"
  },
  {
    icon: Heart,
    title: "Здоровое питание",
    description: "AI учитывает пищевую ценность и предлагает сбалансированные варианты блюд"
  },
  {
    icon: Sparkles,
    title: "Креативные сочетания",
    description: "Откройте неожиданные вкусовые комбинации, о которых вы никогда не думали"
  }
];

export const FeaturesSection = () => {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground drop-shadow-lg">
            Почему выбирают <span className="text-primary drop-shadow-md">Windex</span> кулинара?
          </h2>
          <p className="text-lg text-foreground/90 max-w-2xl mx-auto drop-shadow-md">
            Революционный подход к кулинарии с использованием искусственного интеллекта
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-6 rounded-xl bg-gradient-card border border-border/50 hover:shadow-card transition-all duration-300 hover:-translate-y-1 animate-fade-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4 group-hover:animate-pulse-glow transition-all">
                <feature.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              
              <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};