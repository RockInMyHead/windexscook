import { RecipeService } from '../../src/services/recipeService.js';

// Мокаем localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

describe('RecipeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Сбрасываем состояние сервиса
    RecipeService.recipes = [];
    RecipeService.userRecipes = [];
  });
  
  describe('getRecipes', () => {
    test('should return recipes with filters', async () => {
      // Добавляем тестовые рецепты
      RecipeService.recipes = [
        {
          id: '1',
          title: 'Тестовый рецепт 1',
          cuisine: 'italian',
          difficulty: 'easy',
          status: 'approved'
        },
        {
          id: '2',
          title: 'Тестовый рецепт 2',
          cuisine: 'french',
          difficulty: 'hard',
          status: 'approved'
        }
      ];
      
      const result = await RecipeService.getRecipes({ cuisine: 'italian' });
      
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Тестовый рецепт 1');
    });
    
    test('should return all recipes when no filters', async () => {
      RecipeService.recipes = [
        { id: '1', title: 'Рецепт 1', status: 'approved' },
        { id: '2', title: 'Рецепт 2', status: 'approved' }
      ];
      
      const result = await RecipeService.getRecipes();
      
      expect(result).toHaveLength(2);
    });
    
    test('should filter out pending and rejected recipes', async () => {
      RecipeService.recipes = [
        { id: '1', title: 'Одобренный', status: 'approved' },
        { id: '2', title: 'Ожидает', status: 'pending' },
        { id: '3', title: 'Отклонен', status: 'rejected' },
        { id: '4', title: 'Без статуса', status: undefined }
      ];
      
      const result = await RecipeService.getRecipes();
      
      expect(result).toHaveLength(2);
      expect(result.find(r => r.title === 'Одобренный')).toBeDefined();
      expect(result.find(r => r.title === 'Без статуса')).toBeDefined();
    });
  });
  
  describe('createRecipe', () => {
    test('should create new recipe with pending status', async () => {
      const recipeData = {
        title: 'Новый рецепт',
        description: 'Описание',
        ingredients: ['ингредиент1'],
        instructions: ['шаг1'],
        cookTime: '30 мин',
        servings: '4',
        difficulty: 'easy'
      };
      
      const author = {
        id: 'user1',
        name: 'Тестовый пользователь',
        email: 'test@example.com'
      };
      
      const result = await RecipeService.createRecipe(recipeData, author);
      
      expect(result).toBeDefined();
      expect(result.title).toBe('Новый рецепт');
      expect(result.status).toBe('pending');
      expect(result.author).toEqual(author);
      expect(RecipeService.recipes).toHaveLength(1);
    });
  });
  
  describe('getAllRecipes', () => {
    test('should return all recipes including pending and rejected', async () => {
      RecipeService.recipes = [
        { id: '1', title: 'Одобренный', status: 'approved' },
        { id: '2', title: 'Ожидает', status: 'pending' },
        { id: '3', title: 'Отклонен', status: 'rejected' }
      ];
      
      const result = await RecipeService.getAllRecipes();
      
      expect(result).toHaveLength(3);
    });
  });
  
  describe('approveRecipe', () => {
    test('should approve recipe and set moderation details', async () => {
      const recipe = {
        id: '1',
        title: 'Тестовый рецепт',
        status: 'pending'
      };
      
      RecipeService.recipes = [recipe];
      
      const moderatorId = 'admin1';
      const result = await RecipeService.approveRecipe('1', moderatorId);
      
      expect(result.status).toBe('approved');
      expect(result.moderatedBy).toBe(moderatorId);
      expect(result.moderatedAt).toBeDefined();
    });
    
    test('should throw error if recipe not found', async () => {
      await expect(RecipeService.approveRecipe('nonexistent', 'admin1'))
        .rejects
        .toThrow('Рецепт не найден');
    });
  });
  
  describe('rejectRecipe', () => {
    test('should reject recipe with reason', async () => {
      const recipe = {
        id: '1',
        title: 'Тестовый рецепт',
        status: 'pending'
      };
      
      RecipeService.recipes = [recipe];
      
      const moderatorId = 'admin1';
      const reason = 'Не подходит по содержанию';
      
      const result = await RecipeService.rejectRecipe('1', moderatorId, reason);
      
      expect(result.status).toBe('rejected');
      expect(result.moderatedBy).toBe(moderatorId);
      expect(result.moderationReason).toBe(reason);
      expect(result.moderatedAt).toBeDefined();
    });
    
    test('should throw error if recipe not found', async () => {
      await expect(RecipeService.rejectRecipe('nonexistent', 'admin1', 'reason'))
        .rejects
        .toThrow('Рецепт не найден');
    });
  });
  
  describe('getUserRecipes', () => {
    test('should return user recipes', async () => {
      const userId = 'user1';
      RecipeService.userRecipes = [
        { id: '1', title: 'Рецепт 1', author: { id: userId } },
        { id: '2', title: 'Рецепт 2', author: { id: 'user2' } }
      ];
      
      const result = await RecipeService.getUserRecipes(userId);
      
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Рецепт 1');
    });
  });
  
  describe('deleteRecipe', () => {
    test('should delete recipe', async () => {
      const recipe = { id: '1', title: 'Тестовый рецепт' };
      RecipeService.recipes = [recipe];
      
      await RecipeService.deleteRecipe('1');
      
      expect(RecipeService.recipes).toHaveLength(0);
    });
    
    test('should throw error if recipe not found', async () => {
      await expect(RecipeService.deleteRecipe('nonexistent'))
        .rejects
        .toThrow('Рецепт не найден');
    });
  });
});
