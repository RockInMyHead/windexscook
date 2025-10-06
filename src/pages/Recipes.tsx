import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/header';
import { AuthModal } from '@/components/ui/auth-modal';
import { RecipeCard } from '@/components/ui/recipe-card';
import { RecipeFormModal } from '@/components/ui/recipe-form-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  Filter, 
  Plus, 
  Grid, 
  List,
  Star,
  Heart,
  MessageCircle,
  ChefHat
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { RecipeService } from '@/services/recipeService';
import { Recipe, RecipeFormData, RecipeFilters } from '@/types/recipe';
import { toast } from '@/hooks/use-toast';

// Constants
const INITIAL_FILTERS: RecipeFilters = {
  category: 'all',
  difficulty: 'all',
  cookTime: 'all',
  rating: 'all',
  search: ''
};

const DIFFICULTY_OPTIONS = [
  { value: 'all', label: 'Все сложности' },
  { value: 'Easy', label: 'Легко' },
  { value: 'Medium', label: 'Средне' },
  { value: 'Hard', label: 'Сложно' }
];

const RATING_OPTIONS = [
  { value: 'all', label: 'Любой рейтинг' },
  { value: '4', label: '4+ звезд' },
  { value: '3', label: '3+ звезд' },
  { value: '2', label: '2+ звезд' }
];

// Component: Loading State
const LoadingState: React.FC = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
      <p className="text-muted-foreground">Загружаем рецепты...</p>
    </div>
  </div>
);

// Component: Stats Card
interface StatsCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ icon, value, label }) => (
  <Card>
    <CardContent className="p-4 text-center">
      {icon}
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </CardContent>
  </Card>
);

// Component: Empty State
interface EmptyStateProps {
  hasFilters: boolean;
  onCreateRecipe: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ hasFilters, onCreateRecipe }) => (
  <Card className="text-center py-12">
    <CardContent>
      <ChefHat className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-foreground mb-2">
        {hasFilters ? 'Рецепты не найдены' : 'Пока нет рецептов'}
      </h3>
      <p className="text-muted-foreground mb-4">
        {hasFilters
          ? 'Попробуйте изменить параметры поиска'
          : 'Станьте первым, кто поделится своим рецептом!'
        }
      </p>
      {!hasFilters && (
        <Button onClick={onCreateRecipe} className="bg-gradient-primary hover:opacity-90">
          <Plus className="w-4 h-4 mr-2" />
          Добавить рецепт
        </Button>
      )}
    </CardContent>
  </Card>
);

// Component: Filter Section
interface FilterSectionProps {
  filters: RecipeFilters;
  categories: string[];
  onFilterChange: (filters: RecipeFilters) => void;
  onResetFilters: () => void;
}

const FilterSection: React.FC<FilterSectionProps> = ({
  filters,
  categories,
  onFilterChange,
  onResetFilters
}) => (
  <div className="mt-4 pt-4 border-t border-border">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Category */}
      <div>
        <label className="text-sm font-medium mb-2 block">Категория</label>
        <select
          value={filters.category}
          onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
        >
          {categories.map(category => (
            <option key={category} value={category === 'Все категории' ? 'all' : category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {/* Difficulty */}
      <div>
        <label className="text-sm font-medium mb-2 block">Сложность</label>
        <select
          value={filters.difficulty}
          onChange={(e) => onFilterChange({ ...filters, difficulty: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
        >
          {DIFFICULTY_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {/* Rating */}
      <div>
        <label className="text-sm font-medium mb-2 block">Рейтинг</label>
        <select
          value={filters.rating}
          onChange={(e) => onFilterChange({ ...filters, rating: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
        >
          {RATING_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {/* Reset Button */}
      <div className="flex items-end">
        <Button variant="outline" onClick={onResetFilters} className="w-full">
          Сбросить
        </Button>
      </div>
    </div>
  </div>
);

// Main Component
const Recipes: React.FC = () => {
  // State
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<RecipeFilters>(INITIAL_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  // Hooks
  const { isAuthenticated, user, login, isAdmin } = useUser();
  const navigate = useNavigate();

  // Memoized values
  const categories = useMemo(() => RecipeService.getCategories(), []);

  const filteredRecipes = useMemo(() => {
    let filtered = [...recipes];

    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(recipe =>
        recipe.title.toLowerCase().includes(search) ||
        recipe.description.toLowerCase().includes(search) ||
        recipe.ingredients.some(ing => ing.toLowerCase().includes(search))
      );
    }

    // Category filter
    if (filters.category && filters.category !== 'all') {
      filtered = filtered.filter(recipe => recipe.category === filters.category);
    }

    // Difficulty filter
    if (filters.difficulty && filters.difficulty !== 'all') {
      filtered = filtered.filter(recipe => recipe.difficulty === filters.difficulty);
    }

    // Rating filter
    if (filters.rating && filters.rating !== 'all') {
      const minRating = parseFloat(filters.rating);
      filtered = filtered.filter(recipe => recipe.rating >= minRating);
    }

    return filtered;
  }, [recipes, filters]);

  const stats = useMemo(() => ({
    totalRecipes: recipes.length,
    averageRating: recipes.length > 0 
      ? (recipes.reduce((sum, r) => sum + r.rating, 0) / recipes.length).toFixed(1) 
      : '0',
    totalLikes: recipes.reduce((sum, r) => sum + r.likes, 0),
    totalComments: recipes.reduce((sum, r) => sum + r.commentsCount, 0)
  }), [recipes]);

  const hasActiveFilters = useMemo(() => 
    filters.search || 
    filters.category !== 'all' || 
    filters.difficulty !== 'all',
    [filters]
  );

  // Load recipes
  const loadRecipes = useCallback(async () => {
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
  }, []);

  // Effects
  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  // Handlers
  const handleCreateRecipe = useCallback(() => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    setEditingRecipe(null);
    setShowRecipeModal(true);
  }, [isAuthenticated]);

  const handleEditRecipe = useCallback((recipe: Recipe) => {
    setEditingRecipe(recipe);
    setShowRecipeModal(true);
  }, []);

  const handleSaveRecipe = useCallback(async (recipeData: RecipeFormData) => {
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
  }, [editingRecipe, user, loadRecipes]);

  const handleDeleteRecipe = useCallback(async (recipeId: string) => {
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
  }, [loadRecipes]);

  const handleLike = useCallback(async (recipeId: string) => {
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
  }, [isAuthenticated, recipes, user, loadRecipes]);

  const handleFavorite = useCallback(async (recipeId: string) => {
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
  }, [isAuthenticated, recipes, user, loadRecipes]);

  const handleRate = useCallback(async (recipeId: string, rating: number) => {
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
  }, [isAuthenticated, user, loadRecipes]);

  const handleView = useCallback((recipe: Recipe) => {
    navigate(`/recipes/${recipe.id}`);
  }, [navigate]);

  const handleAuthSuccess = useCallback((userData: { name: string; email: string }) => {
    login(userData);
    setShowAuthModal(false);
    toast({
      title: 'Добро пожаловать!',
      description: `Привет, ${userData.name}!`
    });
  }, [login]);

  const handleResetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  // Render loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header onRegister={() => setShowAuthModal(true)} onLogin={() => setShowAuthModal(true)} />
        <div className="container mx-auto px-4 py-8">
          <LoadingState />
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="min-h-screen bg-background">
      <Header 
        onRegister={() => setShowAuthModal(true)} 
        onLogin={() => setShowAuthModal(true)} 
      />
      
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
                  <FilterSection
                    filters={filters}
                    categories={categories}
                    onFilterChange={setFilters}
                    onResetFilters={handleResetFilters}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatsCard
              icon={<ChefHat className="w-8 h-8 text-primary mx-auto mb-2" />}
              value={stats.totalRecipes}
              label="Рецептов"
            />
            <StatsCard
              icon={<Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />}
              value={stats.averageRating}
              label="Средний рейтинг"
            />
            <StatsCard
              icon={<Heart className="w-8 h-8 text-red-500 mx-auto mb-2" />}
              value={stats.totalLikes}
              label="Лайков"
            />
            <StatsCard
              icon={<MessageCircle className="w-8 h-8 text-blue-500 mx-auto mb-2" />}
              value={stats.totalComments}
              label="Комментариев"
            />
          </div>

          {/* Recipes Grid */}
          {filteredRecipes.length === 0 ? (
            <EmptyState 
              hasFilters={hasActiveFilters} 
              onCreateRecipe={handleCreateRecipe}
            />
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
                  isAdmin={isAdmin}
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
