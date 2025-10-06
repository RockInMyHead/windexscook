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
        className={`w-4 h-4 ${
          i < Math.floor(rating) 
            ? 'text-yellow-400 fill-current' 
            : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
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

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold line-clamp-2 group-hover:text-primary transition-colors">
            {recipe.title}
          </CardTitle>
          <div className="flex items-center gap-1 ml-2">
            {renderStars(recipe.rating)}
            <span className="text-sm text-muted-foreground ml-1">
              ({recipe.rating.toFixed(1)})
            </span>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2">
          {recipe.description}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Recipe info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
        </div>

        {/* Category and difficulty */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {recipe.category}
          </Badge>
          <Badge className={`text-xs ${difficultyColors[recipe.difficulty]}`}>
            {recipe.difficulty}
          </Badge>
        </div>

        {/* Author info */}
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={recipe.author.avatar} alt={recipe.author.name} />
            <AvatarFallback className="text-xs">
              {recipe.author.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">
            {recipe.author.name}
          </span>
          <span className="text-xs text-muted-foreground">
            • {new Date(recipe.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Stats and actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MessageCircle className="w-4 h-4" />
              <span>{recipe.commentsCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              <span>{recipe.likes}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4" />
              <span>{recipe.favorites}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onLike(recipe.id)}
              className={`h-8 px-2 ${
                recipe.isLiked 
                  ? 'text-red-500 hover:text-red-600' 
                  : 'text-muted-foreground hover:text-red-500'
              }`}
            >
              <Heart className={`w-4 h-4 mr-1 ${recipe.isLiked ? 'fill-current' : ''}`} />
              {recipe.likes}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFavorite(recipe.id)}
              className={`h-8 px-2 ${
                recipe.isFavorited 
                  ? 'text-yellow-500 hover:text-yellow-600' 
                  : 'text-muted-foreground hover:text-yellow-500'
              }`}
            >
              <Star className={`w-4 h-4 mr-1 ${recipe.isFavorited ? 'fill-current' : ''}`} />
              {recipe.favorites}
            </Button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => onView(recipe)}
            className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity"
          >
            Посмотреть рецепт
          </Button>
          
          {/* Rating buttons */}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((rating) => (
              <Button
                key={rating}
                variant="ghost"
                size="sm"
                onClick={() => onRate(recipe.id, rating)}
                className="h-8 w-8 p-0 hover:bg-yellow-50"
              >
                <Star className={`w-4 h-4 ${
                  rating <= recipe.rating 
                    ? 'text-yellow-400 fill-current' 
                    : 'text-gray-300'
                }`} />
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};