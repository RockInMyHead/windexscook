import { Recipe, Comment, RecipeFormData, User } from '@/types/recipe';

// Demo recipes for testing
const userRecipes: Recipe[] = [
  {
    id: '1',
    title: 'Спагетти Карбонара',
    description: 'Классический итальянский рецепт с беконом, яйцами и пармезаном',
    ingredients: ['Спагетти - 400г', 'Бекон - 200г', 'Яйца - 4 шт', 'Пармезан - 100г', 'Черный перец - по вкусу'],
    instructions: [
      'Отварите спагетти в подсоленной воде до готовности',
      'Обжарьте бекон на сковороде до хрустящего состояния',
      'Взбейте яйца с тертым пармезаном и черным перцем',
      'Смешайте горячие спагетти с беконом и яичной смесью',
      'Подавайте немедленно с дополнительным пармезаном'
    ],
    cookTime: '20 мин',
    servings: 4,
    difficulty: 'Medium',
    category: 'Итальянская кухня',
    cuisine: 'Итальянская',
    author: {
      id: 'demo-user',
      name: 'Demo Chef',
      email: 'demo@example.com',
      avatar: ''
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rating: 4.5,
    likes: 12,
    favorites: 8,
    commentsCount: 3,
    isLiked: false,
    isFavorited: false,
    status: 'approved'
  },
  {
    id: '2',
    title: 'Тирамису',
    description: 'Нежный итальянский десерт с кофе и маскарпоне',
    ingredients: ['Маскарпоне - 500г', 'Яйца - 4 шт', 'Сахар - 100г', 'Кофе эспрессо - 200мл', 'Печенье савоярди - 200г', 'Какао - 2 ст.л.'],
    instructions: [
      'Приготовьте крепкий кофе и остудите',
      'Взбейте желтки с сахаром до пышности',
      'Добавьте маскарпоне и взбейте до однородности',
      'Взбейте белки отдельно и аккуратно вмешайте в крем',
      'Обмакните печенье в кофе и выложите в форму',
      'Чередуйте слои печенья и крема',
      'Поставьте в холодильник на 4 часа',
      'Перед подачей посыпьте какао'
    ],
    cookTime: '30 мин + 4 часа охлаждение',
    servings: 8,
    difficulty: 'Medium',
    category: 'Десерты',
    cuisine: 'Итальянская',
    author: {
      id: 'demo-user-2',
      name: 'Sweet Chef',
      email: 'sweet@example.com',
      avatar: ''
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rating: 4.8,
    likes: 25,
    favorites: 18,
    commentsCount: 7,
    isLiked: false,
    isFavorited: false,
    status: 'approved'
  },
  {
    id: '3',
    title: 'Борщ украинский',
    description: 'Традиционный украинский борщ с говядиной и сметаной',
    ingredients: ['Говядина - 500г', 'Свекла - 2 шт', 'Капуста - 300г', 'Морковь - 1 шт', 'Лук - 1 шт', 'Помидоры - 2 шт', 'Картофель - 3 шт', 'Сметана - 200г'],
    instructions: [
      'Сварите мясной бульон из говядины',
      'Натрите свеклу и морковь на терке',
      'Обжарьте лук и добавьте овощи',
      'Добавьте томатную пасту и тушите 10 минут',
      'В кипящий бульон добавьте картофель',
      'Через 10 минут добавьте капусту',
      'Добавьте зажарку и варите еще 15 минут',
      'Подавайте со сметаной и зеленью'
    ],
    cookTime: '2 часа',
    servings: 6,
    difficulty: 'Easy',
    category: 'Обеды',
    cuisine: 'Украинская',
    author: {
      id: 'demo-user-3',
      name: 'Ukrainian Chef',
      email: 'ukrainian@example.com',
      avatar: ''
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rating: 4.3,
    likes: 15,
    favorites: 12,
    commentsCount: 5,
    isLiked: false,
    isFavorited: false,
    status: 'approved'
  }
];

const userComments: Comment[] = [
  {
    id: '1',
    recipeId: '1',
    author: {
      id: 'comment-user-1',
      name: 'Food Lover',
      email: 'food@example.com',
      avatar: ''
    },
    content: 'Отличный рецепт! Получилось очень вкусно. Спасибо за подробные инструкции.',
    createdAt: new Date().toISOString(),
    likes: 3,
    isLiked: false
  },
  {
    id: '2',
    recipeId: '1',
    author: {
      id: 'comment-user-2',
      name: 'Italian Fan',
      email: 'italian@example.com',
      avatar: ''
    },
    content: 'Классический карбонара! Добавил немного чеснока для аромата.',
    createdAt: new Date().toISOString(),
    likes: 1,
    isLiked: false
  },
  {
    id: '3',
    recipeId: '2',
    author: {
      id: 'comment-user-3',
      name: 'Dessert Queen',
      email: 'dessert@example.com',
      avatar: ''
    },
    content: 'Тирамису получился идеальным! Семья в восторге.',
    createdAt: new Date().toISOString(),
    likes: 5,
    isLiked: false
  }
];

export class RecipeService {
  private static recipes: Recipe[] = [...userRecipes];
  private static comments: Comment[] = [...userComments];
  private static userLikes: Map<string, Set<string>> = new Map(); // recipeId -> Set of userIds
  private static userFavorites: Map<string, Set<string>> = new Map(); // recipeId -> Set of userIds

  static async getRecipes(filters?: any): Promise<Recipe[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Показываем только одобренные рецепты (исключаем отклоненные и pending)
    let filteredRecipes = [...this.recipes.filter(recipe => 
      recipe.status === 'approved' || 
      (!recipe.status && recipe.status !== 'rejected' && recipe.status !== 'pending')
    )];
    
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
      commentsCount: 0,
      status: 'pending' // Новые рецепты отправляются на модерацию
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
    
    // Initialize user likes set for this recipe if it doesn't exist
    if (!this.userLikes.has(recipeId)) {
      this.userLikes.set(recipeId, new Set());
    }
    
    const userLikes = this.userLikes.get(recipeId)!;
    
    // Check if user already liked this recipe
    if (userLikes.has(userId)) {
      return false; // User already liked this recipe
    }
    
    // Add user to likes and update recipe
    userLikes.add(userId);
    recipe.likes += 1;
    recipe.isLiked = true;
    return true;
  }

  static async unlikeRecipe(recipeId: string, userId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const recipe = this.recipes.find(r => r.id === recipeId);
    if (!recipe) return false;
    
    const userLikes = this.userLikes.get(recipeId);
    if (!userLikes || !userLikes.has(userId)) {
      return false; // User hasn't liked this recipe
    }
    
    // Remove user from likes and update recipe
    userLikes.delete(userId);
    recipe.likes -= 1;
    recipe.isLiked = false;
    return true;
  }

  static async favoriteRecipe(recipeId: string, userId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const recipe = this.recipes.find(r => r.id === recipeId);
    if (!recipe) return false;
    
    // Initialize user favorites set for this recipe if it doesn't exist
    if (!this.userFavorites.has(recipeId)) {
      this.userFavorites.set(recipeId, new Set());
    }
    
    const userFavorites = this.userFavorites.get(recipeId)!;
    
    // Check if user already favorited this recipe
    if (userFavorites.has(userId)) {
      return false; // User already favorited this recipe
    }
    
    // Add user to favorites and update recipe
    userFavorites.add(userId);
    recipe.favorites += 1;
    recipe.isFavorited = true;
    return true;
  }

  static async unfavoriteRecipe(recipeId: string, userId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const recipe = this.recipes.find(r => r.id === recipeId);
    if (!recipe) return false;
    
    const userFavorites = this.userFavorites.get(recipeId);
    if (!userFavorites || !userFavorites.has(userId)) {
      return false; // User hasn't favorited this recipe
    }
    
    // Remove user from favorites and update recipe
    userFavorites.delete(userId);
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

  static async getUserInteractionStatus(recipeId: string, userId: string): Promise<{isLiked: boolean, isFavorited: boolean}> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const userLikes = this.userLikes.get(recipeId);
    const userFavorites = this.userFavorites.get(recipeId);
    
    return {
      isLiked: userLikes ? userLikes.has(userId) : false,
      isFavorited: userFavorites ? userFavorites.has(userId) : false
    };
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

  // Метод для администратора - возвращает все рецепты
  static async getAllRecipes(): Promise<Recipe[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return [...this.recipes];
  }

  // Методы для модерации рецептов
  static async approveRecipe(recipeId: string, moderatorId: string, reason?: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const recipe = this.recipes.find(r => r.id === recipeId);
    if (recipe) {
      recipe.status = 'approved';
      recipe.moderatedBy = moderatorId;
      recipe.moderatedAt = new Date().toISOString();
      recipe.moderationReason = reason;
    }
  }

  static async rejectRecipe(recipeId: string, moderatorId: string, reason: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const recipe = this.recipes.find(r => r.id === recipeId);
    if (recipe) {
      recipe.status = 'rejected';
      recipe.moderatedBy = moderatorId;
      recipe.moderatedAt = new Date().toISOString();
      recipe.moderationReason = reason;
    }
  }
}
