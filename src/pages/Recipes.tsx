import React, { useState, useEffect } from 'react';
import { Header } from '@/components/header';
import { AuthModal } from '@/components/ui/auth-modal';
import { RecipeCard } from '@/components/ui/recipe-card';
import { RecipeFormModal } from '@/components/ui/recipe-form-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  Plus, 
  Grid, 
  List,
  Star,
  Heart,
  MessageCircle,
  Clock,
  ChefHat
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { RecipeService } from '@/services/recipeService';
import { Recipe, RecipeFormData, RecipeFilters } from '@/types/recipe';
import { toast } from '@/hooks/use-toast';

const Recipes = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<RecipeFilters>({
    category: 'all',
    difficulty: 'all',
    cookTime: 'all',
    rating: 'all',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const { isAuthenticated, user, login } = useUser();

  useEffect(() => {
    loadRecipes();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [recipes, filters]);

  const loadRecipes = async () => {
    setIsLoading(true);
    try {
      const data = await RecipeService.getRecipes();
      setRecipes(data);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить рецепты',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...recipes];

    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(recipe =>
        recipe.title.toLowerCase().includes(search) ||
        recipe.description.toLowerCase().includes(search) ||
        recipe.ingredients.some(ing => ing.toLowerCase().includes(search))
      );
    }

    if (filters.category && filters.category !== 'all') {
      filtered = filtered.filter(recipe => recipe.category === filters.category);
    }

    if (filters.difficulty && filters.difficulty !== 'all') {
      filtered = filtered.filter(recipe => recipe.difficulty === filters.difficulty);
    }

    if (filters.rating && filters.rating !== 'all') {
      const minRating = parseFloat(filters.rating);
      filtered = filtered.filter(recipe => recipe.rating >= minRating);
    }

    setFilteredRecipes(filtered);
  };

  const handleCreateRecipe = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    setEditingRecipe(null);
    setShowRecipeModal(true);
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setShowRecipeModal(true);
  };

  const handleSaveRecipe = async (recipeData: RecipeFormData) => {
    try {
      if (editingRecipe) {
        await RecipeService.updateRecipe(editingRecipe.id, recipeData);
        toast({
          title: 'Успех',
          description: 'Рецепт обновлен'
        });
      } else {
        await RecipeService.createRecipe(recipeData, user!);
        toast({
          title: 'Успех',
          description: 'Рецепт создан'
        });
      }
      setShowRecipeModal(false);
      setEditingRecipe(null);
      loadRecipes();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить рецепт',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот рецепт?')) {
      try {
        await RecipeService.deleteRecipe(recipeId);
        toast({
          title: 'Успех',
          description: 'Рецепт удален'
        });
        loadRecipes();
      } catch (error) {
        toast({
          title: 'Ошибка',
          description: 'Не удалось удалить рецепт',
          variant: 'destructive'
        });
      }
    }
  };

  const handleLike = async (recipeId: string) => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
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
      setShowAuthModal(true);
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
      setShowAuthModal(true);
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

  const handleView = (recipe: Recipe) => {
    // TODO: Implement recipe view modal or navigate to recipe page
    toast({
      title: 'Просмотр рецепта',
      description: `Открываем рецепт: ${recipe.title}`
    });
  };

  const handleRegister = () => {
    setShowAuthModal(true);
  };

  const handleLogin = () => {
    setShowAuthModal(true);
  };

  const handleAuthSuccess = (userData: { name: string; email: string }) => {
    login(userData);
    setShowAuthModal(false);
    toast({
      title: 'Добро пожаловать!',
      description: `Привет, ${userData.name}!`
    });
  };

  const categories = RecipeService.getCategories();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header onRegister={handleRegister} onLogin={handleLogin} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Загружаем рецепты...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onRegister={handleRegister} onLogin={handleLogin} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Рецепты</h1>
                <p className="text-muted-foreground">
                  Откройте для себя удивительные рецепты от сообщества
                </p>
              </div>
              <Button
                onClick={handleCreateRecipe}
                className="bg-gradient-primary hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить рецепт
              </Button>
            </div>

            {/* Search and Filters */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Поиск рецептов..."
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="pl-10"
                    />
                  </div>

                  {/* Filter Toggle */}
                  <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                    className="lg:hidden"
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Фильтры
                  </Button>

                  {/* View Mode */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setViewMode('grid')}
                    >
                      <Grid className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Filters */}
                {showFilters && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Категория</label>
                        <select
                          value={filters.category}
                          onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                        >
                          {categories.map(category => (
                            <option key={category} value={category === 'Все категории' ? 'all' : category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">Сложность</label>
                        <select
                          value={filters.difficulty}
                          onChange={(e) => setFilters(prev => ({ ...prev, difficulty: e.target.value }))}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                        >
                          <option value="all">Все сложности</option>
                          <option value="Easy">Легко</option>
                          <option value="Medium">Средне</option>
                          <option value="Hard">Сложно</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">Рейтинг</label>
                        <select
                          value={filters.rating}
                          onChange={(e) => setFilters(prev => ({ ...prev, rating: e.target.value }))}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                        >
                          <option value="all">Любой рейтинг</option>
                          <option value="4">4+ звезд</option>
                          <option value="3">3+ звезд</option>
                          <option value="2">2+ звезд</option>
                        </select>
                      </div>

                      <div className="flex items-end">
                        <Button
                          variant="outline"
                          onClick={() => setFilters({
                            category: 'all',
                            difficulty: 'all',
                            cookTime: 'all',
                            rating: 'all',
                            search: ''
                          })}
                          className="w-full"
                        >
                          Сбросить
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 text-center">
                <ChefHat className="w-8 h-8 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold">{recipes.length}</div>
                <div className="text-sm text-muted-foreground">Рецептов</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                <div className="text-2xl font-bold">
                  {recipes.length > 0 ? (recipes.reduce((sum, r) => sum + r.rating, 0) / recipes.length).toFixed(1) : '0'}
                </div>
                <div className="text-sm text-muted-foreground">Средний рейтинг</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Heart className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <div className="text-2xl font-bold">
                  {recipes.reduce((sum, r) => sum + r.likes, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Лайков</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <MessageCircle className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-bold">
                  {recipes.reduce((sum, r) => sum + r.commentsCount, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Комментариев</div>
              </CardContent>
            </Card>
          </div>

          {/* Recipes Grid */}
          {filteredRecipes.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <ChefHat className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {filters.search || filters.category !== 'all' || filters.difficulty !== 'all' 
                    ? 'Рецепты не найдены' 
                    : 'Пока нет рецептов'
                  }
                </h3>
                <p className="text-muted-foreground mb-4">
                  {filters.search || filters.category !== 'all' || filters.difficulty !== 'all'
                    ? 'Попробуйте изменить параметры поиска'
                    : 'Станьте первым, кто поделится своим рецептом!'
                  }
                </p>
                {(!filters.search && filters.category === 'all' && filters.difficulty === 'all') && (
                  <Button onClick={handleCreateRecipe} className="bg-gradient-primary hover:opacity-90">
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить рецепт
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className={`grid gap-6 ${
              viewMode === 'grid' 
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
                : 'grid-cols-1'
            }`}>
              {filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onLike={handleLike}
                  onFavorite={handleFavorite}
                  onRate={handleRate}
                  onView={handleView}
                  onEdit={handleEditRecipe}
                  onDelete={handleDeleteRecipe}
                  currentUserId={user?.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <RecipeFormModal
        isOpen={showRecipeModal}
        onClose={() => {
          setShowRecipeModal(false);
          setEditingRecipe(null);
        }}
        onSubmit={handleSaveRecipe}
        initialData={editingRecipe || undefined}
        title={editingRecipe ? 'Редактировать рецепт' : 'Создать рецепт'}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
};

export default Recipes;
