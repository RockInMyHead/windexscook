import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Shield, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  User, 
  Calendar,
  ChefHat,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';
import { Header } from '@/components/header';
import { useUser } from '@/contexts/UserContext';
import { RecipeService } from '@/services/recipeService';
import { Recipe } from '@/types/recipe';
import { toast } from '@/hooks/use-toast';

const AdminPanel: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useUser();
  const [pendingRecipes, setPendingRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [moderationReason, setModerationReason] = useState('');
  const [isModerating, setIsModerating] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadPendingRecipes();
  }, [isAdmin, navigate]);

  const loadPendingRecipes = async () => {
    setLoading(true);
    try {
      // Получаем все рецепты для администратора
      const allRecipes = await RecipeService.getAllRecipes();
      const pending = allRecipes.filter(recipe => recipe.status === 'pending' || !recipe.status);
      setPendingRecipes(pending);
    } catch (error) {
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить рецепты на модерацию",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRecipe = async (recipeId: string) => {
    setIsModerating(true);
    try {
      // В реальном приложении здесь был бы API вызов
      await RecipeService.approveRecipe(recipeId, user?.id || '', moderationReason);
      
      setPendingRecipes(prev => prev.filter(recipe => recipe.id !== recipeId));
      setSelectedRecipe(null);
      setModerationReason('');
      
      toast({
        title: "Рецепт одобрен",
        description: "Рецепт успешно опубликован",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось одобрить рецепт",
        variant: "destructive",
      });
    } finally {
      setIsModerating(false);
    }
  };

  const handleRejectRecipe = async (recipeId: string) => {
    if (!moderationReason.trim()) {
      toast({
        title: "Укажите причину",
        description: "Пожалуйста, укажите причину отклонения рецепта",
        variant: "destructive",
      });
      return;
    }

    setIsModerating(true);
    try {
      // В реальном приложении здесь был бы API вызов
      await RecipeService.rejectRecipe(recipeId, user?.id || '', moderationReason);
      
      setPendingRecipes(prev => prev.filter(recipe => recipe.id !== recipeId));
      setSelectedRecipe(null);
      setModerationReason('');
      
      toast({
        title: "Рецепт отклонен",
        description: "Рецепт отклонен с указанной причиной",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отклонить рецепт",
        variant: "destructive",
      });
    } finally {
      setIsModerating(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">На модерации</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Одобрен</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Отклонен</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">На модерации</Badge>;
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Панель администратора</h1>
                  <p className="text-gray-600">Модерация рецептов пользователей</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <span className="font-medium">На модерации:</span>
                  <Badge className="bg-yellow-100 text-yellow-800">{pendingRecipes.length}</Badge>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadPendingRecipes}
                  disabled={loading}
                >
                  {loading ? "Загрузка..." : "Обновить"}
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Загрузка рецептов...</p>
              </div>
            ) : pendingRecipes.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Все рецепты обработаны!</h3>
                  <p className="text-gray-600">Нет рецептов, ожидающих модерации</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {pendingRecipes.map((recipe) => (
                  <Card key={recipe.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <CardTitle className="text-xl">{recipe.title}</CardTitle>
                            {getStatusBadge(recipe.status)}
                          </div>
                          <p className="text-gray-600 mb-4">{recipe.description}</p>
                          
                          <div className="flex items-center gap-6 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <ChefHat className="w-4 h-4" />
                              <span>{recipe.difficulty}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{recipe.cookTime}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              <span>{recipe.servings} порций</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRecipe(recipe)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Просмотр
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="flex items-center gap-4 mb-4">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={recipe.author.avatar || ''} alt={recipe.author.name} />
                          <AvatarFallback className="text-xs bg-green-100 text-green-600">
                            {recipe.author.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{recipe.author.name}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(recipe.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleApproveRecipe(recipe.id)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={isModerating}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Одобрить
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedRecipe(recipe);
                            setModerationReason('');
                          }}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          disabled={isModerating}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Отклонить
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recipe Details Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">{selectedRecipe.title}</CardTitle>
                <Button variant="ghost" onClick={() => setSelectedRecipe(null)}>
                  ✕
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {selectedRecipe.image && (
                <img 
                  src={selectedRecipe.image} 
                  alt={selectedRecipe.title}
                  className="w-full h-64 object-cover rounded-lg"
                />
              )}
              
              <div>
                <h3 className="font-semibold mb-2">Описание:</h3>
                <p className="text-gray-700">{selectedRecipe.description}</p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Ингредиенты:</h3>
                <ul className="list-disc list-inside space-y-1">
                  {selectedRecipe.ingredients.map((ingredient, index) => (
                    <li key={index} className="text-gray-700">{ingredient}</li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Инструкции:</h3>
                <ol className="list-decimal list-inside space-y-2">
                  {selectedRecipe.instructions.map((instruction, index) => (
                    <li key={index} className="text-gray-700">{instruction}</li>
                  ))}
                </ol>
              </div>
              
              {selectedRecipe.tips && (
                <div>
                  <h3 className="font-semibold mb-2">Советы:</h3>
                  <p className="text-gray-700">{selectedRecipe.tips}</p>
                </div>
              )}
              
              <div className="border-t pt-4">
                <Label htmlFor="moderation-reason">Причина модерации (обязательно для отклонения):</Label>
                <Textarea
                  id="moderation-reason"
                  value={moderationReason}
                  onChange={(e) => setModerationReason(e.target.value)}
                  placeholder="Укажите причину одобрения или отклонения рецепта..."
                  className="mt-2"
                />
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => handleApproveRecipe(selectedRecipe.id)}
                  className="bg-green-600 hover:bg-green-700 text-white flex-1"
                  disabled={isModerating}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Одобрить рецепт
                </Button>
                <Button
                  onClick={() => handleRejectRecipe(selectedRecipe.id)}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 flex-1"
                  disabled={isModerating}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Отклонить рецепт
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default AdminPanel;
