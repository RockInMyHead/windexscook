export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  createdAt?: string;
  role?: 'user' | 'admin';
  subscription?: {
    active: boolean;
    expiresAt?: string;
    plan: 'free' | 'premium';
  };
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  image?: string;
  cookTime: string;
  servings: number;
  difficulty: "Easy" | "Medium" | "Hard";
  category: string;
  cuisine?: string;
  ingredients: string[];
  instructions: string[];
  tips?: string;
  author: User;
  createdAt: string;
  updatedAt: string;
  rating: number;
  likes: number;
  favorites: number;
  commentsCount: number;
  isLiked?: boolean;
  isFavorited?: boolean;
}

export interface Comment {
  id: string;
  recipeId: string;
  author: User;
  content: string;
  createdAt: string;
  likes: number;
  isLiked?: boolean;
}

export interface RecipeFilters {
  category: string;
  difficulty: string;
  cookTime: string;
  rating: string;
  search: string;
}

export interface RecipeFormData {
  title: string;
  description: string;
  image?: string;
  cookTime: string;
  servings: number;
  difficulty: "Easy" | "Medium" | "Hard";
  category: string;
  cuisine?: string;
  ingredients: string[];
  instructions: string[];
  tips?: string;
}
