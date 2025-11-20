import { OpenAIService } from '../../src/services/openai.js';
import { RecipeService } from '../../src/services/recipeService.js';

// Мокаем fetch для тестов
global.fetch = jest.fn();

describe('Backend Services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('OpenAIService', () => {
    describe('generateRecipe', () => {
      test('should generate recipe from ingredients', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  title: 'Тестовый рецепт',
                  ingredients: ['картофель 500г', 'лук 1 шт'],
                  instructions: ['Нарежьте картофель', 'Обжарьте лук'],
                  cookTime: '30 мин',
                  servings: 4,
                  difficulty: 'Easy'
                })
              }
            }]
          })
        };
        
        fetch.mockResolvedValue(mockResponse);
        
        const ingredients = ['картофель', 'лук', 'морковь'];
        const result = await OpenAIService.generateRecipe(ingredients);
        
        expect(result).toBeDefined();
        expect(result.title).toBe('Тестовый рецепт');
        expect(result.ingredients).toContain('картофель 500г');
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/openai/v1/chat/completions'),
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          })
        );
      });
      
      test('should handle API errors', async () => {
        fetch.mockRejectedValue(new Error('API Error'));
        
        const ingredients = ['картофель'];
        
        await expect(OpenAIService.generateRecipe(ingredients))
          .rejects
          .toThrow('Не удалось сгенерировать рецепт. Попробуйте еще раз.');
      });
    });
    
    describe('chatWithChef', () => {
      test('should chat with chef successfully', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: 'Здравствуйте! Я готов помочь вам с кулинарными вопросами.'
              }
            }]
          })
        };
        
        fetch.mockResolvedValue(mockResponse);
        
        const message = 'Как приготовить борщ?';
        const result = await OpenAIService.chatWithChef(message);

        expect(result).toBeDefined();
        expect(result.content).toContain('Здравствуйте!');
        expect(result.usage).toBeDefined();
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/openai/v1/chat/completions'),
          expect.objectContaining({
            method: 'POST'
          })
        );
      });
      
      test('should handle chat errors', async () => {
        fetch.mockRejectedValue(new Error('Chat Error'));
        
        const message = 'Как приготовить борщ?';
        
        await expect(OpenAIService.chatWithChef(message))
          .rejects
          .toThrow('Извините, произошла ошибка при обработке вашего сообщения. Попробуйте еще раз.');
      });
    });
    
    describe('analyzeImage', () => {
      test('should analyze image successfully', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: 'На изображении видны: картофель, лук, морковь'
              }
            }]
          })
        };
        
        fetch.mockResolvedValue(mockResponse);
        
        const imageData = 'base64-image-data';
        const result = await OpenAIService.analyzeImage(imageData);
        
        expect(result).toBeDefined();
        expect(result).toContain('картофель');
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/openai/v1/chat/completions'),
          expect.objectContaining({
            method: 'POST'
          })
        );
      });
      
      test('should handle image analysis errors', async () => {
        fetch.mockRejectedValue(new Error('Image Analysis Error'));
        
        const imageData = 'invalid-image-data';
        
        await expect(OpenAIService.analyzeImage(imageData))
          .rejects
          .toThrow('Извините, произошла ошибка при обработке вашего сообщения. Попробуйте еще раз.');
      });
    });
    
    describe('calculateCalories', () => {
      test('should calculate calories successfully', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  totalCalories: 250,
                  breakdown: {
                    'картофель': 100,
                    'лук': 50,
                    'морковь': 100
                  }
                })
              }
            }]
          })
        };
        
        fetch.mockResolvedValue(mockResponse);
        
        const ingredients = ['картофель 200г', 'лук 100г'];
        const result = await OpenAIService.calculateCalories(ingredients);
        
        expect(result).toBeDefined();
        expect(result.totalCalories).toBe(250);
        expect(result.breakdown).toBeDefined();
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/openai/v1/chat/completions'),
          expect.objectContaining({
            method: 'POST'
          })
        );
      });
      
      test('should handle calorie calculation errors', async () => {
        fetch.mockRejectedValue(new Error('Calorie Calculation Error'));
        
        const ingredients = ['неизвестный продукт'];
        
        await expect(OpenAIService.calculateCalories(ingredients))
          .rejects
          .toThrow('Извините, произошла ошибка при обработке вашего сообщения. Попробуйте еще раз.');
      });
    });
  });
  
  describe('RecipeService', () => {
    describe('getRecipes', () => {
      test('should return recipes with filters', async () => {
        const result = await RecipeService.getRecipes({ cuisine: 'italian' });
        
        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('title');
      });
      
      test('should return all recipes when no filters', async () => {
        const result = await RecipeService.getRecipes();
        
        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBeGreaterThan(0);
      });
      
      test('should filter out pending and rejected recipes', async () => {
        const result = await RecipeService.getRecipes();
        
        result.forEach(recipe => {
          expect(recipe.status).not.toBe('pending');
          expect(recipe.status).not.toBe('rejected');
        });
      });
    });
    
    describe('createRecipe', () => {
      test('should create new recipe with pending status', async () => {
        const newRecipe = {
          title: 'Тестовый рецепт',
          ingredients: ['тест 1'],
          instructions: ['инструкция 1'],
          cookTime: '30 мин',
          servings: 2,
          difficulty: 'Easy',
          category: 'Тест',
          cuisine: 'test'
        };
        
        const result = await RecipeService.createRecipe(newRecipe);
        
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.status).toBe('pending');
        expect(result.title).toBe('Тестовый рецепт');
      });
    });
    
    describe('getAllRecipes', () => {
      test('should return all recipes including pending and rejected', async () => {
        const result = await RecipeService.getAllRecipes();
        
        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBeGreaterThan(0);
        
        // Проверяем, что есть рецепты с разными статусами
        const statuses = result.map(r => r.status);
        expect(statuses).toContain('approved');
      });
    });
    
    describe('approveRecipe', () => {
      test('should approve recipe and set moderation details', async () => {
        const moderatorId = 'admin-1';
        const result = await RecipeService.approveRecipe('1', moderatorId);
        
        expect(result).toBeDefined();
        expect(result.status).toBe('approved');
        expect(result.moderatedBy).toBe(moderatorId);
        expect(result.moderatedAt).toBeDefined();
      });
      
      test('should throw error if recipe not found', async () => {
        const moderatorId = 'admin-1';
        
        await expect(RecipeService.approveRecipe('nonexistent', moderatorId))
          .rejects
          .toThrow('Рецепт не найден');
      });
    });
    
    describe('rejectRecipe', () => {
      test('should reject recipe with reason', async () => {
        const moderatorId = 'admin-1';
        const reason = 'Некачественный контент';
        const result = await RecipeService.rejectRecipe('1', moderatorId, reason);
        
        expect(result).toBeDefined();
        expect(result.status).toBe('rejected');
        expect(result.moderatedBy).toBe(moderatorId);
        expect(result.moderationReason).toBe(reason);
        expect(result.moderatedAt).toBeDefined();
      });
      
      test('should throw error if recipe not found', async () => {
        const moderatorId = 'admin-1';
        const reason = 'Тест';
        
        await expect(RecipeService.rejectRecipe('nonexistent', moderatorId, reason))
          .rejects
          .toThrow('Рецепт не найден');
      });
    });
    
    describe('deleteRecipe', () => {
      test('should delete recipe', async () => {
        const result = await RecipeService.deleteRecipe('1');
        
        expect(result).toBe(true);
      });
      
      test('should throw error if recipe not found', async () => {
        await expect(RecipeService.deleteRecipe('nonexistent'))
          .rejects
          .toThrow('Рецепт не найден');
      });
    });
  });
  
});
