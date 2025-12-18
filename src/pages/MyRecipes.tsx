import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  X,
  Sparkles,
  Loader2,
  Search,
  Filter,
  Clock,
  Users,
  ChefHat,
  Heart,
  BookOpen,
  Trash2,
  Eye,
  Camera,
  Globe,
  Save
} from "lucide-react";
import { OpenAIService, Recipe } from "@/services/openai";
import { CuisineSelector } from "@/components/ui/cuisine-selector";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/ui/auth-modal";
import { PremiumModal } from "@/components/ui/premium-modal";
// import { ProductSelector } from "@/components/ui/product-selector";
import { useUser } from "@/contexts/UserContext";
import { toast } from "@/hooks/use-toast";
import { useRef } from 'react';
import { WORLD_CUISINES } from "@/types/cuisine";
import { AudioUtils } from "@/lib/audio-utils";

interface SavedRecipe extends Recipe {
  id: string;
  savedAt: string;
  userId: string;
}

export const MyRecipes = () => {
  const [currentIngredient, setCurrentIngredient] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [selectedCuisine, setSelectedCuisine] = useState<string>("");
  const [isAILoading, setIsAILoading] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<Recipe | null>(null);
  const [recipeText, setRecipeText] = useState<string>('');
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [filterCuisine, setFilterCuisine] = useState<string>("all");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [premiumFeature, setPremiumFeature] = useState<string>('');
  // removed local product selector state
  const { isAuthenticated, user, hasPremiumAccess, login } = useUser();
  
  // Handler to save generated recipe to collection
  const handleSaveGeneratedRecipe = useCallback(async (recipeToSave: Recipe) => {
    if (!user) {
      toast({
        title: 'Требуется авторизация',
        description: 'Войдите в аккаунт, чтобы сохранять рецепты',
        variant: 'destructive'
      });
      return;
    }

    try {
      // user.id is already a string from UserContext
      const authorId = parseInt(user.id, 10);

      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: recipeToSave.title,
          description: recipeToSave.description,
          ingredients: recipeToSave.ingredients,
          instructions: recipeToSave.instructions,
          cookTime: recipeToSave.cookTime,
          servings: recipeToSave.servings,
          difficulty: recipeToSave.difficulty,
          cuisine: recipeToSave.cuisine,
          tips: recipeToSave.tips,
          image: recipeToSave.image,
          authorId: authorId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save recipe');
      }

      const result = await response.json();
      console.log('✅ Recipe saved to database:', result);

      // Обновляем локальный state
      const newSaved: SavedRecipe = {
        ...recipeToSave,
        id: result.id.toString(),
        savedAt: new Date().toISOString(),
        userId: user.id
      };
      setSavedRecipes(prev => [newSaved, ...prev]);

      // Очищаем сгенерированный рецепт
      setGeneratedRecipe(null);

      // Удаляем старые данные из localStorage для этого пользователя (очистка)
      try {
        const allSaved = JSON.parse(localStorage.getItem('saved-recipes') || '[]');
        const filteredSaved = allSaved.filter((recipe: SavedRecipe) => recipe.userId !== user.id);
        localStorage.setItem('saved-recipes', JSON.stringify(filteredSaved));
      } catch (error) {
        console.warn('⚠️ Failed to clean localStorage:', error);
      }

      toast({
        title: '✅ Сохранено',
        description: 'Рецепт добавлен в вашу коллекцию'
      });
    } catch (error) {
      console.error('❌ Error saving recipe:', error);
      toast({
        title: 'Ошибка сохранения',
        description: 'Не удалось сохранить рецепт. Попробуйте еще раз.',
        variant: 'destructive'
      });
    }
  }, [user]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Загружаем сохраненные рецепты из базы данных при монтировании компонента
  useEffect(() => {
    const loadUserRecipes = async () => {
      if (isAuthenticated && user) {
        try {
          const userId = typeof user.id === 'string' ? user.id : user.id.toString();
          const response = await fetch(`/api/recipes/user/${userId}`);

          if (response.ok) {
            const dbRecipes = await response.json();

            // Преобразуем рецепты из БД в формат SavedRecipe
            const savedRecipes: SavedRecipe[] = dbRecipes.map((recipe: any) => ({
              ...recipe,
              id: recipe.id.toString(),
              savedAt: recipe.created_at || new Date().toISOString(),
              userId: user.id,
              // Парсим JSON поля
              ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : JSON.parse(recipe.ingredients || '[]'),
              instructions: Array.isArray(recipe.instructions) ? recipe.instructions : JSON.parse(recipe.instructions || '[]')
            }));

            setSavedRecipes(savedRecipes);
          } else {
            console.warn('⚠️ Failed to load recipes from database, falling back to localStorage');
            // Fallback to localStorage if API fails
            const saved = JSON.parse(localStorage.getItem('saved-recipes') || '[]');
            const userRecipes = saved.filter((recipe: SavedRecipe) => recipe.userId === user.id);
            setSavedRecipes(userRecipes);
          }
        } catch (error) {
          console.error('❌ Error loading recipes from database:', error);
          // Fallback to localStorage
          const saved = JSON.parse(localStorage.getItem('saved-recipes') || '[]');
          const userRecipes = saved.filter((recipe: SavedRecipe) => recipe.userId === user.id);
          setSavedRecipes(userRecipes);
        }
      } else {
        // Если пользователь не авторизован, очищаем рецепты
        setSavedRecipes([]);
      }
    };

    loadUserRecipes();
  }, [isAuthenticated, user]);

  const addIngredient = () => {
    if (currentIngredient.trim() && !ingredients.includes(currentIngredient.trim())) {
      setIngredients([...ingredients, currentIngredient.trim()]);
      setCurrentIngredient("");
    }
  };

  const removeIngredient = (ingredient: string) => {
    setIngredients(ingredients.filter(i => i !== ingredient));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addIngredient();
    }
  };

  const handleGenerateRecipe = async () => {
    if (!hasPremiumAccess) {
      setPremiumFeature('recipe');
      setShowPremiumModal(true);
      return;
    }

    if (ingredients.length === 0) {
      toast({
        title: "Добавьте ингредиенты",
        description: "Пожалуйста, добавьте хотя бы один ингредиент для создания рецепта",
        variant: "destructive",
      });
      return;
    }

    setIsAILoading(true);
    try {
      const recipe = await OpenAIService.generateRecipe(ingredients, user?.healthProfile, selectedCuisine, false, true);
      setGeneratedRecipe(recipe);

      // Формируем текстовое описание рецепта как в чате
      let text = `Отлично! Я подготовил рецепт "${recipe.title}". ${recipe.description}\n\n`;

      recipe.instructions.forEach((instruction: string, index: number) => {
        // Вставляем изображение перед каждым шагом, если оно есть
        if (recipe.instructionImages && recipe.instructionImages[index]) {
          text += `![Шаг ${index + 1}](${recipe.instructionImages[index]})\n\n`;
        }
        text += `**Шаг ${index + 1}:** ${instruction}\n\n`;
      });

      if (recipe.tips) {
        text += `**Полезные советы:** ${recipe.tips}`;
      }

      setRecipeText(text);

      const cuisineName = selectedCuisine ? WORLD_CUISINES.find(c => c.id === selectedCuisine)?.name : '';
      toast({
        title: "🎉 Рецепт готов!",
        description: `AI создал ${cuisineName ? cuisineName.toLowerCase() : 'уникальный'} рецепт "${recipe.title}" из ваших ингредиентов`,
      });
    } catch (error) {
      console.error('Error generating recipe:', error);
      toast({
        title: "Ошибка генерации",
        description: error instanceof Error ? error.message : "Не удалось создать рецепт. Попробуйте еще раз.",
        variant: "destructive",
      });
    } finally {
      setIsAILoading(false);
    }
  };

  const handleSaveRecipe = (recipe: Recipe) => {
    if (!isAuthenticated || !user) return;

    const recipeToSave: SavedRecipe = {
      ...recipe,
      id: Date.now().toString(),
      savedAt: new Date().toISOString(),
      userId: user.email
    };
    
    const updatedRecipes = [...savedRecipes, recipeToSave];
    setSavedRecipes(updatedRecipes);
    localStorage.setItem('saved-recipes', JSON.stringify(updatedRecipes));
    
    toast({
      title: "Рецепт сохранен!",
      description: `"${recipe.title}" добавлен в вашу коллекцию`,
    });
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    try {
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Удаляем из локального state
        const updatedRecipes = savedRecipes.filter(recipe => recipe.id !== recipeId);
        setSavedRecipes(updatedRecipes);

        toast({
          title: "✅ Рецепт удален",
          description: "Рецепт был удален из вашей коллекции",
        });
      } else {
        throw new Error('Failed to delete recipe from database');
      }
    } catch (error) {
      console.error('❌ Error deleting recipe:', error);
      toast({
        title: "Ошибка удаления",
        description: "Не удалось удалить рецепт. Попробуйте еще раз.",
        variant: "destructive"
      });
    }
  };

  const handleCloseRecipe = () => {
    setGeneratedRecipe(null);
    setRecipeText('');
  };

  const handleGenerateNew = () => {
    setGeneratedRecipe(null);
    setRecipeText('');
    setIngredients([]);
  };

  const handleRegister = () => {
    setAuthMode('register');
    setShowAuthModal(true);
  };

  const handleLogin = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  // restore handleImageUpload as originally
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!hasPremiumAccess) {
      setPremiumFeature('image');
      setShowPremiumModal(true);
      return;
    }

    setIsAILoading(true);
    try {
      const recognizedIngredients = await OpenAIService.recognizeIngredientsFromImage(file);
      if (recognizedIngredients.length > 0) {
        setIngredients(prev => Array.from(new Set([...prev, ...recognizedIngredients])));
        toast({
          title: '🎉 Продукты распознаны!',
          description: `Найдено ${recognizedIngredients.length} продуктов: ${recognizedIngredients.slice(0,3).join(', ')}...`
        });
      } else {
        toast({ title: 'Продукты не найдены', description: 'AI не распознал продукты на фото', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Ошибка распознавания', description: err instanceof Error ? err.message : 'Ошибка AI', variant: 'destructive' });
    } finally {
      setIsAILoading(false);
    }
  };

  // Фильтрация рецептов
  const filteredRecipes = savedRecipes.filter(recipe => {
    const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         recipe.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         recipe.ingredients.some(ing => ing.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesDifficulty = filterDifficulty === "all" || recipe.difficulty.toLowerCase() === filterDifficulty.toLowerCase();
    const matchesCuisine = filterCuisine === "all" || recipe.cuisine === filterCuisine;
    
    return matchesSearch && matchesDifficulty && matchesCuisine;
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Войдите в аккаунт</h2>
            <p className="text-muted-foreground mb-4">
              Чтобы сохранять и просматривать свои рецепты, необходимо войти в аккаунт
            </p>
            <Button className="bg-gradient-primary hover:opacity-90 transition-opacity">
              Войти
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onRegister={handleRegister} onLogin={handleLogin} />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Мои рецепты</h1>
            <p className="text-muted-foreground">
              Создавайте новые рецепты с помощью AI и управляйте своей коллекцией
            </p>
          </div>

          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Создать рецепт</TabsTrigger>
              <TabsTrigger value="saved">Моя коллекция ({savedRecipes.length})</TabsTrigger>
            </TabsList>

            {/* Create Recipe Tab */}
            <TabsContent value="create" className="space-y-6">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Создать новый рецепт
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Добавьте ингредиенты, и AI создаст для вас уникальный рецепт
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Cuisine Selection */}
                  <CuisineSelector
                    selectedCuisine={selectedCuisine}
                    onCuisineSelect={setSelectedCuisine}
                  />

                  {/* Ingredient Input and Quick Select */}
                  <div className="space-y-4">
                    <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleImageUpload} />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-2 bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 border-primary/30"
                    >
                      <Camera className="w-4 h-4" />
                      {isAILoading ? 'AI распознает продукты...' : '📸 Сфотографировать продукты'}
                    </Button>
                    <div className="flex gap-2">
                      <Input
                        value={currentIngredient}
                        onChange={(e) => setCurrentIngredient(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Введите ингредиент..."
                        className="flex-1"
                      />
                      <Button 
                        onClick={addIngredient}
                        variant="secondary"
                        size="icon"
                        className="shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>

                    {ingredients.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-foreground">Ваши ингредиенты (AI будет использовать только их):</h4>
                        <div className="flex flex-wrap gap-2">
                          {ingredients.map((ingredient) => (
                            <Badge
                              key={ingredient}
                              variant="secondary"
                              className="px-3 py-1 bg-secondary/80 text-secondary-foreground hover:bg-secondary group cursor-pointer transition-colors"
                              onClick={() => removeIngredient(ingredient)}
                            >
                              {ingredient}
                              <X className="w-3 h-3 ml-1 opacity-60 group-hover:opacity-100 transition-opacity" />
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          💡 AI создаст рецепт только из этих ингредиентов + базовые специи (соль, перец, масло)
                        </p>
                      </div>
                    )}

                    <Button 
                      onClick={handleGenerateRecipe}
                      disabled={isAILoading || ingredients.length === 0}
                      className="w-full bg-gradient-primary hover:opacity-90 transition-opacity disabled:opacity-50"
                      size="lg"
                    >
                      {isAILoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          AI создает рецепт...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Создать рецепт с AI
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Generated Recipe Display */}
              {recipeText && (
                <Card className="bg-gradient-card border-border/50 mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ChefHat className="w-5 h-5 text-primary" />
                      Сгенерированный рецепт
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {recipeText}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t">
                      <Button
                        onClick={handleSaveGeneratedRecipe}
                        className="bg-gradient-primary hover:opacity-90 transition-opacity flex items-center gap-2"
                        size="sm"
                      >
                        <Save className="h-4 w-4" />
                        Сохранить рецепт
                      </Button>
                      <Button
                        onClick={handleGenerateNew}
                        variant="outline"
                        className="flex items-center gap-2"
                        size="sm"
                      >
                        <Sparkles className="h-4 w-4" />
                        Создать новый
                      </Button>
                      <Button
                        onClick={handleCloseRecipe}
                        variant="ghost"
                        className="flex items-center gap-2"
                        size="sm"
                      >
                        <X className="h-4 w-4" />
                        Закрыть
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Saved Recipes Tab */}
            <TabsContent value="saved" className="space-y-6">
              {/* Search and Filter */}
              <Card className="bg-gradient-card border-border/50">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Поиск по рецептам..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      <select
                        value={filterDifficulty}
                        onChange={(e) => setFilterDifficulty(e.target.value)}
                        className="px-3 py-2 border border-border rounded-md bg-background text-foreground min-w-[140px] flex-shrink-0"
                      >
                        <option value="all">Все сложности</option>
                        <option value="easy">Легко</option>
                        <option value="medium">Средне</option>
                        <option value="hard">Сложно</option>
                      </select>
                      <select
                        value={filterCuisine}
                        onChange={(e) => setFilterCuisine(e.target.value)}
                        className="px-3 py-2 border border-border rounded-md bg-background text-foreground min-w-[180px] flex-shrink-0"
                      >
                        <option value="all">Все кухни</option>
                        {WORLD_CUISINES.map((cuisine) => (
                          <option key={cuisine.id} value={cuisine.id}>
                            {cuisine.flag} {cuisine.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recipes Grid */}
              {filteredRecipes.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {savedRecipes.length === 0 ? "Нет сохраненных рецептов" : "Рецепты не найдены"}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {savedRecipes.length === 0 
                        ? "Создайте свой первый рецепт с помощью AI" 
                        : "Попробуйте изменить параметры поиска"
                      }
                    </p>
                    {savedRecipes.length === 0 && (
                      <Button 
                        onClick={() => document.querySelector('[value="create"]')?.click()}
                        className="bg-gradient-primary hover:opacity-90 transition-opacity"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Создать рецепт
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredRecipes.map((recipe) => (
                    <Card key={recipe.id} className="group hover:shadow-card transition-all duration-300 hover:-translate-y-1 bg-gradient-card border-border/50 h-full flex flex-col">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base sm:text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1 min-w-0">
                            {recipe.title}
                          </CardTitle>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setGeneratedRecipe(recipe)}
                              className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-primary/10"
                            >
                              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteRecipe(recipe.id)}
                              className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                          {recipe.description}
                        </p>
                      </CardHeader>
                      
                      <CardContent className="space-y-3 flex-1 flex flex-col">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{recipe.cookTime}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{recipe.servings} порций</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ChefHat className="w-4 h-4" />
                            <span>{recipe.ingredients.length} ингр.</span>
                          </div>
                          {recipe.cuisine && (
                            <div className="flex items-center gap-1 min-w-0">
                              <Globe className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">{WORLD_CUISINES.find(c => c.id === recipe.cuisine)?.flag} {WORLD_CUISINES.find(c => c.id === recipe.cuisine)?.name}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Badge className={`text-xs ${
                            recipe.difficulty === 'Easy' ? 'bg-leaf text-primary-foreground' :
                            recipe.difficulty === 'Medium' ? 'bg-sage text-foreground' :
                            'bg-forest text-primary-foreground'
                          }`}>
                            {recipe.difficulty}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(recipe.savedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>


      {/* Product Selector Modal */}
      {/* Removed Product Selector Modal */}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={(userData) => {
          // Обновляем user context
          login({
            ...userData,
            id: userData.id.toString() // Ensure id is string for User type
          });
          setShowAuthModal(false);
          toast({
            title: "Добро пожаловать!",
            description: `Привет, ${userData.name}!`,
          });
        }}
      />

      {/* Premium Modal */}
      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        feature={premiumFeature}
        onSuccess={() => {
          // После успешной подписки можно выполнить дополнительные действия
          console.log('Premium subscription activated for:', premiumFeature);
        }}
      />
    </div>
  );
};

export default MyRecipes;
