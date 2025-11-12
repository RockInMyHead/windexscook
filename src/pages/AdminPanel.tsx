import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { Header } from '@/components/header';
import { useUser } from '@/contexts/UserContext';
import { Recipe } from '@/types/recipe';
import { toast } from '@/hooks/use-toast';

const AdminPanel: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useUser();
  const [pendingRecipes, setPendingRecipes] = useState<Recipe[]>([]);
  const [publishedRecipes, setPublishedRecipes] = useState<Recipe[]>([]);
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
    loadPublishedRecipes();
  }, [isAdmin, navigate]);

  const loadPendingRecipes = async () => {
    setLoading(true);
    try {
      // Получаем рецепты на модерацию через API
      const response = await fetch('/api/admin/pending-recipes');
      if (!response.ok) {
        throw new Error('Failed to load pending recipes');
      }

      const dbRecipes = await response.json();

      // Преобразуем рецепты из базы данных в формат Recipe с уникальными ID
      const pending = dbRecipes.map((recipe: any) => ({
        id: `db-${recipe.id.toString()}`,
        title: recipe.title,
        description: recipe.description || '',
        image: recipe.image || undefined,
        cookTime: recipe.cook_time || '30 мин',
        servings: recipe.servings || 4,
        difficulty: recipe.difficulty || 'Medium',
        category: recipe.category || 'main',
        cuisine: recipe.cuisine || undefined,
        ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : JSON.parse(recipe.ingredients || '[]'),
        instructions: Array.isArray(recipe.instructions) ? recipe.instructions : JSON.parse(recipe.instructions || '[]'),
        tips: recipe.tips || undefined,
        author: {
          id: recipe.author_id?.toString() || '1',
          name: 'Пользователь',
          email: 'user@example.com'
        },
        createdAt: recipe.created_at,
        updatedAt: recipe.updated_at,
        rating: recipe.rating || 0,
        likes: recipe.likes || 0,
        favorites: recipe.favorites || 0,
        commentsCount: recipe.comments_count || 0,
        status: recipe.status || 'pending'
      }));

      setPendingRecipes(pending);
    } catch (error) {
      console.error('❌ Error loading pending recipes:', error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить рецепты на модерацию",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPublishedRecipes = async () => {
    try {
      // Статические рецепты (встроенные в приложение)
      const staticRecipes = [
        {
          id: 'static-1',
          title: 'Спагетти Карбонара',
          description: 'Классический итальянский рецепт с беконом, яйцами и пармезаном',
          cookTime: '20 мин',
          servings: 4,
          difficulty: 'Medium' as const,
          category: 'Итальянская кухня',
          cuisine: 'Итальянская',
          author: {
            id: 'demo-user',
            name: 'Demo Chef',
            email: 'demo@example.com'
          },
          createdAt: new Date().toISOString(),
          rating: 4.5,
          likes: 12,
          favorites: 8,
          commentsCount: 3,
          status: 'approved' as const,
          isStatic: true
        },
        {
          id: 'static-2',
          title: 'Тирамису',
          description: 'Нежный итальянский десерт с кофе и маскарпоне',
          cookTime: '30 мин + 4 часа охлаждение',
          servings: 8,
          difficulty: 'Medium' as const,
          category: 'Десерты',
          cuisine: 'Итальянская',
          author: {
            id: 'demo-user',
            name: 'Sweet Chef',
            email: 'sweet@example.com'
          },
          createdAt: new Date().toISOString(),
          rating: 4.8,
          likes: 25,
          favorites: 18,
          commentsCount: 7,
          status: 'approved' as const,
          isStatic: true
        },
        {
          id: 'static-3',
          title: 'Борщ украинский',
          description: 'Традиционный украинский борщ с говядиной и сметаной',
          cookTime: '2 часа',
          servings: 6,
          difficulty: 'Easy' as const,
          category: 'Обеды',
          cuisine: 'Украинская',
          author: {
            id: 'demo-user',
            name: 'Ukrainian Chef',
            email: 'ukrainian@example.com'
          },
          createdAt: new Date().toISOString(),
          rating: 4.3,
          likes: 15,
          favorites: 12,
          commentsCount: 5,
          status: 'approved' as const,
          isStatic: true
        }
      ];

      // Получаем опубликованные рецепты через API
      const response = await fetch('/api/admin/published-recipes');
      if (!response.ok) {
        throw new Error('Failed to load published recipes');
      }

      const dbRecipes = await response.json();

      // Преобразуем рецепты из базы данных в формат Recipe с уникальными ID
      const dbRecipesFormatted = dbRecipes.map((recipe: any) => ({
        id: `db-${recipe.id.toString()}`,
        title: recipe.title,
        description: recipe.description || '',
        image: recipe.image || undefined,
        cookTime: recipe.cook_time || '30 мин',
        servings: recipe.servings || 4,
        difficulty: recipe.difficulty || 'Medium',
        category: recipe.category || 'main',
        cuisine: recipe.cuisine || undefined,
        ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : JSON.parse(recipe.ingredients || '[]'),
        instructions: Array.isArray(recipe.instructions) ? recipe.instructions : JSON.parse(recipe.instructions || '[]'),
        tips: recipe.tips || undefined,
        author: {
          id: recipe.author_id?.toString() || '1',
          name: 'Пользователь',
          email: 'user@example.com'
        },
        createdAt: recipe.created_at,
        updatedAt: recipe.updated_at,
        rating: recipe.rating || 0,
        likes: recipe.likes || 0,
        favorites: recipe.favorites || 0,
        commentsCount: recipe.comments_count || 0,
        status: recipe.status || 'approved',
        isStatic: false // помечаем как рецепт из базы данных
      }));

      // Комбинируем все рецепты
      const allPublishedRecipes = [...staticRecipes, ...dbRecipesFormatted];

      setPublishedRecipes(allPublishedRecipes);
    } catch (error) {
      console.error('❌ Error loading published recipes:', error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить опубликованные рецепты",
        variant: "destructive",
      });
    }
  };

  const handleApproveRecipe = async (recipeId: string) => {
    setIsModerating(true);
    try {
      // Извлекаем реальный ID из базы данных (убираем префикс 'db-')
      const realId = recipeId.startsWith('db-') ? recipeId.substring(3) : recipeId;

      const response = await fetch(`/api/recipes/${realId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          moderatorId: user?.id,
          reason: moderationReason || 'Одобрен администратором'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to approve recipe');
      }

      setPendingRecipes(prev => prev.filter(recipe => recipe.id !== recipeId));
      setSelectedRecipe(null);
      setModerationReason('');

      toast({
        title: "Рецепт одобрен",
        description: "Рецепт успешно опубликован",
      });
    } catch (error) {
      console.error('❌ Error approving recipe:', error);
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
      // Извлекаем реальный ID из базы данных (убираем префикс 'db-')
      const realId = recipeId.startsWith('db-') ? recipeId.substring(3) : recipeId;

      const response = await fetch(`/api/recipes/${realId}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          moderatorId: user?.id,
          reason: moderationReason
        })
      });

      if (!response.ok) {
        throw new Error('Failed to reject recipe');
      }

      setPendingRecipes(prev => prev.filter(recipe => recipe.id !== recipeId));
      setSelectedRecipe(null);
      setModerationReason('');

      toast({
        title: "Рецепт отклонен",
        description: "Рецепт отклонен с указанной причиной",
      });
    } catch (error) {
      console.error('❌ Error rejecting recipe:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось отклонить рецепт",
        variant: "destructive",
      });
    } finally {
      setIsModerating(false);
    }
  };

  const handleDeleteRecipe = async (recipeId: string, isStatic?: boolean) => {
    if (isStatic) {
      toast({
        title: "Невозможно удалить",
        description: "Статические рецепты встроены в приложение и не могут быть удалены",
        variant: "destructive",
      });
      return;
    }

    if (!confirm('Вы уверены, что хотите удалить этот рецепт? Это действие нельзя отменить.')) {
      return;
    }

    setIsModerating(true);
    try {
      // Извлекаем реальный ID из базы данных (убираем префикс 'db-')
      const realId = recipeId.startsWith('db-') ? recipeId.substring(3) : recipeId;

      const response = await fetch(`/api/recipes/${realId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete recipe');
      }

      // Обновляем списки рецептов
      setPendingRecipes(prev => prev.filter(recipe => recipe.id !== recipeId));
      setPublishedRecipes(prev => prev.filter(recipe => recipe.id !== recipeId));
      setSelectedRecipe(null);

      toast({
        title: "Рецепт удален",
        description: "Рецепт был полностью удален из системы",
      });
    } catch (error) {
      console.error('❌ Error deleting recipe:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить рецепт",
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
              
              {/* Статистика */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-white rounded-lg shadow-sm border">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium">На модерации</span>
                  </div>
                  <div className="text-2xl font-bold text-yellow-600">{pendingRecipes.length}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadPendingRecipes}
                    disabled={loading}
                    className="mt-2"
                  >
                    {loading ? "Загрузка..." : "Обновить"}
                  </Button>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm border">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium">Опубликовано</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{publishedRecipes.length}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {publishedRecipes.filter(r => r.isStatic).length} статических, {publishedRecipes.filter(r => !r.isStatic).length} пользовательских
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadPublishedRecipes}
                    className="mt-2"
                  >
                    Обновить
                  </Button>
                </div>
              </div>
            </div>

            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pending">На модерации</TabsTrigger>
                <TabsTrigger value="published">Опубликованные</TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="mt-6">
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
                            <Button
                              variant="outline"
                              onClick={() => handleDeleteRecipe(recipe.id)}
                              className="border-gray-300 text-gray-600 hover:bg-gray-50"
                              disabled={isModerating}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Удалить
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="published" className="mt-6">
                {publishedRecipes.length === 0 ? (
                  <Card className="text-center py-12">
                    <CardContent>
                      <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Нет рецептов</h3>
                      <p className="text-gray-600">Здесь будут отображаться все опубликованные рецепты</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-6">
                    {publishedRecipes.map((recipe) => (
                      <Card key={recipe.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <CardTitle className="text-xl">{recipe.title}</CardTitle>
                                {recipe.isStatic ? (
                                  <Badge className="bg-blue-100 text-blue-800">Статический</Badge>
                                ) : (
                                  getStatusBadge(recipe.status)
                                )}
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
                                Опубликовано: {new Date(recipe.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {recipe.isStatic ? (
                              <Button
                                variant="outline"
                                onClick={() => handleDeleteRecipe(recipe.id, recipe.isStatic)}
                                className="border-gray-300 text-gray-600 hover:bg-gray-50"
                                disabled={isModerating}
                              >
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                Встроенный рецепт
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                onClick={() => handleDeleteRecipe(recipe.id, recipe.isStatic)}
                                className="border-red-300 text-red-600 hover:bg-red-50"
                                disabled={isModerating}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Удалить с сайта
                              </Button>
                            )}
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
