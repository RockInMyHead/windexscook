import { OpenAIService } from '../../src/services/openai.js';

// Мокаем axios
jest.mock('axios');
import axios from 'axios';

describe('OpenAIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('generateRecipe', () => {
    test('should generate recipe from ingredients', async () => {
      const mockResponse = {
        data: {
          choices: [{
            message: {
              content: JSON.stringify({
                title: 'Тестовый рецепт',
                description: 'Описание тестового рецепта',
                ingredients: ['ингредиент1', 'ингредиент2'],
                instructions: ['шаг1', 'шаг2'],
                cookTime: '30 минут',
                servings: '4',
                difficulty: 'easy',
                tips: 'Тестовый совет'
              })
            }
          }]
        }
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      const ingredients = ['картофель', 'лук'];
      const result = await OpenAIService.generateRecipe(ingredients);
      
      expect(result).toBeDefined();
      expect(result.title).toBe('Тестовый рецепт');
      expect(result.ingredients).toContain('ингредиент1');
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/completions'),
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: expect.any(Array)
        }),
        expect.any(Object)
      );
    });
    
    test('should handle API errors', async () => {
      axios.post.mockRejectedValue(new Error('API Error'));
      
      const ingredients = ['картофель'];
      
      await expect(OpenAIService.generateRecipe(ingredients))
        .rejects
        .toThrow('API Error');
    });
  });
  
  describe('chatWithChef', () => {
    test('should chat with chef successfully', async () => {
      const mockResponse = {
        data: {
          choices: [{
            message: {
              content: 'Привет! Как дела?'
            }
          }]
        }
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      const result = await OpenAIService.chatWithChef('Привет!');
      
      expect(result).toBe('Привет! Как дела?');
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/completions'),
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: expect.any(Array)
        }),
        expect.any(Object)
      );
    });
    
    test('should handle chat errors', async () => {
      axios.post.mockRejectedValue(new Error('Chat Error'));
      
      await expect(OpenAIService.chatWithChef('Привет!'))
        .rejects
        .toThrow('Chat Error');
    });
  });
  
  describe('analyzeImage', () => {
    test('should analyze image successfully', async () => {
      const mockResponse = {
        data: {
          choices: [{
            message: {
              content: 'На изображении видны: картофель, лук, морковь'
            }
          }]
        }
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      const imageData = 'base64-image-data';
      const result = await OpenAIService.analyzeImage(imageData);
      
      expect(result).toBe('На изображении видны: картофель, лук, морковь');
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/completions'),
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'image_url'
                })
              ])
            })
          ])
        }),
        expect.any(Object)
      );
    });
    
    test('should handle image analysis errors', async () => {
      axios.post.mockRejectedValue(new Error('Image Analysis Error'));
      
      const imageData = 'invalid-image-data';
      
      await expect(OpenAIService.analyzeImage(imageData))
        .rejects
        .toThrow('Image Analysis Error');
    });
  });
  
  describe('calculateCalories', () => {
    test('should calculate calories successfully', async () => {
      const mockResponse = {
        data: {
          choices: [{
            message: {
              content: JSON.stringify({
                totalCalories: 250,
                breakdown: {
                  'картофель': 100,
                  'лук': 50,
                  'масло': 100
                }
              })
            }
          }]
        }
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      const ingredients = ['картофель 200г', 'лук 100г'];
      const result = await OpenAIService.calculateCalories(ingredients);
      
      expect(result.totalCalories).toBe(250);
      expect(result.breakdown).toBeDefined();
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/completions'),
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: expect.any(Array)
        }),
        expect.any(Object)
      );
    });
    
    test('should handle calorie calculation errors', async () => {
      axios.post.mockRejectedValue(new Error('Calorie Calculation Error'));
      
      const ingredients = ['неизвестный продукт'];
      
      await expect(OpenAIService.calculateCalories(ingredients))
        .rejects
        .toThrow('Calorie Calculation Error');
    });
  });
});
