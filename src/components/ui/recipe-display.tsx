import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Users, ChefHat, Lightbulb, X, Heart, BookOpen, Check } from "lucide-react";
import { Recipe } from "@/services/openai";
import { RegistrationInvite } from "./registration-invite";
import { useUser } from "@/contexts/UserContext";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface RecipeDisplayProps {
  recipe: Recipe;
  onClose: () => void;
  onGenerateNew: () => void;
  onRegister: () => void;
  onLogin: () => void;
}

export const RecipeDisplay = ({ recipe, onClose, onGenerateNew, onRegister, onLogin }: RecipeDisplayProps) => {
  const [showRegistrationInvite, setShowRegistrationInvite] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const { isAuthenticated, user } = useUser();
  const difficultyColors = {
    Easy: "bg-leaf text-primary-foreground",
    Medium: "bg-sage text-foreground", 
    Hard: "bg-forest text-primary-foreground"
  };

  const handleSaveRecipe = () => {
    if (!isAuthenticated) {
      setShowRegistrationInvite(true);
      return;
    }

    // Сохраняем рецепт в localStorage
    const savedRecipes = JSON.parse(localStorage.getItem('saved-recipes') || '[]');
    const recipeToSave = {
      ...recipe,
      id: Date.now().toString(),
      savedAt: new Date().toISOString(),
      userId: user?.email
    };
    
    savedRecipes.push(recipeToSave);
    localStorage.setItem('saved-recipes', JSON.stringify(savedRecipes));
    
    setIsSaved(true);
    toast({
      title: "Рецепт сохранен!",
      description: `"${recipe.title}" добавлен в вашу коллекцию`,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-card border-border/50 shadow-glow">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
          
          <div className="pr-12">
            <CardTitle className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              {recipe.title}
            </CardTitle>
            <p className="text-muted-foreground text-lg leading-relaxed">
              {recipe.description}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Recipe Info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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
            <Badge className={`text-xs ${difficultyColors[recipe.difficulty]}`}>
              {recipe.difficulty}
            </Badge>
          </div>

          {/* Ingredients */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-primary" />
              Ингредиенты
            </h3>
            <div className="grid md:grid-cols-2 gap-2">
              {recipe.ingredients.map((ingredient, index) => (
                <div
                  key={index}
                  className="p-3 bg-secondary/50 rounded-lg text-sm text-foreground hover:bg-secondary/70 transition-colors"
                >
                  {ingredient}
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Пошаговое приготовление
            </h3>
            <div className="space-y-3">
              {recipe.instructions.map((instruction, index) => (
                <div
                  key={index}
                  className="flex gap-3 p-4 bg-gradient-card rounded-lg border border-border/50 hover:shadow-soft transition-all"
                >
                  <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                    {index + 1}
                  </div>
                  <p className="text-foreground leading-relaxed">{instruction}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          {recipe.tips && (
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4" />
                Совет от шеф-повара
              </h4>
              <p className="text-sm text-primary/80 italic">{recipe.tips}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-4 border-t border-border/50">
            {/* Save Recipe Button */}
            <Button
              onClick={handleSaveRecipe}
              disabled={isSaved}
              className={`w-full text-lg py-6 ${
                isSaved 
                  ? "bg-green-500 hover:bg-green-600 text-white" 
                  : "bg-gradient-primary hover:opacity-90 transition-opacity"
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Рецепт сохранен в коллекцию
                </>
              ) : (
                <>
                  <Heart className="w-5 h-5 mr-2" />
                  {isAuthenticated ? "Сохранить рецепт в коллекцию" : "Сохранить рецепт в коллекцию"}
                </>
              )}
            </Button>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={onGenerateNew}
                variant="secondary"
                className="flex-1"
              >
                Создать новый рецепт
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Закрыть
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registration Invite Modal */}
      {showRegistrationInvite && (
        <RegistrationInvite
          onRegister={() => {
            setShowRegistrationInvite(false);
            onRegister();
          }}
          onLogin={() => {
            setShowRegistrationInvite(false);
            onLogin();
          }}
          onSkip={() => setShowRegistrationInvite(false)}
        />
      )}
    </div>
  );
};
