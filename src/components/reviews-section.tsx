import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";

const reviews = [
  {
    name: "Анна Петрова",
    role: "Домохозяйка",
    avatar: "AP",
    rating: 5,
    text: "Невероятно! <span style=\"color: hsl(150 40% 55%)\">Windexs</span> кулинар превратил остатки в холодильнике в изысканный ужин. Теперь готовлю каждый день с удовольствием!",
    dish: "Рататуй с киноа"
  },
  {
    name: "Михаил Сидоров", 
    role: "Шеф-повар",
    avatar: "МС",
    rating: 5,
    text: "Как профессиональный повар, я впечатлен креативностью AI. Он предложил сочетания, о которых я никогда не думал!",
    dish: "Азиатская фьюжн паста"
  },
  {
    name: "Елена Иванова",
    role: "Мама двоих детей", 
    avatar: "ЕИ",
    rating: 5,
    text: "Спасение для занятых родителей! Быстрые, вкусные и полезные рецепты из того, что есть дома. Дети в восторге!",
    dish: "Овощные котлеты с сюрпризом"
  },
  {
    name: "Дмитрий Козлов",
    role: "Студент",
    avatar: "ДК", 
    rating: 5,
    text: "Экономит время и деньги! Больше не выбрасываю продукты - AI находит применение всему. Готовить стало легко и весело.",
    dish: "Бюджетный боул с нутом"
  }
];

export const ReviewsSection = () => {
  return (
    <section className="py-20 px-4 bg-gradient-to-br from-mint/10 to-sage/10 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-primary rounded-full opacity-20 animate-float"></div>
      <div className="absolute bottom-20 right-16 w-24 h-24 bg-accent/30 rounded-full animate-bounce-slow"></div>
      <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-leaf/20 rounded-full animate-spin-slow"></div>
      
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="text-center mb-16 space-y-4 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium animate-pulse-glow">
            <Star className="w-4 h-4 fill-current" />
            4.9/5 • 10,000+ отзывов
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold text-foreground drop-shadow-lg">
            Что говорят наши пользователи
          </h2>
          <p className="text-lg text-foreground/90 max-w-2xl mx-auto drop-shadow-md">
            Тысячи людей уже открыли для себя магию <span className="text-primary drop-shadow-md">Windexs</span> кулинарии
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {reviews.map((review, index) => (
            <Card 
              key={index}
              className="group hover:shadow-card transition-all duration-500 hover:-translate-y-2 bg-gradient-card border-border/50 animate-slide-in-left relative overflow-hidden"
              style={{ animationDelay: `${index * 0.2}s` }}
            >
              {/* Quote decoration */}
              <div className="absolute top-4 right-4 text-primary/20 group-hover:text-primary/40 transition-colors">
                <Quote className="w-6 h-6" />
              </div>
              
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                    <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm font-semibold">
                      {review.avatar}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                      {review.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">{review.role}</p>
                  </div>
                </div>

                <div className="flex gap-1">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star 
                      key={i} 
                      className="w-4 h-4 fill-primary text-primary group-hover:animate-wiggle transition-all" 
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>

                <blockquote className="text-sm text-muted-foreground leading-relaxed italic group-hover:text-foreground transition-colors">
                  "{review.text}"
                </blockquote>

                <div className="pt-2 border-t border-border/50">
                  <div className="text-xs text-primary font-medium">
                    Любимое блюдо: {review.dish}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12 animate-fade-up" style={{ animationDelay: "0.8s" }}>
          <div className="inline-flex items-center gap-4 px-6 py-3 bg-card rounded-full shadow-soft border border-border/50">
            <div className="flex -space-x-2">
              {["👨‍🍳", "👩‍🍳", "🧑‍🍳", "👨‍🍳"].map((emoji, i) => (
                <div 
                  key={i}
                  className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-sm animate-bounce-slow border-2 border-background"
                  style={{ animationDelay: `${i * 0.3}s` }}
                >
                  {emoji}
                </div>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              Присоединяйтесь к 50,000+ счастливых поваров!
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};