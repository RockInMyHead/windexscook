import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RecipeService } from '@/services/recipeService';
import { Recipe, Comment } from '@/types/recipe';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { 
  Clock, 
  Users, 
  ChefHat, 
  MessageCircle, 
  Heart, 
  Star, 
  ArrowLeft,
  BookOpen,
  Utensils,
  Timer,
  User,
  Calendar,
  ThumbsUp,
  Share2,
  Copy,
  Send,
  Heart as HeartIcon,
  Bookmark,
  Trash2
} from 'lucide-react';
import { Header } from '@/components/header';
import { toast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';

const RecipeDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useUser();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [userRating, setUserRating] = useState(0);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const data = await RecipeService.getRecipe(id);
      setRecipe(data);
      const comms = await RecipeService.getComments(id);
      setComments(comms);
      setLoading(false);
    })();
  }, [id]);

  const handleCopyRecipe = async () => {
    if (!recipe) return;
    
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

  const handleLikeRecipe = async () => {
    if (!user || !recipe) return;
    
    try {
      if (recipe.isLiked) {
        const success = await RecipeService.unlikeRecipe(recipe.id, user.id);
        if (success) {
          setRecipe(prev => prev ? { ...prev, likes: prev.likes - 1, isLiked: false } : null);
          toast({
            title: "Лайк убран",
            description: "Вы убрали лайк с рецепта",
          });
        }
      } else {
        const success = await RecipeService.likeRecipe(recipe.id, user.id);
        if (success) {
          setRecipe(prev => prev ? { ...prev, likes: prev.likes + 1, isLiked: true } : null);
          toast({
            title: "Лайк добавлен!",
            description: "Спасибо за лайк!",
          });
        } else {
          toast({
            title: "Уже лайкнуто",
            description: "Вы уже лайкнули этот рецепт",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить лайк",
        variant: "destructive",
      });
    }
  };

  const handleFavoriteRecipe = async () => {
    if (!user || !recipe) return;
    
    try {
      if (recipe.isFavorited) {
        const success = await RecipeService.unfavoriteRecipe(recipe.id, user.id);
        if (success) {
          setRecipe(prev => prev ? { ...prev, favorites: prev.favorites - 1, isFavorited: false } : null);
          toast({
            title: "Убрано из избранного",
            description: "Рецепт убран из избранного",
          });
        }
      } else {
        const success = await RecipeService.favoriteRecipe(recipe.id, user.id);
        if (success) {
          setRecipe(prev => prev ? { ...prev, favorites: prev.favorites + 1, isFavorited: true } : null);
          toast({
            title: "Добавлено в избранное!",
            description: "Рецепт добавлен в избранное",
          });
        } else {
          toast({
            title: "Уже в избранном",
            description: "Этот рецепт уже в вашем избранном",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить избранное",
        variant: "destructive",
      });
    }
  };

  const handleRateRecipe = async (rating: number) => {
    if (!user || !recipe) return;
    
    try {
      await RecipeService.rateRecipe(recipe.id, user.id, rating);
      setUserRating(rating);
      toast({
        title: "Оценка поставлена!",
        description: `Вы оценили рецепт на ${rating} звезд`,
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось поставить оценку",
        variant: "destructive",
      });
    }
  };

  const handleSubmitComment = async () => {
    if (!user || !recipe || !newComment.trim()) return;
    
    setIsSubmittingComment(true);
    try {
      const comment = await RecipeService.addComment(recipe.id, newComment.trim(), user);
      setComments(prev => [...prev, comment]);
      setNewComment('');
      toast({
        title: "Комментарий добавлен!",
        description: "Ваш комментарий успешно опубликован",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось добавить комментарий",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user || (!isAdmin && comments.find(c => c.id === commentId)?.author.id !== user.id)) return;
    
    if (window.confirm('Вы уверены, что хотите удалить этот комментарий?')) {
      try {
        await RecipeService.deleteComment(commentId);
        setComments(prev => prev.filter(c => c.id !== commentId));
        toast({
          title: "Успех",
          description: "Комментарий удален",
        });
      } catch (error) {
        toast({
          title: "Ошибка",
          description: "Не удалось удалить комментарий",
          variant: "destructive",
        });
      }
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;
    
    try {
      await RecipeService.likeComment(commentId, user.id);
      setComments(prev => prev.map(comment => 
        comment.id === commentId 
          ? { ...comment, likes: comment.likes + 1, isLiked: true }
          : comment
      ));
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось поставить лайк комментарию",
        variant: "destructive",
      });
    }
  };

  if (loading) return <div className="p-8 text-center">Загрузка рецепта...</div>;
  if (!recipe) return <div className="p-8 text-center">Рецепт не найден</div>;

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
    <div className="container mx-auto px-4 py-8">
          {/* Back Button */}
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)} 
            className="mb-6 hover:bg-white/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Recipe Header */}
              <Card className="overflow-hidden shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <div className="relative">
                  {recipe.image && (
                    <div className="h-64 md:h-80 overflow-hidden">
                      <img 
                        src={recipe.image} 
                        alt={recipe.title} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="absolute top-4 right-4">
                    <Badge className={`${getDifficultyColor(recipe.difficulty)} border shadow-sm`}>
                      {recipe.difficulty}
                    </Badge>
                  </div>
                </div>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-3xl font-bold text-gray-900 mb-3">
                        {recipe.title}
                      </CardTitle>
                      <p className="text-lg text-gray-600 leading-relaxed">
                        {recipe.description}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleCopyRecipe}
                        className="hover:bg-orange-50 hover:border-orange-200"
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Копировать
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="hover:bg-orange-50 hover:border-orange-200"
                      >
                        <Share2 className="w-4 h-4 mr-1" />
                        Поделиться
                      </Button>
                      {user && (
                        <>
                          <Button 
                            variant={recipe.isLiked ? "default" : "outline"}
                            size="sm"
                            onClick={handleLikeRecipe}
                            className={recipe.isLiked ? "bg-red-500 hover:bg-red-600" : "hover:bg-red-50 hover:border-red-200"}
                          >
                            <HeartIcon className={`w-4 h-4 mr-1 ${recipe.isLiked ? 'fill-current' : ''}`} />
                            {recipe.likes}
                          </Button>
                          <Button 
                            variant={recipe.isFavorited ? "default" : "outline"}
                            size="sm"
                            onClick={handleFavoriteRecipe}
                            className={recipe.isFavorited ? "bg-yellow-500 hover:bg-yellow-600" : "hover:bg-yellow-50 hover:border-yellow-200"}
                          >
                            <Bookmark className={`w-4 h-4 mr-1 ${recipe.isFavorited ? 'fill-current' : ''}`} />
                            {recipe.favorites}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Recipe Stats */}
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-orange-50 rounded-xl">
                      <Timer className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                      <div className="text-sm text-gray-600">Время</div>
                      <div className="font-semibold text-gray-900">{recipe.cookTime}</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-xl">
                      <Users className="w-6 h-6 text-green-600 mx-auto mb-2" />
                      <div className="text-sm text-gray-600">Порций</div>
                      <div className="font-semibold text-gray-900">{recipe.servings}</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-xl">
                      <Utensils className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                      <div className="text-sm text-gray-600">Ингредиенты</div>
                      <div className="font-semibold text-gray-900">{recipe.ingredients.length}</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-xl">
                      <Star className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                      <div className="text-sm text-gray-600">Рейтинг</div>
                      <div className="font-semibold text-gray-900">{recipe.rating.toFixed(1)}/5</div>
                      {user && (
                        <div className="flex justify-center gap-1 mt-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => handleRateRecipe(star)}
                              className={`w-4 h-4 ${
                                star <= userRating ? 'text-yellow-400' : 'text-gray-300'
                              } hover:text-yellow-400 transition-colors`}
                            >
                              <Star className={`w-4 h-4 ${star <= userRating ? 'fill-current' : ''}`} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ingredients */}
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <ChefHat className="w-5 h-5 text-orange-600" />
                    Ингредиенты
                  </CardTitle>
        </CardHeader>
        <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {recipe.ingredients.map((ingredient, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <span className="flex-shrink-0 w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <span className="text-gray-700">{ingredient}</span>
          </div>
                    ))}
          </div>
                </CardContent>
              </Card>

              {/* Instructions */}
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    Инструкции приготовления
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recipe.instructions.map((instruction, index) => (
                      <div key={index} className="flex gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
                          {index + 1}
                        </span>
                        <p className="text-gray-700 leading-relaxed pt-1">
                          {instruction}
                        </p>
          </div>
                    ))}
              </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Author Info */}
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="w-5 h-5 text-gray-600" />
                    Автор рецепта
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={recipe.author.avatar || ''} alt={recipe.author.name} />
                      <AvatarFallback className="bg-orange-100 text-orange-600">
                        {recipe.author.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold text-gray-900">{recipe.author.name}</div>
                      <div className="text-sm text-gray-600 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(recipe.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Comments */}
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                    Комментарии ({comments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Add Comment Form */}
                  {user ? (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={user.avatar || ''} alt={user.name} />
                          <AvatarFallback className="text-xs bg-orange-100 text-orange-600">
                            {user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <Textarea
                            placeholder="Напишите ваш комментарий..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="min-h-[80px] resize-none"
                          />
                          <div className="flex justify-end mt-2">
                            <Button
                              onClick={handleSubmitComment}
                              disabled={!newComment.trim() || isSubmittingComment}
                              size="sm"
                              className="bg-orange-500 hover:bg-orange-600"
                            >
                              <Send className="w-4 h-4 mr-1" />
                              {isSubmittingComment ? 'Отправка...' : 'Отправить'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg text-center">
                      <p className="text-gray-600 mb-2">Войдите в аккаунт, чтобы оставить комментарий</p>
                      <Button 
                        onClick={() => {/* Open auth modal */}}
                        size="sm"
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        Войти
                      </Button>
                    </div>
                  )}

                  {/* Comments List */}
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {comments.length > 0 ? comments.map(comment => (
                      <div key={comment.id} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={comment.author.avatar || ''} alt={comment.author.name} />
                            <AvatarFallback className="text-xs bg-green-100 text-green-600">
                              {comment.author.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-gray-900 text-sm">{comment.author.name}</div>
                              {isAdmin && comment.author.id !== user?.id && (
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200">
                                  👑 Admin
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(comment.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {user && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleLikeComment(comment.id)}
                                className={`p-1 h-auto ${
                                  comment.isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
                                }`}
                              >
                                <ThumbsUp className={`w-4 h-4 mr-1 ${comment.isLiked ? 'fill-current' : ''}`} />
                                {comment.likes}
                              </Button>
                            )}
                            {user && (isAdmin || comment.author.id === user.id) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteComment(comment.id)}
                                className="p-1 h-auto text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed">{comment.content}</p>
                      </div>
                    )) : (
                      <div className="text-center py-8 text-gray-500">
                        <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Пока нет комментариев</p>
                        <p className="text-sm">Будьте первым, кто оставит отзыв!</p>
                      </div>
                    )}
                  </div>
        </CardContent>
      </Card>
    </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RecipeDetails;



