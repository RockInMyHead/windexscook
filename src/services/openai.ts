const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";

export interface Recipe {
  title: string;
  description: string;
  cookTime: string;
  servings: number;
  difficulty: "Easy" | "Medium" | "Hard";
  ingredients: string[];
  instructions: string[];
  tips?: string;
}

export class OpenAIService {
  private static async makeRequest(messages: any[], model: string = 'gpt-4') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
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
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  static async generateRecipe(ingredients: string[]): Promise<Recipe> {
    const prompt = `Создай уникальный рецепт на основе следующих ингредиентов: ${ingredients.join(', ')}.

Требования:
- Название блюда должно быть креативным и привлекательным
- Опиши блюдо в 1-2 предложениях
- Укажи время приготовления в минутах
- Количество порций: 2-4
- Сложность: Easy/Medium/Hard
- Список всех ингредиентов с количествами
- Пошаговые инструкции приготовления
- Полезный совет от шеф-повара

Ответь в формате JSON:
{
  "title": "Название блюда",
  "description": "Описание блюда",
  "cookTime": "25 мин",
  "servings": 4,
  "difficulty": "Medium",
  "ingredients": ["ингредиент 1 - 200г", "ингредиент 2 - 1 шт"],
  "instructions": ["Шаг 1", "Шаг 2", "Шаг 3"],
  "tips": "Совет от шеф-повара"
}`;

    try {
      const response = await this.makeRequest([
        {
          role: "system",
          content: "Ты - профессиональный шеф-повар с 20-летним опытом. Создавай креативные, вкусные и практичные рецепты. Всегда отвечай в формате JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ]);

      // Парсим JSON ответ
      const recipeData = JSON.parse(response);
      
      // Валидируем и форматируем данные
      return {
        title: recipeData.title || "Вкусное блюдо",
        description: recipeData.description || "Ароматное и аппетитное блюдо",
        cookTime: recipeData.cookTime || "30 мин",
        servings: recipeData.servings || 4,
        difficulty: recipeData.difficulty || "Medium",
        ingredients: recipeData.ingredients || ingredients,
        instructions: recipeData.instructions || ["Приготовьте блюдо по традиционному рецепту"],
        tips: recipeData.tips || "Подавайте горячим!"
      };
    } catch (error) {
      console.error('Error generating recipe:', error);
      throw new Error('Не удалось сгенерировать рецепт. Попробуйте еще раз.');
    }
  }

  static async generateRecipeVariations(ingredients: string[]): Promise<Recipe[]> {
    const variations = [];
    
    for (let i = 0; i < 3; i++) {
      try {
        const recipe = await this.generateRecipe(ingredients);
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
}
