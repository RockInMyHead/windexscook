import { RecipeCard } from "@/components/ui/recipe-card";

const sampleRecipes = [
  {
    title: "Паста Карбонара с грибами",
    description: "Классическая итальянская паста в сливочном соусе с добавлением ароматных грибов",
    cookTime: "25 мин",
    servings: 4,
    difficulty: "Medium" as const,
    ingredients: ["спагетти", "бекон", "яйца", "пармезан", "шампиньоны", "сливки"]
  },
  {
    title: "Овощной салат с авокадо",
    description: "Свежий и питательный салат с сезонными овощами и кремовым авокадо",
    cookTime: "15 мин",
    servings: 2,
    difficulty: "Easy" as const,
    ingredients: ["авокадо", "помидоры", "огурцы", "руккола", "оливковое масло", "лимон"]
  },
  {
    title: "Тайский зеленый карри",
    description: "Ароматное и острое блюдо с кокосовым молоком и свежими специями",
    cookTime: "40 мин",
    servings: 6,
    difficulty: "Hard" as const,
    ingredients: ["курица", "кокосовое молоко", "зеленый карри", "баклажаны", "базилик", "лайм"]
  },
  {
    title: "Банановые панкейки",
    description: "Пушистые панкейки с натуральной сладостью банана - идеальный завтрак",
    cookTime: "20 мин",
    servings: 3,
    difficulty: "Easy" as const,
    ingredients: ["бананы", "яйца", "мука", "молоко", "ванилин", "мед"]
  }
];

export const RecipesSection = () => {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Популярные рецепты от AI
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Посмотрите какие удивительные блюда уже создали наши пользователи
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {sampleRecipes.map((recipe, index) => (
            <div 
              key={index}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <RecipeCard {...recipe} />
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            Хотите попробовать создать свой уникальный рецепт?
          </p>
          <button className="text-primary font-medium hover:underline transition-colors">
            Начать готовить с AI →
          </button>
        </div>
      </div>
    </section>
  );
};