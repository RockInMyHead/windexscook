import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, 
  Mail, 
  Calendar, 
  Edit3, 
  Save, 
  X, 
  ChefHat, 
  Heart, 
  Star, 
  MessageCircle,
  Settings,
  Camera,
  Award,
  TrendingUp,
  Clock,
  Users
} from 'lucide-react';
import { Header } from '@/components/header';
import { useUser } from '@/contexts/UserContext';
import { RecipeService } from '@/services/recipeService';
import { Recipe } from '@/types/recipe';
import { toast } from '@/hooks/use-toast';
import { SubscriptionCard } from '@/components/ui/subscription-card';

const UserProfile: React.FC = () => {
  const { user, updateUser } = useUser();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [userRecipes, setUserRecipes] = useState<Recipe[]>([]);
  const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('recipes');
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    bio: user?.bio || '',
    avatar: user?.avatar || ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    
    loadUserData();
  }, [user, navigate]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      // Load user's recipes
      const recipes = await RecipeService.getRecipes();
      const userRecipes = recipes.filter(r => r.author.id === user?.id);
      setUserRecipes(userRecipes);
      
      // Load favorite recipes (simulated)
      const favoriteRecipes = recipes.filter(r => r.isFavorited);
      setFavoriteRecipes(favoriteRecipes);
    } catch (error) {
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить данные пользователя",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    if (isEditing) {
      // Reset form if canceling
      setEditForm({
        name: user?.name || '',
        email: user?.email || '',
        bio: user?.bio || '',
        avatar: user?.avatar || ''
      });
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    try {
      // Update user context
      updateUser({
        ...user,
        ...editForm
      });
      
      setIsEditing(false);
      toast({
        title: "Профиль обновлен!",
        description: "Ваши данные успешно сохранены",
      });
    } catch (error) {
      toast({
        title: "Ошибка сохранения",
        description: "Не удалось сохранить изменения",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getUserStats = () => {
    const totalRecipes = userRecipes.length;
    const totalLikes = userRecipes.reduce((sum, recipe) => sum + recipe.likes, 0);
    const totalFavorites = userRecipes.reduce((sum, recipe) => sum + recipe.favorites, 0);
    const avgRating = userRecipes.length > 0 
      ? userRecipes.reduce((sum, recipe) => sum + recipe.rating, 0) / userRecipes.length 
      : 0;

    return {
      totalRecipes,
      totalLikes,
      totalFavorites,
      avgRating: avgRating.toFixed(1)
    };
  };

  if (!user) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Доступ запрещен</h2>
              <p className="text-gray-600 mb-4">Для просмотра профиля необходимо войти в аккаунт</p>
              <Button onClick={() => navigate('/')} className="bg-orange-500 hover:bg-orange-600">
                На главную
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const stats = getUserStats();

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
        <div className="container mx-auto px-4 py-8">
          {/* Profile Header */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm mb-8">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="relative">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={user.avatar || ''} alt={user.name} />
                    <AvatarFallback className="text-2xl bg-orange-100 text-orange-600">
                      {user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <Button
                      size="sm"
                      className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full p-0"
                      onClick={() => {/* Handle avatar upload */}}
                    >
                      <Camera className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                
                <div className="flex-1">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Имя</Label>
                        <Input
                          id="name"
                          value={editForm.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={editForm.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bio">О себе</Label>
                        <Textarea
                          id="bio"
                          value={editForm.bio}
                          onChange={(e) => handleInputChange('bio', e.target.value)}
                          placeholder="Расскажите о себе..."
                          className="mt-1"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSaveProfile} className="bg-green-500 hover:bg-green-600">
                          <Save className="w-4 h-4 mr-1" />
                          Сохранить
                        </Button>
                        <Button variant="outline" onClick={handleEditToggle}>
                          <X className="w-4 h-4 mr-1" />
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold text-gray-900">{user.name}</h1>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleEditToggle}
                          className="hover:bg-orange-50 hover:border-orange-200"
                        >
                          <Edit3 className="w-4 h-4 mr-1" />
                          Редактировать
                        </Button>
                      </div>
                      <p className="text-gray-600 mb-2">{user.email}</p>
                      {user.bio && (
                        <p className="text-gray-700">{user.bio}</p>
                      )}
                      <div className="flex items-center gap-1 mt-3 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        Участник с {new Date(user.createdAt || Date.now()).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <ChefHat className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{stats.totalRecipes}</div>
                <div className="text-sm text-gray-600">Рецептов</div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <Heart className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{stats.totalLikes}</div>
                <div className="text-sm text-gray-600">Лайков</div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <Star className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{stats.avgRating}</div>
                <div className="text-sm text-gray-600">Средний рейтинг</div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <Award className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{stats.totalFavorites}</div>
                <div className="text-sm text-gray-600">В избранном</div>
              </CardContent>
            </Card>
          </div>

          {/* Tab Navigation */}
          <div className="space-y-6">
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg overflow-x-auto">
              <Button
                variant={activeTab === 'recipes' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('recipes')}
                className="flex-1 whitespace-nowrap"
              >
                Мои рецепты
              </Button>
              <Button
                variant={activeTab === 'favorites' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('favorites')}
                className="flex-1 whitespace-nowrap"
              >
                Избранное
              </Button>
              <Button
                variant={activeTab === 'subscription' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('subscription')}
                className="flex-1 whitespace-nowrap"
              >
                Premium
              </Button>
              <Button
                variant="ghost"
                asChild
                className="flex-1 whitespace-nowrap"
              >
                <Link to="/settings">
                  Настройки
                </Link>
              </Button>
            </div>

            {/* My Recipes Tab */}
            {activeTab === 'recipes' && (
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ChefHat className="w-5 h-5 text-orange-600" />
                    Мои рецепты ({userRecipes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userRecipes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {userRecipes.map(recipe => (
                        <Card key={recipe.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                          {recipe.image && (
                            <div className="h-32 overflow-hidden">
                              <img 
                                src={recipe.image} 
                                alt={recipe.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <CardContent className="p-4">
                            <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                              {recipe.title}
                            </h3>
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                              {recipe.description}
                            </p>
                            <div className="flex items-center justify-between text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {recipe.cookTime}
                              </div>
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3" />
                                {recipe.rating.toFixed(1)}
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/recipe/${recipe.id}`)}
                                className="flex-1"
                              >
                                Посмотреть
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {/* Handle edit */}}
                              >
                                <Edit3 className="w-3 h-3" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <ChefHat className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Пока нет рецептов</h3>
                      <p className="text-gray-600 mb-4">Создайте свой первый рецепт!</p>
                      <Button 
                        onClick={() => navigate('/recipes')}
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        Создать рецепт
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Favorites Tab */}
            {activeTab === 'favorites' && (
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-red-600" />
                    Избранные рецепты ({favoriteRecipes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {favoriteRecipes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {favoriteRecipes.map(recipe => (
                        <Card key={recipe.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                          {recipe.image && (
                            <div className="h-32 overflow-hidden">
                              <img 
                                src={recipe.image} 
                                alt={recipe.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <CardContent className="p-4">
                            <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                              {recipe.title}
                            </h3>
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                              {recipe.description}
                            </p>
                            <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {recipe.cookTime}
                              </div>
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3" />
                                {recipe.rating.toFixed(1)}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="w-full bg-orange-500 hover:bg-orange-600"
                              onClick={() => navigate(`/recipe/${recipe.id}`)}
                            >
                              Посмотреть рецепт
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Нет избранных рецептов</h3>
                      <p className="text-gray-600 mb-4">Добавляйте рецепты в избранное, чтобы быстро к ним возвращаться</p>
                      <Button 
                        onClick={() => navigate('/recipes')}
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        Найти рецепты
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Subscription Tab */}
            {activeTab === 'subscription' && (
              <SubscriptionCard />
            )}

          </div>
        </div>
      </div>
    </>
  );
};

export default UserProfile;
