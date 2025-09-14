import { Recipe, Comment, RecipeFormData, User } from '@/types/recipe';

// Mock data for development
const mockRecipes: Recipe[] = [
  {
    id: '1',
    title: 'Паста Карбонара',
    description: 'Классическая итальянская паста с беконом, яйцами и пармезаном',
    image: '/placeholder.svg',
    cookTime: '20 мин',
    servings: 4,
    difficulty: 'Medium',
    category: 'Итальянская кухня',
    ingredients: ['Спагетти - 400г', 'Бекон - 200г', 'Яйца - 4 шт', 'Пармезан - 100г', 'Чеснок - 2 зубчика'],
    instructions: [
      'Отварите спагетти в подсоленной воде до состояния аль денте',
      'Обжарьте бекон на сковороде до хрустящего состояния',
      'Взбейте яйца с тертым пармезаном',
      'Смешайте горячие спагетти с беконом',
      'Добавьте яично-сырную смесь, быстро перемешайте'
    ],
    tips: 'Подавайте сразу же, пока паста горячая',
    author: {
      id: '1',
      name: 'Мария Иванова',
      email: 'maria@example.com'
    },
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    rating: 4.5,
    likes: 23,
    favorites: 15,
    commentsCount: 8
  },
  {
    id: '2',
    title: 'Тирамису',
    description: 'Нежный итальянский десерт с кофе и маскарпоне',
    image: '/placeholder.svg',
    cookTime: '30 мин + охлаждение',
    servings: 6,
    difficulty: 'Easy',
    category: 'Десерты',
    ingredients: ['Маскарпоне - 500г', 'Яйца - 4 шт', 'Сахар - 100г', 'Кофе - 200мл', 'Печенье савоярди - 200г', 'Какао - 2 ст.л.'],
    instructions: [
      'Приготовьте крепкий кофе и остудите',
      'Отделите желтки от белков',
      'Взбейте желтки с сахаром до белого цвета',
      'Добавьте маскарпоне к желткам',
      'Взбейте белки в крепкую пену',
      'Осторожно смешайте белки с кремом',
      'Обмакните печенье в кофе',
      'Выложите слоями печенье и крем',
      'Посыпьте какао и охладите 4 часа'
    ],
    tips: 'Лучше готовить за день до подачи',
    author: {
      id: '2',
      name: 'Анна Петрова',
      email: 'anna@example.com'
    },
    createdAt: '2024-01-14T15:30:00Z',
    updatedAt: '2024-01-14T15:30:00Z',
    rating: 4.8,
    likes: 45,
    favorites: 32,
    commentsCount: 12
  }
];

const mockComments: Comment[] = [
  {
    id: '1',
    recipeId: '1',
    author: {
      id: '3',
      name: 'Иван Сидоров',
      email: 'ivan@example.com'
    },
    content: 'Отличный рецепт! Получилось очень вкусно, спасибо!',
    createdAt: '2024-01-16T09:00:00Z',
    likes: 5
  },
  {
    id: '2',
    recipeId: '1',
    author: {
      id: '4',
      name: 'Елена Козлова',
      email: 'elena@example.com'
    },
    content: 'Попробовала с курицей вместо бекона - тоже очень вкусно!',
    createdAt: '2024-01-16T14:20:00Z',
    likes: 3
  }
];

export class RecipeService {
  private static recipes: Recipe[] = [...mockRecipes];
  private static comments: Comment[] = [...mockComments];

  static async getRecipes(filters?: any): Promise<Recipe[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    let filteredRecipes = [...this.recipes];
    
    if (filters) {
      if (filters.category && filters.category !== 'all') {
        filteredRecipes = filteredRecipes.filter(r => r.category === filters.category);
      }
      if (filters.difficulty && filters.difficulty !== 'all') {
        filteredRecipes = filteredRecipes.filter(r => r.difficulty === filters.difficulty);
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        filteredRecipes = filteredRecipes.filter(r => 
          r.title.toLowerCase().includes(search) ||
          r.description.toLowerCase().includes(search) ||
          r.ingredients.some(ing => ing.toLowerCase().includes(search))
        );
      }
    }
    
    return filteredRecipes.sort((a, b) => b.rating - a.rating);
  }

  static async getRecipe(id: string): Promise<Recipe | null> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return this.recipes.find(r => r.id === id) || null;
  }

  static async createRecipe(recipeData: RecipeFormData, author: User): Promise<Recipe> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newRecipe: Recipe = {
      id: Date.now().toString(),
      ...recipeData,
      author,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rating: 0,
      likes: 0,
      favorites: 0,
      commentsCount: 0
    };
    
    this.recipes.unshift(newRecipe);
    return newRecipe;
  }

  static async updateRecipe(id: string, recipeData: Partial<RecipeFormData>): Promise<Recipe | null> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const index = this.recipes.findIndex(r => r.id === id);
    if (index === -1) return null;
    
    this.recipes[index] = {
      ...this.recipes[index],
      ...recipeData,
      updatedAt: new Date().toISOString()
    };
    
    return this.recipes[index];
  }

  static async deleteRecipe(id: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const index = this.recipes.findIndex(r => r.id === id);
    if (index === -1) return false;
    
    this.recipes.splice(index, 1);
    return true;
  }

  static async likeRecipe(recipeId: string, userId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const recipe = this.recipes.find(r => r.id === recipeId);
    if (!recipe) return false;
    
    recipe.likes += 1;
    recipe.isLiked = true;
    return true;
  }

  static async unlikeRecipe(recipeId: string, userId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const recipe = this.recipes.find(r => r.id === recipeId);
    if (!recipe) return false;
    
    recipe.likes -= 1;
    recipe.isLiked = false;
    return true;
  }

  static async favoriteRecipe(recipeId: string, userId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const recipe = this.recipes.find(r => r.id === recipeId);
    if (!recipe) return false;
    
    recipe.favorites += 1;
    recipe.isFavorited = true;
    return true;
  }

  static async unfavoriteRecipe(recipeId: string, userId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const recipe = this.recipes.find(r => r.id === recipeId);
    if (!recipe) return false;
    
    recipe.favorites -= 1;
    recipe.isFavorited = false;
    return true;
  }

  static async rateRecipe(recipeId: string, userId: string, rating: number): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const recipe = this.recipes.find(r => r.id === recipeId);
    if (!recipe) return false;
    
    // Simple average calculation (in real app would be more complex)
    recipe.rating = (recipe.rating + rating) / 2;
    return true;
  }

  static async getComments(recipeId: string): Promise<Comment[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return this.comments.filter(c => c.recipeId === recipeId);
  }

  static async addComment(recipeId: string, content: string, author: User): Promise<Comment> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const newComment: Comment = {
      id: Date.now().toString(),
      recipeId,
      author,
      content,
      createdAt: new Date().toISOString(),
      likes: 0
    };
    
    this.comments.push(newComment);
    
    // Update comment count
    const recipe = this.recipes.find(r => r.id === recipeId);
    if (recipe) {
      recipe.commentsCount += 1;
    }
    
    return newComment;
  }

  static async likeComment(commentId: string, userId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const comment = this.comments.find(c => c.id === commentId);
    if (!comment) return false;
    
    comment.likes += 1;
    comment.isLiked = true;
    return true;
  }

  static getCategories(): string[] {
    return ['Все категории', 'Итальянская кухня', 'Десерты', 'Завтраки', 'Обеды', 'Ужины', 'Закуски', 'Напитки'];
  }
}
