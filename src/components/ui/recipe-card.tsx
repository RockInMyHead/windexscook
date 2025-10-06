import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Heart, 
  Star, 
  Clock, 
  Users, 
  ChefHat, 
  MessageCircle,
  MoreVertical,
  Edit,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Recipe } from '@/types/recipe';

interface RecipeCardProps {
  recipe: Recipe;
  onLike: (recipeId: string) => void;
  onFavorite: (recipeId: string) => void;
  onRate: (recipeId: string, rating: number) => void;
  onView: (recipe: Recipe) => void;
  onEdit?: (recipe: Recipe) => void;
  onDelete?: (recipeId: string) => void;
  currentUserId?: string;
  isAdmin?: boolean;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onLike,
  onFavorite,
  onRate,
  onView,
  onEdit,
  onDelete,
  currentUserId,
  isAdmin
}) => {
  const isAuthor = currentUserId === recipe.author.id;
  const canModerate = isAdmin || isAuthor;
  const difficultyColors = {
    Easy: 'bg-green-100 text-green-800',
    Medium: 'bg-yellow-100 text-yellow-800',
    Hard: 'bg-red-100 text-red-800'
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 lg:w-5 lg:h-5 ${
          i < Math.floor(rating) 
            ? 'text-yellow-400 fill-current' 
            : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
      <div className="relative">
        {recipe.image && (
          <div className="aspect-video w-full overflow-hidden rounded-t-lg">
            <img
              src={recipe.image}
              alt={recipe.title}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
        
        {/* Author/Admin actions */}
        {canModerate && (
          <div className="absolute top-2 right-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/80 hover:bg-white">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isAdmin && !isAuthor && (
                  <div className="px-2 py-1.5 text-xs font-semibold text-amber-600">
                    👑 Модератор
                  </div>
                )}
                {onEdit && isAuthor && (
                  <DropdownMenuItem onClick={() => onEdit(recipe)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Редактировать
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(recipe.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isAdmin && !isAuthor ? 'Удалить (админ)' : 'Удалить'}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <CardHeader className="pb-3 p-4 sm:p-6 lg:p-8">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base sm:text-lg lg:text-xl font-semibold line-clamp-2 group-hover:text-primary transition-colors flex-1 min-w-0">
            {recipe.title}
          </CardTitle>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {renderStars(recipe.rating)}
            <span className="text-xs sm:text-sm lg:text-base text-muted-foreground ml-1">
              ({recipe.rating.toFixed(1)})
            </span>
          </div>
        </div>
        
        <p className="text-xs sm:text-sm lg:text-base text-muted-foreground line-clamp-2 mt-2">
          {recipe.description}
        </p>
      </CardHeader>

      <CardContent className="space-y-3 sm:space-y-4 lg:space-y-5 p-4 sm:p-6 lg:p-8 pt-0 flex-1 flex flex-col">
        {/* Recipe info */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 lg:gap-6 text-xs sm:text-sm lg:text-base text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
            <span>{recipe.cookTime}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
            <span>{recipe.servings} порций</span>
          </div>
          <div className="flex items-center gap-1">
            <ChefHat className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
            <span>{recipe.ingredients.length} ингр.</span>
          </div>
        </div>

        {/* Category and difficulty */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-2 lg:gap-3">
          <Badge variant="secondary" className="text-xs sm:text-sm px-2 py-1 lg:px-3 lg:py-1.5">
            {recipe.category}
          </Badge>
          <Badge className={`text-xs sm:text-sm px-2 py-1 lg:px-3 lg:py-1.5 ${difficultyColors[recipe.difficulty]}`}>
            {recipe.difficulty}
          </Badge>
        </div>

        {/* Author info */}
        <div className="flex items-center gap-2 lg:gap-3">
          <Avatar className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7">
            <AvatarImage src={recipe.author.avatar} alt={recipe.author.name} />
            <AvatarFallback className="text-xs sm:text-sm">
              {recipe.author.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs sm:text-sm lg:text-base text-muted-foreground truncate">
            {recipe.author.name}
          </span>
          <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0">
            • {new Date(recipe.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Stats and actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 text-xs sm:text-sm lg:text-base text-muted-foreground">
            <div className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
              <span>{recipe.commentsCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
              <span>{recipe.likes}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
              <span>{recipe.favorites}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 lg:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onLike(recipe.id)}
              className={`h-7 sm:h-8 lg:h-9 px-1 sm:px-2 lg:px-3 text-xs sm:text-sm lg:text-base ${
                recipe.isLiked 
                  ? 'text-red-500 hover:text-red-600' 
                  : 'text-muted-foreground hover:text-red-500'
              }`}
            >
              <Heart className={`w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 mr-1 ${recipe.isLiked ? 'fill-current' : ''}`} />
              {recipe.likes}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFavorite(recipe.id)}
              className={`h-7 sm:h-8 lg:h-9 px-1 sm:px-2 lg:px-3 text-xs sm:text-sm lg:text-base ${
                recipe.isFavorited 
                  ? 'text-yellow-500 hover:text-yellow-600' 
                  : 'text-muted-foreground hover:text-yellow-500'
              }`}
            >
              <Star className={`w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 mr-1 ${recipe.isFavorited ? 'fill-current' : ''}`} />
              {recipe.favorites}
            </Button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 lg:gap-3 mt-auto">
          <Button
            onClick={() => onView(recipe)}
            className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity text-xs sm:text-sm lg:text-base h-8 sm:h-10 lg:h-12"
          >
            <span className="hidden sm:inline">Посмотреть рецепт</span>
            <span className="sm:hidden">Смотреть</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};