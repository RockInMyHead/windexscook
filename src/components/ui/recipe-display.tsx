import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';
import { Button } from './button';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Separator } from './separator';
import { 
  Clock, 
  Users, 
  ChefHat, 
  X, 
  Sparkles, 
  Heart, 
  BookOpen,
  Save,
  Share2,
  Copy
} from 'lucide-react';
import { Recipe } from '@/services/openai';
import { toast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';

interface RecipeDisplayProps {
  recipe: Recipe;
  onClose: () => void;
  onGenerateNew: () => void;
  onRegister: () => void;
  onLogin: () => void;
  onSave?: (recipe: Recipe) => void;
  showSaveButton?: boolean;
}

export const RecipeDisplay: React.FC<RecipeDisplayProps> = ({
  recipe,
  onClose,
  onGenerateNew,
  onRegister,
  onLogin,
  onSave,
  showSaveButton = false
}) => {
  // State hooks must be declared at the top
  const [dishImage, setDishImage] = useState<string | null>(null);
  const [isImgLoading, setIsImgLoading] = useState(false);
  const { user } = useUser();

  // Автоматическая генерация изображения отключена
  // useEffect(() => {
  //   if (recipe && !dishImage && !isImgLoading) {
  //     handleGenerateImage();
  //   }
  // }, [recipe]);

  const handleSave = () => {
    if (onSave) {
      onSave(recipe);
    }
  };

  const handleCopy = async () => {
    const recipeText = `
${recipe.title}

${recipe.description}

Время приготовления: ${recipe.cookTime}
Порций: ${recipe.servings}
Сложность: ${recipe.difficulty}

ИНГРЕДИЕНТЫ:
${recipe.ingredients.map((ingredient, index) => `${index + 1}. ${ingredient}`).join('\n')}

ИНСТРУКЦИИ:
${recipe.instructions.map((instruction, index) => `${index + 1}. ${instruction}`).join('\n')}

${recipe.tips ? `СОВЕТ: ${recipe.tips}` : ''}
    `.trim();

    try {
      await navigator.clipboard.writeText(recipeText);
      toast({
        title: "Рецепт скопирован!",
        description: "Рецепт скопирован в буфер обмена",
      });
    } catch (error) {
      toast({
        title: "Ошибка копирования",
        description: "Не удалось скопировать рецепт",
        variant: "destructive",
      });
    }
  };

  const handleGenerateImage = async () => {
    setIsImgLoading(true);
    try {
      // Генерируем уникальный идентификатор пользователя
      const userIdentifier = user?.email || `anonymous_${Date.now()}`;
      
      const res = await fetch('/api/generate-nb-image', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: recipe.title,
          userIdentifier: userIdentifier
        })
      });
      
      if (!res.ok) {
        // Проверяем, если это ошибка лимита
        if (res.status === 429) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Достигнут дневной лимит генерации изображений');
        }
        throw new Error('Ошибка генерации изображения');
      }
      
      let b;
      // Проверяем, что сервер вернул JSON
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          b = await res.json();
        } catch (err) {
          console.error('Failed to parse JSON from image response:', err);
          throw new Error('Сервер вернул некорректный формат данных для изображения');
        }
      } else {
        const text = await res.text();
        console.error('Image API returned non-JSON:', text);
        throw new Error('Сервер вернул неверный ответ при генерации изображения');
      }
      
      setDishImage(b.image_base64 ? `data:image/png;base64,${b.image_base64}` : null);
      
      // Показываем информацию о лимитах, если они есть в ответе
      if (b.currentCount && b.limit) {
        toast({
          title: "Изображение сгенерировано!",
          description: `Использовано изображений: ${b.currentCount}/${b.limit}`,
        });
      }
    } catch (e: any) {
      console.error(e);
      toast({ 
        title: 'Ошибка', 
        description: e.message || 'Не удалось сгенерировать изображение', 
        variant: 'destructive' 
      });
    } finally {
      setIsImgLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'hard':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-[90vw] md:w-full mx-2 sm:mx-4">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg sm:text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <ChefHat className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <span className="truncate">{recipe.title}</span>
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="sr-only">
            Рецепт блюда: {recipe.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Recipe Description */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <p className="text-muted-foreground text-sm sm:text-base md:text-lg leading-relaxed">
                {recipe.description}
              </p>
            </CardContent>
          </Card>
          {/* Dish image preview */}
          {isImgLoading && (
            <Card>
              <CardContent className="p-4 sm:p-6 text-center">
                <Loader2 className="animate-spin h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-primary" />
                <p className="text-muted-foreground text-sm sm:text-base">Генерируем изображение блюда...</p>
              </CardContent>
            </Card>
          )}
          {dishImage && (
            <Card>
              <CardContent className="p-2 sm:p-4">
                <div className="relative overflow-hidden rounded-md">
                  <img 
                    src={dishImage} 
                    alt="Сгенерированное блюдо" 
                    className="w-full h-auto max-h-[300px] sm:max-h-[400px] object-cover rounded-md shadow-sm" 
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recipe Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <Card>
              <CardContent className="p-3 sm:p-4 text-center">
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold text-foreground text-sm sm:text-base">Время</h3>
                <p className="text-muted-foreground text-xs sm:text-sm">{recipe.cookTime}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4 text-center">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold text-foreground text-sm sm:text-base">Порций</h3>
                <p className="text-muted-foreground text-xs sm:text-sm">{recipe.servings}</p>
              </CardContent>
            </Card>
            <Card className="sm:col-span-2 md:col-span-1">
              <CardContent className="p-3 sm:p-4 text-center">
                <ChefHat className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold text-foreground text-sm sm:text-base">Сложность</h3>
                <Badge className={`${getDifficultyColor(recipe.difficulty)} border text-xs sm:text-sm`}>
                  {recipe.difficulty}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Ingredients */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" />
                Ингредиенты
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {recipe.ingredients.map((ingredient, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="text-foreground">{ingredient}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-500" />
                  <CardTitle>Инструкции приготовления</CardTitle>
                </div>
                {showSaveButton && onSave && (
                  <Button variant="primary" size="sm" onClick={handleSave} className="ml-auto">
                    Сохранить
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recipe.instructions.map((instruction, index) => {
                  // Очищаем инструкцию от лишних цифр и мета-информации
                  const cleanInstruction = instruction
                    .replace(/^[0-9.\s\-]+/, '') // Убираем номера в начале
                    .replace(/^(Оборудование|Время|Важно|Техника):\s*/i, '') // Убираем мета-префиксы
                    .trim();
                  
                  return (
                    <div key={index} className="flex gap-3 sm:gap-4">
                      <span className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm">
                        {index + 1}
                      </span>
                      <p className="text-foreground leading-relaxed pt-0.5 sm:pt-1 text-sm sm:text-base">
                        {cleanInstruction}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          {recipe.tips && (
            <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-800">
                  <Sparkles className="h-5 w-5" />
                  Совет от шеф-повара
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-yellow-700 leading-relaxed">
                  {recipe.tips}
                </p>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 justify-center">
            <Button
              onClick={handleCopy}
              variant="outline"
              className="flex items-center gap-2 text-sm sm:text-base"
              size="sm"
            >
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">Копировать рецепт</span>
              <span className="sm:hidden">Копировать</span>
            </Button>
            
            {showSaveButton && onSave && (
              <Button
                onClick={handleSave}
                className="bg-gradient-primary hover:opacity-90 transition-opacity flex items-center gap-2 text-sm sm:text-base"
                size="sm"
              >
                <Save className="h-4 w-4" />
                Сохранить
              </Button>
            )}
            
            <Button
              onClick={onGenerateNew}
              variant="secondary"
              className="flex items-center gap-2 text-sm sm:text-base"
              size="sm"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Создать новый</span>
              <span className="sm:hidden">Новый</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};



