import { useState } from "react";
import { Header } from "@/components/header";
import { HeroSection } from "@/components/hero-section";
import { FeaturesSection } from "@/components/features-section";
import { RecipesSection } from "@/components/recipes-section";
import { AboutSection } from "@/components/about-section";
import { RoadmapSection } from "@/components/roadmap-section";
import { IngredientInput } from "@/components/ui/ingredient-input";
import { AuthModal } from "@/components/ui/auth-modal";
import { useUser } from "@/contexts/UserContext";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [showIngredientInput, setShowIngredientInput] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const { user, login, isAuthenticated } = useUser();

  const handleGetStarted = () => {
    setShowIngredientInput(true);
    // Smooth scroll to ingredient input
    setTimeout(() => {
      const element = document.getElementById("ingredient-input");
      element?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleViewExamples = () => {
    // Smooth scroll to recipes section
    const element = document.getElementById("recipes-section");
    element?.scrollIntoView({ behavior: "smooth" });
  };

  const handleGenerateRecipe = (ingredients: string[]) => {
    toast({
      title: "🎉 Рецепт готов!",
      description: `AI создал уникальный рецепт из ${ingredients.length} ингредиентов: ${ingredients.slice(0, 3).join(", ")}${ingredients.length > 3 ? "..." : ""}`,
    });
    
    // Here you would typically call your AI API
    console.log("Generating recipe with ingredients:", ingredients);
  };

  const handleRegister = () => {
    setAuthMode('register');
    setShowAuthModal(true);
  };

  const handleLogin = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleAuthSuccess = (userData: { name: string; email: string }) => {
    const user = {
      id: Date.now().toString(),
      name: userData.name,
      email: userData.email,
      role: 'user' as const
    };
    login(user);
    setShowAuthModal(false);
    toast({
      title: "Добро пожаловать!",
      description: `Привет, ${userData.name}! Теперь вы можете сохранять рецепты.`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onRegister={handleRegister} onLogin={handleLogin} />
      <HeroSection onGetStarted={handleGetStarted} onViewExamples={handleViewExamples} />
      
      {showIngredientInput && (
        <section id="ingredient-input" className="py-12 sm:py-16 md:py-20 px-4 bg-background">
          <div className="container mx-auto">
            <IngredientInput 
              onGenerateRecipe={handleGenerateRecipe}
              onRegister={handleRegister}
              onLogin={handleLogin}
            />
          </div>
        </section>
      )}
      
      <RoadmapSection />
      <AboutSection />
      <FeaturesSection />
      <RecipesSection onGetStarted={handleGetStarted} />
      
      {/* Footer */}
      <footer className="bg-muted/20 py-8 sm:py-12 px-4 border-t border-border/50">
        <div className="container mx-auto max-w-6xl text-center">
          <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2"><span className="text-primary">Windexs</span> кулинар</h3>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Превращаем ингредиенты в кулинарные шедевры с помощью ИИ
          </p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
};

export default Index;