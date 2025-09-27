import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ChefHat className="h-6 w-6 text-primary" />
              {recipe.title}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recipe Description */}
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-lg leading-relaxed">
                {recipe.description}
              </p>
            </CardContent>
          </Card>

          {/* Recipe Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold text-foreground">Время</h3>
                <p className="text-muted-foreground">{recipe.cookTime}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold text-foreground">Порций</h3>
                <p className="text-muted-foreground">{recipe.servings}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <ChefHat className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold text-foreground">Сложность</h3>
                <Badge className={`${getDifficultyColor(recipe.difficulty)} border`}>
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
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-500" />
                Инструкции приготовления
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {recipe.instructions.map((instruction, index) => (
                  <li key={index} className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                      {index + 1}
                    </span>
                    <p className="text-foreground leading-relaxed pt-1">
                      {instruction}
                    </p>
                  </li>
                ))}
              </ol>
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
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              onClick={handleCopy}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Копировать рецепт
            </Button>
            
            {showSaveButton && onSave && (
              <Button
                onClick={handleSave}
                className="bg-gradient-primary hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Сохранить
              </Button>
            )}
            
            <Button
              onClick={onGenerateNew}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Создать новый
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};



