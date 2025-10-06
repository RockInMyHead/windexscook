import React, { useState, useEffect } from "react";
import { RecipeCard } from "@/components/ui/recipe-card";
import { Recipe } from "@/types/recipe";
import { RecipeService } from "@/services/recipeService";
import { useUser } from "@/contexts/UserContext";
import { useNavigate } from 'react-router-dom';
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ChefHat, 
  Star, 
  Heart, 
  MessageCircle,
  TrendingUp,
  Users
} from "lucide-react";

export const RecipesSection = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAuthenticated } = useUser();

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const data = await RecipeService.getRecipes();
      // Показываем только первые 4 рецепта для секции, если они есть
      setRecipes(data.length > 0 ? data.slice(0, 4) : []);
    } catch (error) {
      console.error('Error loading recipes:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить рецепты',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (recipeId: string) => {
    if (!isAuthenticated) {
      toast({
        title: 'Войдите в аккаунт',
        description: 'Для лайков необходимо войти в аккаунт',
        variant: 'destructive'
      });
      return;
    }

    try {
      const recipe = recipes.find(r => r.id === recipeId);
      if (recipe?.isLiked) {
        await RecipeService.unlikeRecipe(recipeId, user!.id);
      } else {
        await RecipeService.likeRecipe(recipeId, user!.id);
      }
      loadRecipes();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось выполнить действие',
        variant: 'destructive'
      });
    }
  };

  const handleFavorite = async (recipeId: string) => {
    if (!isAuthenticated) {
      toast({
        title: 'Войдите в аккаунт',
        description: 'Для добавления в избранное необходимо войти в аккаунт',
        variant: 'destructive'
      });
      return;
    }

    try {
      const recipe = recipes.find(r => r.id === recipeId);
      if (recipe?.isFavorited) {
        await RecipeService.unfavoriteRecipe(recipeId, user!.id);
      } else {
        await RecipeService.favoriteRecipe(recipeId, user!.id);
      }
      loadRecipes();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось выполнить действие',
        variant: 'destructive'
      });
    }
  };

  const handleRate = async (recipeId: string, rating: number) => {
    if (!isAuthenticated) {
      toast({
        title: 'Войдите в аккаунт',
        description: 'Для оценки рецептов необходимо войти в аккаунт',
        variant: 'destructive'
      });
      return;
    }

    try {
      await RecipeService.rateRecipe(recipeId, user!.id, rating);
      loadRecipes();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось оценить рецепт',
        variant: 'destructive'
      });
    }
  };

  const navigate = useNavigate();
  const handleView = (recipe: Recipe) => {
    navigate(`/recipes/${recipe.id}`);
  };

  const handleGetStarted = () => {
    // Прокрутка к секции с ингредиентами
    const element = document.getElementById("ingredient-input");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (isLoading) {
    return (
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Популярные рецепты от AI
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Загружаем лучшие рецепты от нашего сообщества
            </p>
          </div>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 sm:py-16 md:py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12 sm:mb-16 space-y-3 sm:space-y-4">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
            Популярные рецепты от AI
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
            Посмотрите какие удивительные блюда уже создали наши пользователи
          </p>
        </div>

        {/* Статистика */}
        {recipes.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-12">
            <Card>
              <CardContent className="p-3 sm:p-4 text-center">
                <ChefHat className="w-6 h-6 sm:w-8 sm:h-8 text-primary mx-auto mb-1 sm:mb-2" />
                <div className="text-lg sm:text-2xl font-bold">{recipes.length}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Рецептов</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4 text-center">
                <Star className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 mx-auto mb-1 sm:mb-2" />
                <div className="text-lg sm:text-2xl font-bold">
                  {recipes.length > 0 ? (recipes.reduce((sum, r) => sum + r.rating, 0) / recipes.length).toFixed(1) : '0'}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Средний рейтинг</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4 text-center">
                <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 mx-auto mb-1 sm:mb-2" />
                <div className="text-lg sm:text-2xl font-bold">
                  {recipes.reduce((sum, r) => sum + r.likes, 0)}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Лайков</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4 text-center">
                <MessageCircle className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 mx-auto mb-1 sm:mb-2" />
                <div className="text-lg sm:text-2xl font-bold">
                  {recipes.reduce((sum, r) => sum + r.commentsCount, 0)}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Комментариев</div>
              </CardContent>
            </Card>
          </div>
        )}

        {recipes.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              <p className="text-lg">Пока нет рецептов</p>
              <p className="text-sm">Станьте первым, кто поделится своим рецептом!</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {recipes.map((recipe, index) => (
              <div 
                key={recipe.id}
                style={{ 
                  animationDelay: `${index * 0.1}s`,
                  opacity: 0
                }}
                className="animate-fade-in hover:transform hover:scale-105 transition-all duration-300"
              >
                <RecipeCard
                  recipe={recipe}
                  onLike={() => handleLike(recipe.id)}
                  onFavorite={() => handleFavorite(recipe.id)}
                  onRate={(rating) => handleRate(recipe.id, rating)}
                  onView={() => handleView(recipe)}
                />
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-8 sm:mt-12">
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center justify-center mb-3 sm:mb-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-primary rounded-full flex items-center justify-center">
                  <ChefHat className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
                </div>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                Создайте свой уникальный рецепт
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                Используйте AI для создания персональных рецептов на основе ваших ингредиентов и предпочтений
              </p>
              <button 
                onClick={handleGetStarted}
                className="bg-gradient-primary hover:opacity-90 transition-opacity text-primary-foreground px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-sm sm:text-base"
              >
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 inline mr-2" />
                Начать готовить с AI
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};