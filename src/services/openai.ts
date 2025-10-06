import { UserHealthProfile } from '../types/health';
import { WORLD_CUISINES } from '../types/cuisine';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";
// Guard to ensure API key is provided
if (!OPENAI_API_KEY) {
  console.warn("OpenAI API key not found in environment variables. API calls will be proxied through server.");
}

export interface Recipe {
  title: string;
  description: string;
  cookTime: string;
  servings: number;
  difficulty: "Easy" | "Medium" | "Hard";
  cuisine?: string;
  ingredients: string[];
  instructions: string[];
  tips?: string;
}

export class OpenAIService {
  private static async makeRequest(messages: any[], model: string = 'gpt-4o-mini') {
    // Используем прокси через сервер вместо прямого обращения к API
    const response = await fetch('/api/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.8,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error Details:', errorText);
      
      // Пытаемся распарсить JSON ошибку
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error && errorData.error.code === 'regional_restriction') {
          throw new Error('AI функции временно недоступны в вашем регионе. Мы работаем над решением этой проблемы.');
        }
      } catch (parseError) {
        // Если не удалось распарсить JSON, используем стандартную ошибку
      }
      
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  static async generateRecipe(ingredients: string[], healthProfile?: UserHealthProfile, cuisineId?: string): Promise<Recipe> {
    let healthConstraints = '';
    let cuisineConstraints = '';
    
    if (healthProfile) {
      const constraints = [];
      
      // Добавляем ограничения по состояниям здоровья
      if (healthProfile.conditions.length > 0) {
        constraints.push(`Состояния здоровья: ${healthProfile.conditions.map(c => c.name).join(', ')}`);
        healthProfile.conditions.forEach(condition => {
          constraints.push(`Ограничения при ${condition.name}: ${condition.restrictions.join(', ')}`);
          constraints.push(`Рекомендации при ${condition.name}: ${condition.recommendations.join(', ')}`);
        });
      }
      
      // Добавляем диетические ограничения
      if (healthProfile.dietaryRestrictions.length > 0) {
        constraints.push(`Диетические предпочтения: ${healthProfile.dietaryRestrictions.join(', ')}`);
      }
      
      // Добавляем аллергии
      if (healthProfile.allergies.length > 0) {
        constraints.push(`Аллергии и непереносимости: ${healthProfile.allergies.join(', ')}`);
      }
      
      // Добавляем дополнительные заметки
      if (healthProfile.notes) {
        constraints.push(`Дополнительные требования: ${healthProfile.notes}`);
      }
      
      if (constraints.length > 0) {
        healthConstraints = `

ВАЖНО! Учитывай следующие особенности здоровья пользователя:
${constraints.join('\n')}

Рецепт должен быть адаптирован под эти требования. Избегай запрещенных продуктов и используй рекомендуемые ингредиенты.`;
      }
    }

    if (cuisineId) {
      const cuisine = WORLD_CUISINES.find(c => c.id === cuisineId);
      if (cuisine) {
        const isHalal = cuisine.id.startsWith('halal-');
        const halalNote = isHalal ? `

ХАЛЯЛЬ ТРЕБОВАНИЯ:
- Используй только халяльное мясо (курица, говядина, баранина)
- Исключи свинину и все продукты из свинины
- Не используй алкоголь в любом виде
- Убедись, что все ингредиенты халяльные
- Избегай желатина животного происхождения (кроме халяльного)` : '';

        cuisineConstraints = `

КУХНЯ: ${cuisine.name} ${cuisine.flag}
Описание: ${cuisine.description}
Характеристики: ${cuisine.characteristics.join(', ')}
Популярные блюда: ${cuisine.popularDishes.join(', ')}${halalNote}

ВАЖНО! Создай аутентичный рецепт в стиле ${cuisine.name} кухни. Используй традиционные ингредиенты, техники приготовления и вкусовые сочетания, характерные для этой кухни.`;
      }
    }

    const prompt = `Создай уникальный рецепт ИСКЛЮЧИТЕЛЬНО на основе следующих ингредиентов, которые есть у пользователя: ${ingredients.join(', ')}.${healthConstraints}${cuisineConstraints}

КРИТИЧЕСКИ ВАЖНО:
- Используй ТОЛЬКО ингредиенты из списка выше
- НЕ добавляй никаких дополнительных ингредиентов, которых нет у пользователя
- Если нужно, можешь добавить только базовые специи (соль, перец, масло), которые обычно есть на кухне
- Все основные ингредиенты должны быть из предоставленного списка

Требования:
- Название блюда должно быть креативным и привлекательным
- Опиши блюдо в 1-2 предложениях
- Укажи время приготовления в минутах
- Количество порций: 2-4
- Сложность: Easy/Medium/Hard
- Список ингредиентов с количествами (только из вашего списка + базовые специи)
- Пошаговые инструкции приготовления
- Полезный совет от шеф-повара
${healthProfile ? '- Учитывай все ограничения по здоровью пользователя' : ''}
${cuisineId ? '- Создай аутентичный рецепт в выбранном стиле кухни' : ''}

Ответь в формате JSON:
{
  "title": "Название блюда",
  "description": "Описание блюда",
  "cookTime": "25 мин",
  "servings": 4,
  "difficulty": "Medium",
  "cuisine": "${cuisineId || ''}",
  "ingredients": ["ингредиент 1 - 200г", "ингредиент 2 - 1 шт"],
  "instructions": ["Шаг 1", "Шаг 2", "Шаг 3"],
  "tips": "Совет от шеф-повара"
}`;

    try {
      const response = await this.makeRequest([
        {
          role: "system",
          content: "Ты - профессиональный шеф-повар с 20-летним опытом. Твоя задача - создавать рецепты ИСКЛЮЧИТЕЛЬНО из ингредиентов, которые есть у пользователя. НЕ добавляй ингредиенты, которых нет в списке пользователя. Можешь добавить только базовые специи (соль, перец, растительное масло). Создавай креативные, вкусные и практичные рецепты. Всегда отвечай в формате JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ]);

      // Парсим JSON ответ
      const recipeData = JSON.parse(response);
      
      // Валидируем и форматируем данные
      const validatedIngredients = recipeData.ingredients || ingredients;
      
      // Проверяем, что рецепт использует только предоставленные ингредиенты
      const basicSpices = ['соль', 'перец', 'масло', 'растительное масло', 'оливковое масло', 'подсолнечное масло'];
      const allowedIngredients = [...ingredients, ...basicSpices];
      
      const filteredIngredients = validatedIngredients.filter(ingredient => {
        const ingredientName = ingredient.toLowerCase().split(' - ')[0].trim();
        return allowedIngredients.some(allowed => 
          ingredientName.includes(allowed.toLowerCase()) || 
          allowed.toLowerCase().includes(ingredientName)
        );
      });

      return {
        title: recipeData.title || "Вкусное блюдо",
        description: recipeData.description || "Ароматное и аппетитное блюдо",
        cookTime: recipeData.cookTime || "30 мин",
        servings: recipeData.servings || 4,
        difficulty: recipeData.difficulty || "Medium",
        cuisine: recipeData.cuisine || cuisineId || undefined,
        ingredients: filteredIngredients.length > 0 ? filteredIngredients : ingredients,
        instructions: recipeData.instructions || ["Приготовьте блюдо по традиционному рецепту"],
        tips: recipeData.tips || "Подавайте горячим!"
      };
    } catch (error) {
      console.error('Error generating recipe:', error);
      throw new Error('Не удалось сгенерировать рецепт. Попробуйте еще раз.');
    }
  }

  static async generateRecipeVariations(ingredients: string[], healthProfile?: UserHealthProfile, cuisineId?: string): Promise<Recipe[]> {
    const variations = [];
    
    for (let i = 0; i < 3; i++) {
      try {
        const recipe = await this.generateRecipe(ingredients, healthProfile, cuisineId);
        variations.push(recipe);
      } catch (error) {
        console.error(`Error generating variation ${i + 1}:`, error);
      }
    }
    
    return variations;
  }

  static async recognizeIngredientsFromImage(imageFile: File): Promise<string[]> {
    try {
      // Конвертируем файл в base64
      const base64Image = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Убираем data:image/jpeg;base64,
        };
        reader.readAsDataURL(imageFile);
      });

      const response = await this.makeRequest([
        {
          role: "system",
          content: "Ты - эксперт по распознаванию продуктов питания. Анализируй изображения и определяй все видимые продукты, ингредиенты и еду. Отвечай только списком продуктов на русском языке, разделенных запятыми."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Какие продукты питания ты видишь на этом изображении? Перечисли все продукты, которые можно использовать для приготовления еды. Отвечай только названиями продуктов через запятую."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ], 'gpt-4-turbo');

      // Парсим ответ и извлекаем продукты
      const ingredients = response
        .split(',')
        .map((item: string) => item.trim())
        .filter((item: string) => item.length > 0);

      return ingredients;
    } catch (error) {
      console.error('Error recognizing ingredients from image:', error);
      throw new Error('Не удалось распознать продукты на изображении');
    }
  }

  static async analyzeCaloriesFromImage(imageFile: File): Promise<string> {
    try {
      const base64Image = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(imageFile);
      });

      const response = await this.makeRequest([
        {
          role: "system",
          content: "Ты - эксперт по подсчету калорий в блюдах. Анализируй изображение блюда и выдавай подробный отчет о калорийности: Общая калорийность, содержание белков, жиров, углеводов, размер порции. Отвечай на русском языке."
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Пожалуйста, проанализируй это изображение блюда и дай подробный отчет о калорийности." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }
      ], 'gpt-4-turbo');

      return response;
    } catch (error) {
      console.error('Error analyzing calories from image:', error);
      throw new Error('Не удалось проанализировать калорийность на изображении');
    }
  }

  static async chatWithChef(message: string, healthProfile?: UserHealthProfile): Promise<string> {
    const prompt = `Ты - профессиональный Windex кулинар с 20-летним опытом работы на кухне. Твоя задача - помогать пользователям с любыми вопросами о готовке, рецептах, ингредиентах, кулинарных техниках и всем, что связано с кулинарией.

${healthProfile ? `
ОСОБЕННОСТИ ЗДОРОВЬЯ ПОЛЬЗОВАТЕЛЯ:
${healthProfile.conditions.map(c => `- ${c.name}: ${c.restrictions.join(', ')}`).join('\n')}
${healthProfile.dietaryRestrictions.length > 0 ? `Диетические предпочтения: ${healthProfile.dietaryRestrictions.join(', ')}` : ''}
${healthProfile.allergies.length > 0 ? `Аллергии: ${healthProfile.allergies.join(', ')}` : ''}
${healthProfile.notes ? `Дополнительные заметки: ${healthProfile.notes}` : ''}

Учитывай эти особенности при даче советов по рецептам и ингредиентам.
` : ''}

Твои характеристики:
- Опытный шеф-повар с глубокими знаниями кулинарии
- Дружелюбный и терпеливый наставник
- Готов помочь с любыми вопросами о готовке
- Знаешь множество кухонь мира и техник приготовления
- Можешь адаптировать рецепты под диетические потребности
- Даешь практичные и безопасные советы

Отвечай на русском языке, будь полезным и вдохновляющим. Всегда давай подробное пошаговое описание рецепта с указанием нужного оборудования, времени приготовления каждого шага и детальным описанием техники выполнения. Если вопрос не связан с кулинарией, вежливо направь разговор в нужное русло.`;

    try {
      const response = await this.makeRequest([
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: message
        }
      ]);

      return response;
    } catch (error) {
      console.error('Error in chat with chef:', error);
      throw new Error('Извините, произошла ошибка при обработке вашего сообщения. Попробуйте еще раз.');
    }
  }
}
