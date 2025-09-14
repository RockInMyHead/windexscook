import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Sparkles, Loader2 } from "lucide-react";
import { OpenAIService, Recipe } from "@/services/openai";
import { RecipeDisplay } from "./recipe-display";
import { toast } from "@/hooks/use-toast";

interface IngredientInputProps {
  onGenerateRecipe: (ingredients: string[]) => void;
  onRegister: () => void;
  onLogin: () => void;
}

export const IngredientInput = ({ onGenerateRecipe, onRegister, onLogin }: IngredientInputProps) => {
  const [currentIngredient, setCurrentIngredient] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<Recipe | null>(null);

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

  const handleGenerate = async () => {
    if (ingredients.length === 0) {
      toast({
        title: "Добавьте ингредиенты",
        description: "Пожалуйста, добавьте хотя бы один ингредиент для создания рецепта",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const recipe = await OpenAIService.generateRecipe(ingredients);
      setGeneratedRecipe(recipe);
      
      toast({
        title: "🎉 Рецепт готов!",
        description: `AI создал уникальный рецепт "${recipe.title}" из ваших ингредиентов`,
      });
      
      onGenerateRecipe(ingredients);
    } catch (error) {
      console.error('Error generating recipe:', error);
      toast({
        title: "Ошибка генерации",
        description: error instanceof Error ? error.message : "Не удалось создать рецепт. Попробуйте еще раз.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseRecipe = () => {
    setGeneratedRecipe(null);
  };

  const handleGenerateNew = () => {
    setGeneratedRecipe(null);
    setIngredients([]);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 p-6 bg-gradient-card rounded-xl shadow-card border border-border/50">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-foreground">Какие у вас есть ингредиенты?</h3>
        <p className="text-muted-foreground text-sm">
          Добавьте продукты, и AI создаст для вас уникальный рецепт
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={currentIngredient}
          onChange={(e) => setCurrentIngredient(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Введите ингредиент..."
          className="flex-1 border-border/60 focus:border-primary/60 focus:ring-primary/20"
        />
        <Button 
          onClick={addIngredient}
          variant="secondary"
          size="icon"
          className="shrink-0 hover:bg-accent/80 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {ingredients.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Ваши ингредиенты:</h4>
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
          
          <Button 
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full bg-gradient-primary hover:opacity-90 transition-opacity shadow-soft animate-pulse-glow disabled:opacity-50"
            size="lg"
          >
            {isLoading ? (
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
      )}

      {/* Recipe Display Modal */}
      {generatedRecipe && (
        <RecipeDisplay
          recipe={generatedRecipe}
          onClose={handleCloseRecipe}
          onGenerateNew={handleGenerateNew}
          onRegister={onRegister}
          onLogin={onLogin}
        />
      )}
    </div>
  );
};