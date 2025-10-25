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
  content?: string; // Для чата
}

export class OpenAIService {
  // Функция сжатия изображения
  private static async compressImage(file: File, quality: number = 0.7, maxWidth: number = 1024): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        // Вычисляем новые размеры
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Рисуем сжатое изображение
        ctx.drawImage(img, 0, 0, width, height);
        
        // Конвертируем в Blob
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback к оригинальному файлу
          }
        }, 'image/jpeg', quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  private static async makeRequest(messages: any[], model: string = 'gpt-4o-mini') {
    let response;
    try {
      response = await fetch('/api/openai/v1/chat/completions', {
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
    } catch (networkError) {
      console.error('Network error calling OpenAI:', networkError);
      throw new Error('Не удалось подключиться к серверу генерации рецептов. Проверьте соединение.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error Details:', errorText);
      
      // Пытаемся распарсить JSON ошибку
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error && errorData.error.code === 'regional_restriction') {
          throw new Error('AI функции временно недоступны в вашем регионе. Мы работаем над решением этой проблемы.');
        }
        if (errorData.error && errorData.error.message) {
          throw new Error(errorData.error.message);
        }
      } catch (parseError) {
        // Если не удалось распарсить JSON, проверяем, содержит ли текст ошибку на русском
        if (errorText.includes('Не удалось') || errorText.includes('ошибка') || errorText.includes('Ошибка')) {
          throw new Error(errorText);
        }
        // Если это не русский текст, используем стандартную ошибку
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }
      
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    try {
      return data.choices[0].message.content;
    } catch (parseError) {
      console.error('Error parsing JSON from OpenAI response:', parseError);
      throw new Error('Получен неверный ответ от OpenAI. Попробуйте позже.');
    }
  }

  static async generateRecipe(ingredients: string[], healthProfile?: UserHealthProfile, cuisineId?: string, isChatMode: boolean = false): Promise<Recipe> {
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

    const prompt = isChatMode 
      ? `Ты AI повар-консультант. Пользователь сказал: "${ingredients.join(', ')}". 

Отвечай как опытный шеф-повар, давая полезные советы по кулинарии. Если это ингредиенты - предложи рецепт. Если это вопрос - дай развернутый ответ. Будь дружелюбным и профессиональным.

Отвечай на русском языке, кратко и по делу.`
      : `Создай рецепт из следующих ингредиентов: ${ingredients.join(', ')}${healthConstraints}${cuisineConstraints}

ВАЖНО: Отвечай ТОЛЬКО в формате JSON. Структура ответа:
{
  "title": "Название блюда",
  "description": "Краткое описание блюда",
  "cookTime": "Время приготовления",
  "servings": число,
  "difficulty": "Easy|Medium|Hard",
  "ingredients": ["ингредиент – количество – особенности"],
  "instructions": ["очень подробные пошаговые инструкции"],
  "tips": "Советы шеф-повара"
}

Требования:
- Используй ТОЛЬКО указанные ингредиенты + базовые специи (соль, перец, масло)
- Для поля "instructions": создай четкие пошаговые инструкции. Каждый шаг должен быть отдельным элементом массива.
- НЕ добавляй номера шагов в текст инструкций - они будут добавлены автоматически
- НЕ добавляй мета-информацию типа "Оборудование:", "Время:", "Важно:" в начало строк
- Включай всю необходимую информацию (время, оборудование, техники) прямо в текст шага
- Укажи точные количества для каждого ингредиента
- Сделай рецепт практичным, понятным даже новичку
- Каждый шаг должен быть самодостаточным и понятным
`;

    try {
      const response = await this.makeRequest([
        {
          role: "system",
          content: "Ты - профессиональный шеф-повар. Создавай рецепты ТОЛЬКО из указанных ингредиентов + базовые специи. ОТВЕЧАЙ СТРОГО В ФОРМАТЕ JSON. НЕ добавляй никакого текста кроме JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ]);

      // Обработка ответа в зависимости от режима
      if (isChatMode) {
        // В режиме чата возвращаем простой ответ
        return {
          title: "AI Повар",
          description: response,
          content: response,
          cookTime: "",
          servings: 0,
          difficulty: "Easy" as const,
          ingredients: [],
          instructions: [],
          tips: ""
        };
      }

      // Парсим JSON ответ для режима рецепта
      let recipeData;
      try {
        // Очищаем ответ от возможного лишнего текста
        let cleanResponse = response.trim();

        // Найдем границы JSON по первым '{' и последним '}'
        const startIdx = cleanResponse.indexOf('{');
        const endIdx = cleanResponse.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          cleanResponse = cleanResponse.substring(startIdx, endIdx + 1);
        } else {
          throw new Error('Invalid JSON format received from AI');
        }

        // Парсим JSON
        recipeData = JSON.parse(cleanResponse);
      } catch (parseError) {
        console.error('Failed to parse recipe JSON:', response);
        console.error('Parse error:', parseError);
        throw new Error('Не удалось сгенерировать рецепт. Попробуйте еще раз.');
      }
      
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
      // Проверяем размер файла (максимум 10MB)
      if (imageFile.size > 10 * 1024 * 1024) {
        throw new Error('Размер изображения слишком большой. Пожалуйста, выберите файл меньше 10MB.');
      }
      
      // Сжимаем изображение перед отправкой
      const compressedImage = await this.compressImage(imageFile, 0.7, 1024);
      
      // Конвертируем файл в base64
      const base64Image = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Убираем data:image/jpeg;base64,
        };
        reader.readAsDataURL(compressedImage);
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
      // Проверяем размер файла (максимум 10MB)
      if (imageFile.size > 10 * 1024 * 1024) {
        throw new Error('Размер изображения слишком большой. Пожалуйста, выберите файл меньше 10MB.');
      }
      
      // Сжимаем изображение перед отправкой
      const compressedImage = await this.compressImage(imageFile, 0.7, 1024);
      
      const base64Image = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(compressedImage);
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

  static async chatWithChef(
    message: string, 
    healthProfile?: UserHealthProfile, 
    messageHistory?: Array<{role: 'user' | 'assistant', content: string}>
  ): Promise<string> {
    console.log('🔍 DEBUG: chatWithChef called with message:', JSON.stringify(message));
    console.log('🔍 DEBUG: messageHistory length:', messageHistory?.length || 0);
    
    // Проверяем, является ли сообщение простым приветствием (только если нет истории)
    if (!messageHistory || messageHistory.length === 0) {
      const greetingPatterns = [
        /^привет$/i,
        /^здравствуй$/i,
        /^здравствуйте$/i,
        /^hi$/i,
        /^hello$/i,
        /^добро пожаловать$/i,
        /^добро пожаловать!$/i,
        /^привет!$/i,
        /^здравствуй!$/i,
        /^здравствуйте!$/i
      ];

      const trimmedMessage = message.trim();
      console.log('🔍 DEBUG: trimmed message:', JSON.stringify(trimmedMessage));
      
      const isGreeting = greetingPatterns.some(pattern => {
        const matches = pattern.test(trimmedMessage);
        console.log('🔍 DEBUG: pattern', pattern, 'matches:', matches);
        return matches;
      });
      
      console.log('🔍 DEBUG: isGreeting:', isGreeting);
      
      if (isGreeting) {
        // Отвечаем на приветствия коротким сообщением
        console.log('🔍 DEBUG: Returning greeting response');
        return 'Здравствуйте! Готов помочь с кулинарными вопросами. Что хотите приготовить?';
      }
    }

    const prompt = `Ты - профессиональный Windexs кулинар с 20-летним опытом работы на кухне, рейтинг Top-1, знаешь все тонкости продуктов и техник.

Требования для описания рецепта:
1. Составь карту производства еды — разбей весь процесс на отдельные этапы (подготовка, варка, обжарка, сборка, подача).
2. Для каждого этапа укажи:
   - Необходимое оборудование (кастрюля, нож, разделочная доска и т.д.).
   - Ингредиенты с точными количествами и их особенности (части продукта, текстура, возможность замены).
   - Уровень огня: слабый, средний, сильный; температуру (°C или °F) если применимо.
   - Время, которое займет каждый шаг (минуты и секунды).
   - Детальное описание техники выполнения (форма и размер нарезки, интенсивность помешивания, способ контроля температуры и т.д.).
3. Даём советы и комментарии Top-1 шефа: как избежать ошибок, тонкости маринования, отдыха продуктов, сервировки.
4. Разбивай каждый основной шаг на несколько подшагов: описывай каждое мельчайшее действие (какое положение держать нож, как правильно помешивать, когда проверять готовность), и поясняй, зачем это важно.
5. Формулируй подшаги ясно и подробно так, будто объясняешь человеку, который никогда не держал нож или не включал плиту.

ВАЖНО: Помни контекст предыдущих сообщений в разговоре. Если пользователь задает уточняющие вопросы о рецепте, который обсуждался ранее, отвечай в контексте этого рецепта.

Если вопрос не связан с кулинарией, вежливо направь разговор в нужное русло. Отвечай на русском языке.`;

    try {
      // Строим массив сообщений с контекстом
      const messages = [
        {
          role: "system" as const,
          content: prompt
        }
      ];

      // Добавляем историю сообщений (последние 10 сообщений для экономии токенов)
      if (messageHistory && messageHistory.length > 0) {
        const recentHistory = messageHistory.slice(-10); // Берем последние 10 сообщений
        messages.push(...recentHistory);
      }

      // Добавляем текущее сообщение
      messages.push({
        role: "user" as const,
        content: message
      });

      console.log('🔍 DEBUG: Sending messages to OpenAI:', messages.length, 'messages');

      const response = await this.makeRequest(messages);

      return response;
    } catch (error) {
      console.error('Error in chat with chef:', error);
      throw new Error('Извините, произошла ошибка при обработке вашего сообщения. Попробуйте еще раз.');
    }
  }
}
